"""0.3.0 Clear outputs - synthetic temp folders only (never WanGP's real outputs). Run: python tests/test_clear_outputs.py"""
import json
import os
import runpy
import sys
import tempfile
import types
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import clear_outputs as co  # noqa: E402


def make_tree(root: Path):
    out = root / "outputs"
    (out / "frames").mkdir(parents=True)
    (out / "frames" / "keep_frame00001.png").write_bytes(b"F" * 10)
    (out / "Frames2").mkdir()                       # not "frames": goes
    (out / "Frames2" / "x.png").write_bytes(b"x")
    (out / "a.mp4").write_bytes(b"A" * 100)
    (out / "b.png").write_bytes(b"B" * 20)
    (out / "sub" / "deep").mkdir(parents=True)
    (out / "sub" / "c.mp4").write_bytes(b"C" * 30)
    (out / "sub" / "deep" / "d.json").write_bytes(b"{}")
    outside = root / "elsewhere"; outside.mkdir()
    (outside / "precious.mp4").write_bytes(b"P")
    try:
        os.symlink(outside, out / "link_to_elsewhere")
        os.symlink(outside / "precious.mp4", out / "link.mp4")
    except OSError:
        pass
    return out, outside


def fake_bin(store):
    def rec(paths):
        for p in paths:
            store.append(p)
            dst = Path(store_dir) / (str(len(store)) + "_" + os.path.basename(p))
            os.rename(p, dst)            # moved, like a Recycle Bin: nothing destroyed
        return {}
    return rec


ok = []
with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    out, outside = make_tree(root)
    store_dir = root / "bin"; store_dir.mkdir()
    # ---- plan: dry run, nothing touched
    before = sorted(str(p) for p in out.rglob("*"))
    pl = co.plan(str(out))
    assert sorted(str(p) for p in out.rglob("*")) == before, "plan must not touch anything"
    names = [e["name"] for e in pl["entries"]]
    assert names == ["a.mp4", "b.png", "Frames2", "sub"], names
    assert pl["kept"] == ["frames"]
    assert set(pl["skipped"]) <= {"link.mp4", "link_to_elsewhere"}
    assert pl["n_files"] == 5 and pl["bytes"] == 100 + 20 + 1 + 30 + 2
    sub = [e for e in pl["entries"] if e["name"] == "sub"][0]
    assert sub == {"name": "sub", "kind": "dir", "files": 2, "bytes": 32}
    ok.append("plan lists top-level entries, keeps frames/, skips links, touches nothing")
    # ---- run: only planned names; something new after the preview stays
    (out / "new_after_preview.mp4").write_bytes(b"N")
    moved = []
    r = co.run(str(out), names, recycler=fake_bin(moved))
    assert r["n_entries"] == 4 and r["n_files"] == 5 and r["failed"] == []
    assert r["left_new"] == ["new_after_preview.mp4"]
    left = sorted(p.name for p in out.iterdir())
    assert "frames" in left and "new_after_preview.mp4" in left and "a.mp4" not in left and "sub" not in left
    assert (out / "frames" / "keep_frame00001.png").read_bytes() == b"F" * 10
    assert (outside / "precious.mp4").read_bytes() == b"P", "link targets untouched"
    assert sorted(os.path.basename(p) for p in moved) == ["Frames2", "a.mp4", "b.png", "sub"]
    assert (store_dir / "4_sub" / "deep" / "d.json").exists() or any((store_dir / n / "deep" / "d.json").exists() for n in os.listdir(store_dir))
    ok.append("run recycles only the planned entries (folders whole), leaves new files, frames and link targets")
    # ---- recycler failure: entry stays, reported
    r2 = co.run(str(out), ["new_after_preview.mp4"], recycler=lambda ps: {p: "locked" for p in ps})
    assert r2["n_entries"] == 0 and r2["failed"] == [{"name": "new_after_preview.mp4", "error": "locked"}]
    assert (out / "new_after_preview.mp4").exists()
    r3 = co.run(str(out), ["gone.mp4"], recycler=lambda ps: {})
    assert r3["gone"] == ["gone.mp4"] and r3["n_entries"] == 0
    ok.append("failures are kept and reported; vanished names reported")

with tempfile.TemporaryDirectory() as td:   # ---- real freedesktop Trash in a temp XDG_DATA_HOME (Linux path), never os.remove
    root = Path(td); out, _ = make_tree(root)
    with patch.dict(os.environ, {"XDG_DATA_HOME": str(root / "xdg")}), patch.object(co.sys, "platform", "linux"), \
         patch.dict(sys.modules, {"send2trash": None}):
        r = co.run(str(out), [e["name"] for e in co.plan(str(out))["entries"]])
    trash = root / "xdg" / "Trash"
    assert r["n_entries"] == 4, r
    assert (trash / "files" / "a.mp4").read_bytes() == b"A" * 100
    assert (trash / "files" / "sub" / "deep" / "d.json").exists()
    assert (trash / "info" / "a.mp4.trashinfo").read_text().startswith("[Trash Info]")
    assert (out / "frames" / "keep_frame00001.png").exists()
    ok.append("real Trash backend: files/folders moved with .trashinfo (restorable), frames kept")

