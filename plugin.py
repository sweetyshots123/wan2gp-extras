"""Extras - small quality-of-life additions for WanGP (keyboard shortcuts, ...). Plugin-only, JS injected."""
import os

from shared.utils.plugins import WAN2GPPlugin

PLUGIN_VERSION = "0.2.1"
_DIR = os.path.dirname(os.path.abspath(__file__))


class ExtrasPlugin(WAN2GPPlugin):
    def __init__(self):
        super().__init__()
        self.name = "Extras"
        self.version = PLUGIN_VERSION
        self._seen_tabs = set()

    def setup_ui(self):
        # Identify the native Reference Images row, independent of translated labels or model names.
        self.request_component("image_refs_row")
        self.request_component("tab_id")
        with open(os.path.join(_DIR, "extras.js"), "r", encoding="utf-8") as f:
            self.add_custom_js(f.read().replace("__EXTRAS_VERSION__", PLUGIN_VERSION))

    def post_ui_setup(self, components):
        tab = components.get("tab_id")
        if tab not in ("generate", "edit"):
            tab = "generate" if "generate" not in self._seen_tabs else "edit"
        self._seen_tabs.add(tab)
        row = components.get("image_refs_row")
        if row is not None:
            classes = row.elem_classes or []
            classes = classes if isinstance(classes, list) else [classes]
            marker = f"extras-refs-row-{tab}"
            if marker not in classes:
                row.elem_classes = classes + [marker]
        return {}
