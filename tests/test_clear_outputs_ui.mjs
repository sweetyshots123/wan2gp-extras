// 0.3.0 Clear outputs UI in real headless Chrome: real extras.js, a fake WanGP page (gallery tabs, hidden bridge,
// output trigger) and a fake server answering the bridge with a synthetic plan. No real files are involved.
// Run: node --test tests/*.mjs   (skips if google-chrome is missing)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { launch } from "./browser/cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const js = readFileSync(join(here, "..", "extras.js"), "utf8").replaceAll("__EXTRAS_VERSION__", "0.3.0");
let hasChrome = true; try { execSync("command -v google-chrome", { stdio: "ignore" }); } catch { hasChrome = false; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (lang) => `<!doctype html><html lang="${lang}"><body>
<div><div id="wangp-gallery-tabs">tabs</div><div id="gallery">gallery</div></div>
<div id="wangp_main_output_trigger" style="display:none"><textarea></textarea></div>
<div id="extras_bridge" class="extras-hidden"><div id="extras_bridge_req"><textarea></textarea></div><button id="extras_bridge_btn">b</button></div>
<script>
window.__reqs = []; window.__trig = 0; window.__mode = "normal";
const entries = Array.from({ length: 45 }, (_, i) => ({ name: "clip_" + String(i).padStart(2, "0") + ".mp4", kind: "file", files: 1, bytes: 1048576 }));
entries.unshift({ name: "Vidosser", kind: "dir", files: 3, bytes: 3000 });
document.querySelector("#wangp_main_output_trigger textarea").addEventListener("change", () => window.__trig++);
document.getElementById("extras_bridge_btn").addEventListener("click", () => {
  const req = JSON.parse(document.querySelector("#extras_bridge_req textarea").value); window.__reqs.push(req);
  let r;
  if (req.action === "clear_outputs_plan") r = window.__mode === "empty" ? { ok: true, path: "/synthetic/outputs", entries: [], kept: ["frames"], skipped: [], n_entries: 0, n_files: 0, bytes: 0 }
    : window.__mode === "unsafe" ? { ok: false, error: "contains_wangp", path: "/synthetic" }
    : { ok: true, path: "/synthetic/outputs", entries, kept: ["frames"], skipped: ["link_dir"], n_entries: entries.length, n_files: 48, bytes: 45 * 1048576 + 3000 };
  else r = { ok: true, path: req.path, n_entries: req.names.length, n_files: 48, bytes: 1, failed: window.__mode === "partial" ? [{ name: "clip_00.mp4", error: "locked" }] : [], left_new: ["new.mp4"], gone: [] };
  r.id = req.id; setTimeout(() => window.wangpExtras.bridgeResponse(JSON.stringify(r)), 20);
});
</script><script>${js}</script></body></html>`;

test("clear outputs: preview -> cancel / confirm -> recycle exactly the previewed names", { skip: !hasChrome && "google-chrome not found" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "extras-ui-"));
  const b = await launch(9341);
  try {
    const open = async (lang) => { const f = join(dir, lang + ".html"); writeFileSync(f, page(lang)); await b.send("Page.navigate", { url: "file://" + f }); await sleep(600); };
    await open("en");
    const btnText = await b.ev(`(() => { const t = document.getElementById("wangp-gallery-tabs").nextElementSibling; return t.className + "|" + t.textContent.trim(); })()`);
    assert.equal(btnText, "extras-outbar|🗑 Clear outputs", "button sits right after the gallery tabs");
    // open preview, then cancel: no run request
    await b.ev(`document.querySelector("[data-extras='clear']").click()`); await sleep(300);
    const dlg = await b.ev(`(() => { const d = document.querySelector(".extras-modal"); return d && { text: d.textContent, items: d.querySelectorAll("li").length, focus: document.activeElement.dataset.x }; })()`);
    assert.ok(dlg, "dialog shown");
    assert.match(dlg.text, /\/synthetic\/outputs/); assert.match(dlg.text, /48 file\(s\)/); assert.match(dlg.text, /Kept: frames/);
    assert.match(dlg.text, /Skipped \(links\): link_dir/); assert.match(dlg.text, /Recycle Bin/); assert.match(dlg.text, /and 6 more/);
    assert.equal(dlg.items, 41, "40 listed + 'more' line"); assert.equal(dlg.focus, "no", "Cancel is the default");
    await b.ev(`document.querySelector('[data-x="no"]').click()`); await sleep(200);
    assert.equal(await b.ev(`JSON.stringify([document.querySelector(".extras-modal"), window.__reqs.map(r => r.action)])`), JSON.stringify([null, ["clear_outputs_plan"]]));
    // Escape also cancels
    await b.ev(`document.querySelector("[data-extras='clear']").click()`); await sleep(300);
    await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(200);
    assert.equal(await b.ev(`!!document.querySelector(".extras-modal") + "|" + window.__reqs.length`), "false|2");
    // confirm: run gets exactly the previewed names + path, gallery refresh, toast
    await b.ev(`document.querySelector("[data-extras='clear']").click()`); await sleep(300);
    await b.ev(`document.querySelector('[data-x="yes"]').click()`); await sleep(400);
    const run = await b.ev(`window.__reqs[3]`);
    assert.equal(run.action, "clear_outputs_run"); assert.equal(run.path, "/synthetic/outputs");
    assert.equal(run.names.length, 46); assert.equal(run.names[0], "Vidosser"); assert.ok(!run.names.includes("frames"));
    assert.equal(await b.ev(`window.__trig`), 1, "WanGP gallery refresh triggered");
    assert.match(await b.ev(`document.querySelector(".extras-toast.ok").textContent`), /48 file\(s\) sent to the Recycle Bin\. 1 new item/);
    assert.equal(await b.ev(`document.querySelector("[data-extras='clear']").disabled`), false);
    // nothing to clear / unsafe folder: no dialog, no run
    await b.ev(`window.__mode = "empty"; document.querySelector("[data-extras='clear']").click()`); await sleep(300);
    assert.equal(await b.ev(`!!document.querySelector(".extras-modal") + "|" + window.__reqs.at(-1).action`), "false|clear_outputs_plan");
    await b.ev(`window.__mode = "unsafe"; document.querySelector("[data-extras='clear']").click()`); await sleep(300);
    assert.match(await b.ev(`[...document.querySelectorAll(".extras-toast.error")].at(-1).textContent`), /contains\) the WanGP folder/);
    assert.equal(await b.ev(`window.__reqs.filter(r => r.action === "clear_outputs_run").length`), 1);
    // Spanish + partial failure
    await open("es");
    assert.equal(await b.ev(`document.querySelector("[data-extras='clear']").textContent`), "🗑 Vaciar salidas");
    await b.ev(`window.__mode = "partial"; document.querySelector("[data-extras='clear']").click()`); await sleep(300);
    assert.match(await b.ev(`document.querySelector(".extras-modal").textContent`), /Papelera de reciclaje/);
    await b.ev(`document.querySelector('[data-x="yes"]').click()`); await sleep(400);
    assert.match(await b.ev(`document.querySelector(".extras-toast").textContent`), /1 elemento\(s\) no se pudieron mover/);
    assert.deepEqual(b.logs.filter((l) => l.startsWith("EXC")), []);
  } finally { b.close(); }
});
