"""Extras - small quality-of-life additions for WanGP (keyboard shortcuts, ...). Plugin-only, JS injected."""
import json
import os
import sys
import traceback

from shared.utils.plugins import WAN2GPPlugin

PLUGIN_VERSION = "0.3.0"
_DIR = os.path.dirname(os.path.abspath(__file__))

try:   # package import inside WanGP; plain import when run from the plugin folder (tests)
    from . import clear_outputs as _co
except ImportError:
    sys.path.insert(0, _DIR)
    import clear_outputs as _co


class ExtrasPlugin(WAN2GPPlugin):
    def __init__(self):
        super().__init__()
        self.name = "Extras"
        self.version = PLUGIN_VERSION
        self._seen_tabs = set()
        self.server_config = None
        self._bridge_state = None

    def setup_ui(self):
        # Identify the native Reference Images row, independent of translated labels or model names.
        self.request_component("image_refs_row")
        self.request_component("tab_id")
        self.request_component("state")          # 0.3.0: session state -> workspace-aware output folder, busy check
        self.request_global("server_config")
        with open(os.path.join(_DIR, "extras.js"), "r", encoding="utf-8") as f:
            self.add_custom_js(f.read().replace("__EXTRAS_VERSION__", PLUGIN_VERSION))
        # 0.3.0: hidden JS <-> Python bridge next to the Video Generator's own hidden output trigger (generate tab)
        self.insert_after("output_trigger", self._create_bridge)

    def post_ui_setup(self, components):
        tab = components.get("tab_id")
        if tab not in ("generate", "edit"):
            tab = "generate" if "generate" not in self._seen_tabs else "edit"
        self._seen_tabs.add(tab)
        if tab == "generate" and self._bridge_state is None and components.get("state") is not None:
            self._bridge_state = components.get("state")
        row = components.get("image_refs_row")
        if row is not None:
            classes = row.elem_classes or []
            classes = classes if isinstance(classes, list) else [classes]
            marker = f"extras-refs-row-{tab}"
            if marker not in classes:
                row.elem_classes = classes + [marker]
        return {}

    # ------------------------------------------------------------------ 0.3.0 bridge + clear outputs
    def _create_bridge(self):
        import gradio as gr
        with gr.Group(elem_classes="extras-hidden", elem_id="extras_bridge") as group:
            req = gr.Textbox(value="", elem_id="extras_bridge_req", show_label=False)
            resp = gr.Textbox(value="", elem_id="extras_bridge_resp", show_label=False)
            btn = gr.Button("extras bridge", elem_id="extras_bridge_btn")
        inputs = [req] + ([self._bridge_state] if self._bridge_state is not None else [])
        btn.click(fn=self._bridge, inputs=inputs, outputs=[resp], show_progress="hidden").then(
            fn=None, inputs=[resp], outputs=None,
            js="(r) => { if (window.wangpExtras && window.wangpExtras.bridgeResponse) window.wangpExtras.bridgeResponse(r); }")
        return group

    def _config(self):
        if isinstance(self.server_config, dict):
            return self.server_config
        mod = sys.modules.get("__main__") or sys.modules.get("wgp")
        cfg = getattr(mod, "server_config", None)
        return cfg if isinstance(cfg, dict) else {}

    @staticmethod
    def _busy(state):
        try:
            gen = state.get("gen") if hasattr(state, "get") else None
            return bool(gen) and ("in_progress" in gen)
        except Exception:
            return False

    def clear_outputs(self, action, req, state=None, cwd=None):
        root = os.path.realpath(cwd or os.getcwd())
        d = _co.resolve_output_dir(self._config(), state=state, cwd=root)
        err = _co.check_safe(d, root)
        if err:
            return {"ok": False, "error": err, "path": d}
        if action == "clear_outputs_plan":
            return _co.plan(d)
        if self._busy(state):
            return {"ok": False, "error": "busy", "path": d}
        if not req.get("path") or os.path.normcase(os.path.realpath(req["path"])) != os.path.normcase(d):   # run only what the preview showed
            return {"ok": False, "error": "path_changed", "path": d}
        return _co.run(d, req.get("names") or [])

    def _bridge(self, raw, state=None):
        try:
            req = json.loads(raw or "{}")
        except Exception:
            return json.dumps({"ok": False, "error": "bad_request"})
        action = req.get("action")
        try:
            if action in ("clear_outputs_plan", "clear_outputs_run"):
                out = self.clear_outputs(action, req, state)
            else:
                out = {"ok": False, "error": "unknown_action"}
        except Exception as e:
            traceback.print_exc()
            out = {"ok": False, "error": str(e)}
        out["id"] = req.get("id")
        return json.dumps(out)
