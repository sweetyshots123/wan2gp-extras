// Extras __EXTRAS_VERSION__ - back/forward guard + Ctrl+Enter / Cmd+Enter starts a generation (Generate, or Add New Prompt To Queue while running).
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
})();
