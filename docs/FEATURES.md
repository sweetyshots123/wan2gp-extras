# Extras features — prepared 0.2.1

Existing behavior is unchanged: Ctrl/Cmd+Enter invokes the visible Generate or Add New Prompt To Queue button; browser back/forward guards remain intact.

## Reference-image bar visibility

- Extras requests `image_refs_row` and `tab_id` through WanGP's plugin API. `post_ui_setup` tags native rows `extras-refs-row-generate` / `extras-refs-row-edit`, preserving existing classes. No core or Reference Library file is modified.
- JS checks each row and its ancestors for `hidden`, `.hidden`, `display:none` or `visibility:hidden`, stopping at the containing tab panel. Inactive tabs must not invalidate applying references from the manager.
- Only exact `reflib_bar_generate` / `reflib_bar_edit` IDs receive Extras-owned `extras-refs-unavailable`. CSS hides this class; clearing it restores the existing host/plugin styling rather than forcing display. `reflib_vbar_*`, starting images and ending images are not targeted.
- Missing row markers or an absent Reference Library are harmless: no model capability is inferred, and only Extras' own hiding class is removed. Other plugins' classes and inline styles are preserved.
- A coalesced MutationObserver handles model/mode changes and Gradio node replacements; a one-second fallback handles delayed mounts. No repeated DOM writes when state is unchanged.
- No new UI copy, so no additional translation keys; README behavior is documented in EN/ES. Hiding is theme independent. No new settings, personal data, network calls or media processing.

## Scope and evidence

Upstream WanGP commit `bd1ff5903cbc18b46c3cce3b75bd140870b536a2` declares version 19.14. Its `defaults/minimax_h3_control.json` selects `minimax_h3_control`. The handler removes FL2VA frame injection/custom choices; ControlNet choices lack reference-image `I`. `wgp.py` shows `image_refs_row` only for `I` in `video_prompt_type`. Start/end anchors remain separate. This fix removes a misleading RL bar; it does not force a reference selector or implement reference conditioning.

Sources:
- https://github.com/deepbeepmeep/WanGP/blob/bd1ff5903cbc18b46c3cce3b75bd140870b536a2/wgp.py
- https://github.com/deepbeepmeep/WanGP/blob/bd1ff5903cbc18b46c3cce3b75bd140870b536a2/models/minimax_h3/minimax_h3_handler.py
- https://github.com/deepbeepmeep/WanGP/blob/bd1ff5903cbc18b46c3cce3b75bd140870b536a2/defaults/minimax_h3_control.json

## Tests

`node tests/test_reference_bars.mjs`: shipped full JS with DOM/event harness; hidden row/ancestor, restore, inactive tabs, absent row/library, node replacement, no mutation loop, untouched control/start/end nodes, Ctrl/Cmd+Enter, mouse/browser guards and injection idempotence.

`python tests/test_component_hook.py`: actual Extras class with only WAN2GPPlugin base stubbed; request registration, component identity, generate/edit, fallback/missing rows and class preservation. Also run `node --check extras.js` and Python compilation.

## Browser retest — pending, no installation authorized

1. After explicit approval, test the prepared Extras with ordinary RL 1.12.3 (NOT RL's separate experimental visibility commit). Reload fully. Verify no console errors.
2. MiniMax H3 FL2VA ControlNet-Union: when native Reference Images is hidden, its RL reference collection bar must be hidden too. Control Video and its video bar remain unchanged; start/end controls retain their native behavior.
3. Switch to a model/mode exposing Reference Images; its RL collection bar must return, with its previous selection. Repeat model changes and Generate/Edit tab changes, including applying from the manager with Generate inactive.
4. Test without RL and after Gradio re-renders. No error or orphan styling. Check light/dark and EN/ES; no notice is added.
5. Test Ctrl/Cmd+Enter only in an intentionally safe test instance: Generate when idle, Add New Prompt To Queue when running; unchanged modifier/repeat exclusions and input flushing. Do not run this against a personal generation in progress.
6. Verify mouse side-button and Alt+Left/Right back guards still behave as before.

Risks: RL bar IDs and the native exported row API must remain compatible. Unknown row markup deliberately fails open instead of concealing unrelated controls. Actual Gradio/browser timing has not been visually tested. No coordination, publication or PC installation is implied by these files.
