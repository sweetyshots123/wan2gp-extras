// Extras __EXTRAS_VERSION__ - back/forward guard + Ctrl+Enter / Cmd+Enter starts a generation (Generate, or Add New Prompt To Queue while running)
// + 0.3.0 "Clear outputs": WanGP's output folder to the Recycle Bin (preview, confirm; frames/ kept).
(() => {
    if (window.wangpExtras) return;
    window.wangpExtras = { version: "__EXTRAS_VERSION__" };
    const LABELS = ["Generate", "Add New Prompt To Queue"];
    const visible = el => !!el && el.offsetParent !== null && !el.disabled && getComputedStyle(el).visibility !== "hidden";
    function findButton() {
        const btns = [...document.querySelectorAll("button")].filter(b => visible(b));
        for (const label of LABELS) {
            const b = btns.find(x => x.textContent.trim() === label);
            if (b) return b;
        }
        return null;
    }
    function flash(btn) {
        const old = btn.style.outline;
        btn.style.outline = "3px solid #7c5cff";
        setTimeout(() => { btn.style.outline = old; }, 400);
    }
    document.addEventListener("keydown", e => {
        if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.repeat) return;
        const btn = findButton();
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const active = document.activeElement;
        if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT")) {
            active.dispatchEvent(new Event("input", { bubbles: true }));
            active.dispatchEvent(new Event("change", { bubbles: true }));
            active.blur();
        }
        setTimeout(() => { flash(btn); btn.click(); }, 150);
    }, true);
    console.log("[Extras] Ctrl+Enter shortcut ready");
    // --- Back/forward guard: mouse side buttons, keys, history swipe ---
    const isEditable = el => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    const blockSide = e => { if (e.button === 3 || e.button === 4) { e.preventDefault(); e.stopPropagation(); } };
    ["mousedown", "mouseup", "auxclick", "pointerdown", "pointerup"].forEach(t => window.addEventListener(t, blockSide, true));
    window.addEventListener("keydown", e => {
        if (e.key === "BrowserBack" || e.key === "BrowserForward") { e.preventDefault(); e.stopPropagation(); return; }
        if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !isEditable(document.activeElement)) {
            e.preventDefault(); e.stopPropagation();
        }
    }, true);
    try {
        const GUARD = { wangpExtrasGuard: true };
        const pushGuard = () => history.pushState(GUARD, "", location.href);
        if (!(history.state && history.state.wangpExtrasGuard)) pushGuard();
        window.addEventListener("popstate", e => {
            if (!(e.state && e.state.wangpExtrasGuard)) pushGuard();
        });
    } catch (err) { console.warn("[Extras] history guard failed", err); }
    const os = document.createElement("style");
    os.textContent = "html, body { overscroll-behavior-x: none; }";
    document.head.appendChild(os);
    console.log("[Extras] back/forward guard ready");
    // Keep RL's *reference-image* bar in sync with the native row. The bar is a sibling of that
    // row, so WanGP hiding the input does not hide the bar. Never force a native input visible.
    const REF_TABS = ["generate", "edit"];
    const REF_HIDDEN = "extras-refs-unavailable";
    const refsStyle = document.createElement("style");
    refsStyle.textContent = ".reflib-bar.extras-refs-unavailable { display: none !important; }";
    document.head.appendChild(refsStyle);
    function nativeReferencesAvailable(tab) {
        const row = document.querySelector(`.extras-refs-row-${tab}`);
        if (!row) return null; // missing/changed host integration: don't guess model capabilities
        for (let el = row; el && el !== document.body; el = el.parentElement) {
            // Inactive tabs are not model limitations. The bar is already hidden with its tab.
            if (el.classList.contains("tabitem") || el.getAttribute("role") === "tabpanel") break;
            const css = getComputedStyle(el);
            if (el.hidden || el.classList.contains("hidden") || css.display === "none" || css.visibility === "hidden") return false;
        }
        return true;
    }
    function syncReferenceBars() {
        for (const tab of REF_TABS) {
            // Exact IDs: do not touch reflib_vbar_*, starting images, end images or generation.
            const bar = document.getElementById(`reflib_bar_${tab}`);
            if (!bar) continue;
            const hide = nativeReferencesAvailable(tab) === false;
            if (bar.classList.contains(REF_HIDDEN) !== hide) bar.classList.toggle(REF_HIDDEN, hide);
        }
    }
    let refsScheduled = false;
    const scheduleReferenceBars = () => {
        if (refsScheduled) return;
        refsScheduled = true;
        requestAnimationFrame(() => { refsScheduled = false; syncReferenceBars(); });
    };
    // Re-created Gradio nodes/model changes are observed; the interval also handles delayed mounting.
    const refsObserver = new MutationObserver(scheduleReferenceBars);
    refsObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    setInterval(scheduleReferenceBars, 1000);
    syncReferenceBars();

    // ---------------------------------------------------------------- 0.3.0 Clear outputs
    // Button under the Video Generator's gallery. Dry run first (exact list), then a confirmation dialog; only the
    // listed entries are sent to the Recycle Bin (never a permanent delete); the top-level "frames" folder stays.
    const CT = {
        en: { btn: "Clear outputs", tip: "Send the files in WanGP's output folder to the Recycle Bin (shows the list first; the frames folder is kept)",
              title: "Send to the Recycle Bin?", intro: "{n} file(s) ({size}) from the output folder will go to the Recycle Bin:",
              kept: "Kept: {list}", skipped: "Skipped (links): {list}", more: "… and {n} more", files: "{n} files",
              note: "Nothing is deleted permanently: you can restore everything from the Recycle Bin.",
              cancel: "Cancel", ok: "Send to Recycle Bin", none: "The output folder has nothing to clear (the frames folder is kept).",
              done: "{n} file(s) sent to the Recycle Bin.", partial: "{n} file(s) sent to the Recycle Bin; {k} item(s) could not be moved and were kept.",
              newer: "{k} new item(s) that appeared after the preview were left alone.", fail: "Could not clear the output folder: {e}", busy_btn: "Working…",
              err: { missing: "the output folder does not exist", drive_root: "the output folder is a drive root", home: "the output folder is your home folder",
                     contains_wangp: "the output folder is (or contains) the WanGP folder", link: "the output folder is a link", busy: "a generation is running",
                     path_changed: "the output folder changed since the preview", bridge: "Extras bridge not available (reload the page)" } },
        es: { btn: "Vaciar salidas", tip: "Envía a la Papelera de reciclaje los archivos de la carpeta de salida de WanGP (primero muestra la lista; la carpeta frames se conserva)",
              title: "¿Enviar a la Papelera de reciclaje?", intro: "{n} archivo(s) ({size}) de la carpeta de salida irán a la Papelera de reciclaje:",
              kept: "Se conservan: {list}", skipped: "Omitidos (enlaces): {list}", more: "… y {n} más", files: "{n} archivos",
              note: "No se borra nada definitivamente: puedes restaurarlo todo desde la Papelera de reciclaje.",
              cancel: "Cancelar", ok: "Enviar a la Papelera", none: "La carpeta de salida no tiene nada que vaciar (la carpeta frames se conserva).",
              done: "{n} archivo(s) enviados a la Papelera de reciclaje.", partial: "{n} archivo(s) enviados a la Papelera; {k} elemento(s) no se pudieron mover y se conservan.",
              newer: "Se han dejado {k} elemento(s) nuevos que aparecieron después de la vista previa.", fail: "No se pudo vaciar la carpeta de salida: {e}", busy_btn: "Trabajando…",
              err: { missing: "la carpeta de salida no existe", drive_root: "la carpeta de salida es la raíz de una unidad", home: "la carpeta de salida es tu carpeta personal",
                     contains_wangp: "la carpeta de salida es (o contiene) la carpeta de WanGP", link: "la carpeta de salida es un enlace", busy: "hay una generación en curso",
                     path_changed: "la carpeta de salida ha cambiado desde la vista previa", bridge: "puente de Extras no disponible (recarga la página)" } },
    };
    const clang = () => (String(document.documentElement.lang || navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en");
    const ct = (k, p = {}) => String((CT[clang()] || CT.en)[k] ?? CT.en[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => p[n] ?? "");
    const cerr = (code) => ((CT[clang()] || CT.en).err[code] || CT.en.err[code] || String(code || "?"));
    const fmtSize = (b) => { b = Number(b) || 0; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (i ? b.toFixed(1) : String(b)) + " " + u[i]; };
    const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const cstyle = document.createElement("style");
    cstyle.textContent = `.extras-hidden{display:none !important}
.extras-outbar{display:flex;justify-content:flex-end;gap:6px;margin:4px 0}
.extras-btn{all:unset;box-sizing:border-box;cursor:pointer;height:26px;padding:0 10px;border-radius:6px;display:inline-flex;align-items:center;font-size:13px;
  background:var(--button-secondary-background-fill);color:var(--button-secondary-text-color,var(--body-text-color));border:1px solid var(--border-color-primary)}
.extras-btn:hover,.extras-btn:focus-visible{background:var(--button-secondary-background-fill-hover)}
.extras-btn[disabled]{opacity:.6;cursor:default}
.extras-danger{color:#dc2626;border-color:color-mix(in srgb,#dc2626 45%,var(--border-color-primary))}
.dark .extras-danger{color:#f87171}
.extras-modal{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.extras-dlg{background:var(--background-fill-primary,#fff);color:var(--body-text-color,#111);border:1px solid var(--border-color-primary);border-radius:10px;
  max-width:min(640px,92vw);max-height:80vh;display:flex;flex-direction:column;gap:8px;padding:16px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.extras-dlg h3{margin:0;font-size:16px}.extras-dlg .path{font-family:monospace;font-size:12px;opacity:.8;word-break:break-all}
.extras-dlg ul{margin:0;padding-left:18px;overflow:auto;font-size:13px;max-height:40vh}.extras-dlg .muted{opacity:.75;font-size:12.5px}
.extras-dlg .row{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
.extras-toast{position:fixed;right:16px;bottom:16px;z-index:10001;max-width:420px;padding:10px 14px;border-radius:8px;color:#fff;background:#333;box-shadow:0 4px 16px rgba(0,0,0,.35);font-size:13px}
.extras-toast.ok{background:#15803d}.extras-toast.error{background:#b91c1c}`;
    document.head.appendChild(cstyle);
    function toast(text, kind = "info") {
        const t = document.createElement("div"); t.className = "extras-toast " + kind; t.textContent = text;
        document.body.appendChild(t); setTimeout(() => t.remove(), 6000);
    }
    // JS <-> Python bridge: hidden textbox + button inserted after WanGP's output trigger (Video Generator tab)
    const pending = new Map(); let seq = 0, chain = Promise.resolve();
    function bridge(payload, timeoutMs = 600000) {
        const run = () => new Promise((resolve, reject) => {
            const req = document.querySelector("#extras_bridge_req textarea, #extras_bridge_req input");
            let btn = document.querySelector("#extras_bridge_btn"); if (btn && !btn.matches("button")) btn = btn.querySelector("button");
            if (!req || !btn) { reject(new Error(cerr("bridge"))); return; }
            const id = Date.now() + "-" + (++seq);
            const timer = setTimeout(() => { pending.delete(id); reject(new Error("timeout")); }, timeoutMs);
            pending.set(id, { resolve, timer });
            const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(req), "value")?.set;
            const v = JSON.stringify(Object.assign({}, payload, { id }));
            if (setter) setter.call(req, v); else req.value = v;
            req.dispatchEvent(new Event("input", { bubbles: true }));
            setTimeout(() => btn.click(), 30);
        });
        const p = chain.then(run, run); chain = p.catch(() => {}); return p;
    }
    window.wangpExtras.bridgeResponse = (raw) => {
        let r; try { r = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { return; }
        const entry = r && pending.get(r.id); if (!entry) return;
        pending.delete(r.id); clearTimeout(entry.timer); entry.resolve(r);
    };
    function refreshGallery() {   // WanGP's own refresh_gallery (it also drops files that no longer exist)
        const root = document.getElementById("wangp_main_output_trigger"); if (!root) return false;
        const ta = root.tagName === "TEXTAREA" ? root : root.querySelector("textarea"); if (!ta) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        const v = "extras-clear-" + Date.now();
        if (setter) setter.call(ta, v); else ta.value = v;
        ta.dispatchEvent(new Event("input", { bubbles: true })); ta.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
    }
    function confirmPlan(plan) {
        return new Promise((resolve) => {
            const MAX = 40, list = plan.entries.slice(0, MAX).map((e) => `<li>${e.kind === "dir" ? "📁 " : ""}${esc(e.name)} <span class="muted">${e.kind === "dir" ? esc(ct("files", { n: e.files })) + ", " : ""}${esc(fmtSize(e.bytes))}</span></li>`).join("")
                + (plan.entries.length > MAX ? `<li class="muted">${esc(ct("more", { n: plan.entries.length - MAX }))}</li>` : "");
            const m = document.createElement("div"); m.className = "extras-modal";
            m.innerHTML = `<div class="extras-dlg" role="dialog" aria-modal="true"><h3>${esc(ct("title"))}</h3><div class="path">${esc(plan.path)}</div>
                <div>${esc(ct("intro", { n: plan.n_files, size: fmtSize(plan.bytes) }))}</div><ul>${list}</ul>
                ${plan.kept && plan.kept.length ? `<div class="muted">${esc(ct("kept", { list: plan.kept.join(", ") }))}</div>` : ""}
                ${plan.skipped && plan.skipped.length ? `<div class="muted">${esc(ct("skipped", { list: plan.skipped.join(", ") }))}</div>` : ""}
                <div class="muted">${esc(ct("note"))}</div>
                <div class="row"><button type="button" class="extras-btn" data-x="no">${esc(ct("cancel"))}</button><button type="button" class="extras-btn extras-danger" data-x="yes">🗑 ${esc(ct("ok"))}</button></div></div>`;
            const done = (v) => { m.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
            const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(false); } };
            m.addEventListener("click", (e) => { const b = e.target.closest("[data-x]"); if (b) done(b.dataset.x === "yes"); else if (e.target === m) done(false); });
            m.addEventListener("keydown", (e) => e.stopPropagation());
            document.addEventListener("keydown", onKey, true);
            document.body.appendChild(m);
            m.querySelector('[data-x="no"]').focus();   // safe default
        });
    }
    let clearing = false;
    async function clearOutputs(btn) {
        if (clearing) return;
        clearing = true; btn.disabled = true; const label = btn.textContent; btn.textContent = ct("busy_btn");
        try {
            const plan = await bridge({ action: "clear_outputs_plan" });
            if (!plan || plan.ok === false) { toast(ct("fail", { e: cerr(plan && plan.error) + (plan && plan.path ? " (" + plan.path + ")" : "") }), "error"); return; }
            if (!plan.n_entries) { toast(ct("none"), "info"); return; }
            if (!(await confirmPlan(plan))) return;
            const r = await bridge({ action: "clear_outputs_run", path: plan.path, names: plan.entries.map((e) => e.name) });
            if (!r || r.ok === false) { toast(ct("fail", { e: cerr(r && r.error) }), "error"); return; }
            refreshGallery();
            const k = (r.failed || []).length;
            toast((k ? ct("partial", { n: r.n_files, k }) : ct("done", { n: r.n_files })) + ((r.left_new || []).length ? " " + ct("newer", { k: r.left_new.length }) : ""), k ? "info" : "ok");
        } catch (e) {
            toast(ct("fail", { e: String((e && e.message) || e) }), "error");
        } finally { clearing = false; btn.disabled = false; btn.textContent = label; }
    }
    function mountClearBar() {
        const tabs = document.getElementById("wangp-gallery-tabs");
        if (!tabs || !tabs.parentElement) return;
        let bar = tabs.parentElement.querySelector(":scope > .extras-outbar");
        if (!bar) {
            bar = document.createElement("div"); bar.className = "extras-outbar";
            bar.innerHTML = `<button type="button" class="extras-btn extras-danger" data-extras="clear"></button>`;
            bar.addEventListener("click", (e) => { const b = e.target.closest("[data-extras='clear']"); if (b) { e.preventDefault(); e.stopPropagation(); b.blur(); clearOutputs(b); } });
            bar.addEventListener("keydown", (e) => e.stopPropagation());
            tabs.insertAdjacentElement("afterend", bar);
        }
        const b = bar.querySelector("[data-extras='clear']"), L = clang();
        if (bar.dataset.lang !== L && !clearing) { bar.dataset.lang = L; b.textContent = "🗑 " + ct("btn"); b.title = ct("tip"); }
    }
    setInterval(mountClearBar, 1000);
    mountClearBar();
    window.wangpExtras.clearOutputs = clearOutputs;   // tests
    console.log("[Extras] clear outputs ready");
})();
