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
})();
