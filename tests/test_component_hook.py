"""No WanGP/plugin execution: import Extras with only its base class stubbed."""
import runpy
import sys
import types
from pathlib import Path
from unittest.mock import patch

class Base:
    def __init__(self): self.requested = []; self.js = []
    def request_component(self, name): self.requested.append(name)
    def add_custom_js(self, text): self.js.append(text)

module = types.ModuleType('shared.utils.plugins')
module.WAN2GPPlugin = Base
with patch.dict(sys.modules, {'shared.utils.plugins': module}):
    cls = runpy.run_path(str(Path(__file__).parents[1] / 'plugin.py'))['ExtrasPlugin']
p = cls(); p.setup_ui()
assert p.requested == ['image_refs_row', 'tab_id']
assert '__EXTRAS_VERSION__' not in p.js[0]
assert '0.2.1' in p.js[0]
row = types.SimpleNamespace(elem_classes=['native'])
assert p.post_ui_setup({'tab_id':'generate','image_refs_row':row}) == {}
assert row.elem_classes == ['native','extras-refs-row-generate']
p.post_ui_setup({'tab_id':'generate','image_refs_row':row})
assert row.elem_classes.count('extras-refs-row-generate') == 1
edit = types.SimpleNamespace(elem_classes='native')
p.post_ui_setup({'tab_id':'edit','image_refs_row':edit})
assert edit.elem_classes == ['native','extras-refs-row-edit']
p.post_ui_setup({'tab_id':'generate'}) # absent row is harmless
q = cls(); q.post_ui_setup({'image_refs_row':types.SimpleNamespace(elem_classes=None)})
assert q._seen_tabs == {'generate'}
print('Extras component hook: row identity, generate/edit, fallback, missing row, existing classes, idempotence OK')