with tempfile.TemporaryDirectory() as td:   # ---- safety
    root = Path(td); wangp = root / "Wan2GP"; (wangp / "outputs").mkdir(parents=True)
    assert co.check_safe(str(wangp / "outputs"), str(wangp)) is None
    assert co.check_safe(str(wangp), str(wangp)) == "contains_wangp"
    assert co.check_safe(str(root), str(wangp)) == "contains_wangp"
    assert co.check_safe(str(root / "nope"), str(wangp)) == "missing"
    assert co.check_safe("/", str(wangp)) == "drive_root"
    assert co.check_safe(os.path.expanduser("~"), str(wangp)) in ("home", "contains_wangp")
    ln = root / "outlink"; os.symlink(wangp / "outputs", ln)
    assert co.check_safe(str(ln), str(wangp)) == "link"
    ok.append("refuses missing folder, drive root, home, WanGP folder or its parents, links")
    # ---- output folder resolution
    assert co.resolve_output_dir({"save_path": "outputs"}, cwd=str(wangp)) == os.path.realpath(wangp / "outputs")
    assert co.resolve_output_dir({}, cwd=str(wangp)) == os.path.realpath(wangp / "outputs")
    absdir = root / "abs_out"; absdir.mkdir()
    assert co.resolve_output_dir({"save_path": str(absdir)}, cwd=str(wangp)) == os.path.realpath(absdir)
    ws = types.ModuleType("shared.utils.workspace_storage")
    ws.output_config = lambda cfg, state=None: {**cfg, "save_path": str(absdir / "ws")} if state == "bound" else cfg
    pkg = types.ModuleType("shared"); utils = types.ModuleType("shared.utils"); utils.workspace_storage = ws; pkg.utils = utils
    with patch.dict(sys.modules, {"shared": pkg, "shared.utils": utils, "shared.utils.workspace_storage": ws}):
        assert co.resolve_output_dir({"save_path": "outputs"}, state="bound", cwd=str(wangp)) == os.path.realpath(absdir / "ws")
        assert co.resolve_output_dir({"save_path": "outputs"}, state=None, cwd=str(wangp)) == os.path.realpath(wangp / "outputs")
    ok.append("output folder = save_path (relative to WanGP / absolute), workspace binding honoured")

# ---- plugin bridge end-to-end (base class stubbed; synthetic WanGP folder; fake recycler)
base = types.ModuleType("shared.utils.plugins")
class Base:
    def __init__(self): pass
base.WAN2GPPlugin = Base
with patch.dict(sys.modules, {"shared.utils.plugins": base}):
    cls = runpy.run_path(str(HERE / "plugin.py"))["ExtrasPlugin"]
with tempfile.TemporaryDirectory() as td:
    root = Path(td); wangp = root / "Wan2GP"; wangp.mkdir()
    out, _ = make_tree(wangp)
    p = cls(); p.server_config = {"save_path": "outputs"}
    moved = []
    store_dir = root / "bin2"; store_dir.mkdir()
    co_mod = sys.modules["clear_outputs"]
    old_cwd = os.getcwd(); os.chdir(wangp)
    try:
        pl = json.loads(p._bridge(json.dumps({"action": "clear_outputs_plan", "id": "1"}), {"gen": {}}))
        assert pl["ok"] and pl["id"] == "1" and pl["path"] == os.path.realpath(out) and pl["n_entries"] == 4
        busy = json.loads(p._bridge(json.dumps({"action": "clear_outputs_run", "names": ["a.mp4"], "path": pl["path"]}), {"gen": {"in_progress": True}}))
        assert busy == {"ok": False, "error": "busy", "path": pl["path"], "id": None}
        moved_ch = json.loads(p._bridge(json.dumps({"action": "clear_outputs_run", "names": ["a.mp4"], "path": str(root)}), {"gen": {}}))
        assert moved_ch["error"] == "path_changed"
        nopath = json.loads(p._bridge(json.dumps({"action": "clear_outputs_run", "names": ["a.mp4"]}), {"gen": {}}))
        assert nopath["error"] == "path_changed", "run without the previewed path is refused"
        assert (out / "a.mp4").exists()
        with patch.object(co_mod, "RECYCLER", fake_bin(moved)):
            r = json.loads(p._bridge(json.dumps({"action": "clear_outputs_run", "names": ["a.mp4", "sub"], "path": pl["path"], "id": "2"}), {"gen": {}}))
        assert r["ok"] and r["id"] == "2" and r["n_entries"] == 2 and r["n_files"] == 3, r
        assert not (out / "a.mp4").exists() and (out / "b.png").exists() and (out / "frames").exists()
        p.server_config = {"save_path": str(wangp)}
        bad = json.loads(p._bridge(json.dumps({"action": "clear_outputs_plan"}), None))
        assert bad["ok"] is False and bad["error"] == "contains_wangp"
        assert json.loads(p._bridge("not json"))["error"] == "bad_request"
        assert json.loads(p._bridge(json.dumps({"action": "x"})))["error"] == "unknown_action"
    finally:
        os.chdir(old_cwd)
    ok.append("plugin bridge: plan/run ids, busy and path-changed refusals, unsafe folder refused, bad requests")

src = (HERE / "clear_outputs.py").read_text()
assert "rmtree" not in src and "os.unlink" not in src and "os.remove(p" not in src, "no permanent delete of user files"
ok.append("no permanent-delete call in clear_outputs.py")
for line in ok:
    print("ok -", line)
print(f"test_clear_outputs: {len(ok)} groups OK")
