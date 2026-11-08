"""Extras - small quality-of-life additions for WanGP (keyboard shortcuts, ...). Plugin-only, JS injected."""
import os

from shared.utils.plugins import WAN2GPPlugin

PLUGIN_VERSION = "0.2.0"
_DIR = os.path.dirname(os.path.abspath(__file__))


class ExtrasPlugin(WAN2GPPlugin):
    def __init__(self):
        super().__init__()
        self.name = "Extras"
        self.version = PLUGIN_VERSION

    def setup_ui(self):
        with open(os.path.join(_DIR, "extras.js"), "r", encoding="utf-8") as f:
            self.add_custom_js(f.read().replace("__EXTRAS_VERSION__", PLUGIN_VERSION))
