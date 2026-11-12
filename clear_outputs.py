"""Extras 0.3.0 - "Clear outputs": send WanGP's output folder contents to the Recycle Bin (never a permanent delete).

Flow: plan() = dry run listing exactly what would go (top-level entries of the output folder, except a top-level
``frames`` folder, which is always kept); the user confirms; run() recycles only the entries that were in that plan
and are still eligible (anything new that appeared in between is left alone). Symlinks / junctions are skipped.
Pure Python, no WanGP import needed: tests use synthetic temp folders and a fake recycler.
"""
from __future__ import annotations

import os
import stat
import sys
import time
from typing import Any, Callable, Dict, Iterable, List, Optional

KEEP = ("frames",)          # top-level folder names that are never touched (case-insensitive)
RECYCLER: Optional[Callable[[List[str]], Dict[str, str]]] = None   # tests plug a fake: paths -> {path: error}


# ------------------------------------------------------------------------------------------------ output folder
def resolve_output_dir(server_config: Optional[dict], state: Any = None, cwd: Optional[str] = None) -> str:
    """WanGP's video output folder for this session: ``save_path`` after the workspace binding (if any), relative to
    WanGP's folder, like wgp.py does."""
    cfg = dict(server_config or {})
    try:
        from shared.utils import workspace_storage   # WanGP >= workspaces; absent in older builds / tests
        cfg = workspace_storage.output_config(cfg, state=state) or cfg
    except Exception:
        pass
    p = str(cfg.get("save_path") or "outputs")
    return os.path.realpath(os.path.join(cwd or os.getcwd(), os.path.expanduser(p)))


def _is_link(p: str) -> bool:
    """Symlink or Windows junction / any reparse point: never followed, never recycled."""
    try:
        st = os.lstat(p)
    except OSError:
        return False
    if stat.S_ISLNK(st.st_mode):
        return True
    attrs = getattr(st, "st_file_attributes", 0)
    return bool(attrs & 0x400)   # FILE_ATTRIBUTE_REPARSE_POINT


def check_safe(d: str, wangp_root: str) -> Optional[str]:
    """None if ``d`` may be cleared, else an error code."""
    if not d or not os.path.isdir(d):
        return "missing"
    if _is_link(d):
        return "link"
    rd, root = os.path.realpath(d), os.path.realpath(wangp_root)
    if not os.path.splitdrive(rd)[1].strip("\\/"):
        return "drive_root"
    home = os.path.realpath(os.path.expanduser("~"))
    if os.path.normcase(rd) == os.path.normcase(home):
        return "home"
    try:
        if os.path.normcase(os.path.commonpath([rd, root])) == os.path.normcase(rd):   # d is WanGP's folder or contains it
            return "contains_wangp"
    except ValueError:
        pass   # different drives
    return None


def _kept(name: str) -> bool:
    return name.lower() in KEEP


def _entries(d: str):
    try:
        names = sorted(os.listdir(d), key=str.lower)
    except OSError as e:
        raise RuntimeError(str(e))
    for name in names:
        yield name, os.path.join(d, name)


def plan(d: str) -> Dict[str, Any]:
    """Dry run: what would go to the Recycle Bin. Nothing is touched."""
    entries, kept, skipped = [], [], []
    n_files = n_bytes = 0
    for name, p in _entries(d):
        if _kept(name):
            kept.append(name); continue
        if _is_link(p):
            skipped.append(name); continue
        if os.path.isdir(p):
            files = size = 0
            for dp, dns, fns in os.walk(p, followlinks=False):
                dns[:] = [x for x in dns if not _is_link(os.path.join(dp, x))]
                for fn in fns:
                    fp = os.path.join(dp, fn)
                    files += 1
                    try:
                        size += os.lstat(fp).st_size
                    except OSError:
                        pass
            entries.append({"name": name, "kind": "dir", "files": files, "bytes": size})
        elif os.path.isfile(p):
            size = os.lstat(p).st_size
            files = 1
            entries.append({"name": name, "kind": "file", "files": 1, "bytes": size})
        else:
            continue
        n_files += files; n_bytes += size
    return {"ok": True, "path": d, "entries": entries, "kept": kept, "skipped": skipped,
            "n_entries": len(entries), "n_files": n_files, "bytes": n_bytes}


def run(d: str, names: Iterable[str], recycler: Optional[Callable[[List[str]], Dict[str, str]]] = None) -> Dict[str, Any]:
    """Recycle the planned entries ``names`` that are still eligible. Never deletes permanently."""
    want = {str(n) for n in names or ()}
    fresh = plan(d)
    todo = [e for e in fresh["entries"] if e["name"] in want]
    new = [e["name"] for e in fresh["entries"] if e["name"] not in want]
    paths = [os.path.join(d, e["name"]) for e in todo]
    errs = recycle(paths, recycler) if paths else {}
    done = [e for e, p in zip(todo, paths) if p not in errs]
    failed = [{"name": os.path.basename(p), "error": err} for p, err in errs.items()]
    return {"ok": True, "path": d, "n_entries": len(done), "n_files": sum(e["files"] for e in done),
            "bytes": sum(e["bytes"] for e in done), "failed": failed, "left_new": new,
            "gone": sorted(want - {e["name"] for e in fresh["entries"]})}


