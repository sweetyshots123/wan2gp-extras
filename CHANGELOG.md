# Changelog

## 0.3.0 — prepared, not published or installed

- New **Clear outputs** / **Vaciar salidas** button right under the Video Generator gallery tabs (moved here from an uncommitted local Reference Library experiment; the RL is not changed).
- Two steps: a dry-run preview lists exactly what would go to the Recycle Bin (path, entries, file counts, sizes, kept `frames`, skipped links), Cancel is the default; only the previewed entries are recycled. Files that appear after the preview (e.g. a generation that just finished) are left alone.
- Recycle Bin only: Windows `SHFileOperationW` with `FOF_ALLOWUNDO` (+ `FOF_WANTNUKEWARNING`); other systems `send2trash` or the freedesktop Trash. Drives without a Recycle Bin are refused. Top-level folders go to the bin whole, so they restore with their structure. Never a permanent delete.
- The top-level `frames` folder is kept (case-insensitive). Symlinks/junctions are skipped, never followed.
- Output folder = WanGP's `save_path` resolved with the session `state` (`workspace_storage.output_config`, so a workspace binding is honoured), relative to the WanGP folder. Refused: missing folder, drive root, home, the WanGP folder or a parent of it, a link; refused while a generation is running or if the folder changed since the preview.
- After clearing, WanGP's own gallery refresh runs (it drops files that no longer exist).
- EN/ES UI; hidden JS↔Python bridge inserted after WanGP's `output_trigger`. Ctrl/Cmd+Enter, back/forward guard and the 0.2.1 reference-bar sync are unchanged.
- Tests: `python tests/test_clear_outputs.py` (synthetic temp folders, real freedesktop Trash in a temp `XDG_DATA_HOME`), `node --test tests/*.mjs` (adds a headless-Chrome confirm-flow test with a fake bridge), `python tests/test_component_hook.py`.

## 0.2.1 — prepared, not published or installed

- Hide/restore only the RL Reference Images collection bar according to the real native input row, via Extras plugin hooks and DOM observation. No forced model support, core changes or RL edits.
- Preserve Ctrl/Cmd+Enter and back/forward guard code unchanged.
- Add component-hook and JS regression tests; document scope, model evidence and manual retest in EN/ES README and docs/FEATURES.md.