# ------------------------------------------------------------------------------------------------ recycle bin
def recycle(paths: List[str], recycler: Optional[Callable[[List[str]], Dict[str, str]]] = None) -> Dict[str, str]:
    """-> {path: error} for the paths NOT moved to the Recycle Bin / Trash (they stay where they are)."""
    paths = [p for p in dict.fromkeys(paths) if p and os.path.lexists(p)]
    if not paths:
        return {}
    fn = recycler or RECYCLER
    try:
        if fn is not None:
            errs = fn(paths)
        elif sys.platform == "win32":
            errs = _recycle_windows(paths)
        else:
            try:
                from send2trash import send2trash   # optional
                errs = {}
                for p in paths:
                    try:
                        send2trash(p)
                    except Exception as e:
                        errs[p] = str(e)
            except ImportError:
                errs = _recycle_xdg(paths)
    except Exception as e:
        errs = {p: str(e) for p in paths}
    return {p: e for p, e in (errs or {}).items() if os.path.lexists(p)}   # only what really stayed


def _no_recycle_bin(p: str) -> str:
    """Windows deletes permanently on drives without a Recycle Bin (network shares, most USB sticks): refuse those."""
    import ctypes, ntpath
    ap = ntpath.abspath(p)
    if ap.startswith("\\\\"):
        return "network path: no Recycle Bin, kept"
    root = ntpath.splitdrive(ap)[0] + "\\"
    if ctypes.windll.kernel32.GetDriveTypeW(ctypes.c_wchar_p(root)) != 3:   # DRIVE_FIXED
        return "this drive has no Recycle Bin (removable or network), kept"
    return ""


def _recycle_windows(paths: List[str]) -> Dict[str, str]:
    """SHFileOperationW(FO_DELETE, FOF_ALLOWUNDO): to the Recycle Bin (files and whole folders), never a permanent delete."""
    import ctypes
    from ctypes import wintypes

    class SHFILEOPSTRUCTW(ctypes.Structure):
        _fields_ = [("hwnd", wintypes.HWND), ("wFunc", wintypes.UINT), ("pFrom", wintypes.LPCWSTR), ("pTo", wintypes.LPCWSTR),
                    ("fFlags", ctypes.c_ushort), ("fAnyOperationsAborted", wintypes.BOOL), ("hNameMappings", ctypes.c_void_p),
                    ("lpszProgressTitle", wintypes.LPCWSTR)]
    FO_DELETE, FOF_SILENT, FOF_NOCONFIRMATION, FOF_ALLOWUNDO, FOF_NOERRORUI = 3, 0x4, 0x10, 0x40, 0x400
    FOF_WANTNUKEWARNING = 0x4000   # Windows asks before ever destroying instead of recycling
    errs = {}
    for p in paths:
        why = _no_recycle_bin(p)
        if why:
            errs[p] = why; continue
        buf = ctypes.create_unicode_buffer(os.path.abspath(p) + "\0")
        op = SHFILEOPSTRUCTW(None, FO_DELETE, ctypes.cast(buf, wintypes.LPCWSTR), None,
                             FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI | FOF_WANTNUKEWARNING, False, None, None)
        rc = ctypes.windll.shell32.SHFileOperationW(ctypes.byref(op))
        if rc != 0 or op.fAnyOperationsAborted or os.path.lexists(p):
            errs[p] = f"shell error {rc:#x}" if rc else "not moved to the Recycle Bin"
    return errs


def _recycle_xdg(paths: List[str]) -> Dict[str, str]:
    """freedesktop.org Trash (files/ + info/*.trashinfo), same filesystem only (a rename, never a copy+delete)."""
    from urllib.parse import quote
    base = os.path.join(os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share"), "Trash")
    errs = {}
    for p in paths:
        try:
            os.makedirs(os.path.join(base, "files"), exist_ok=True); os.makedirs(os.path.join(base, "info"), exist_ok=True)
            if os.lstat(p).st_dev != os.stat(base).st_dev:
                raise OSError("on another drive than the Trash: kept")
            name = os.path.basename(p); stem, ext = os.path.splitext(name); k = 1
            while os.path.lexists(os.path.join(base, "files", name)) or os.path.exists(os.path.join(base, "info", name + ".trashinfo")):
                k += 1; name = f"{stem}.{k}{ext}"
            info = os.path.join(base, "info", name + ".trashinfo")
            with open(info, "w", encoding="utf-8") as w:
                w.write(f"[Trash Info]\nPath={quote(os.path.abspath(p))}\nDeletionDate={time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
            try:
                os.rename(p, os.path.join(base, "files", name))
            except OSError:
                os.remove(info)   # our own .trashinfo only
                raise
        except Exception as e:
            errs[p] = str(e)
    return errs
