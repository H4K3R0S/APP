#!/usr/bin/env python3
"""Hvatanje piksela: root grab (GdkPixbuf), crop, geometrija prozora, snimanje na disk."""
from __future__ import annotations

import subprocess
import time
from pathlib import Path
from typing import Any

import gi

gi.require_version("Gdk", "3.0")
gi.require_version("GdkPixbuf", "2.0")
from gi.repository import Gdk, GdkPixbuf  # noqa: E402


def grab_root() -> GdkPixbuf.Pixbuf:
    """Uhvati ceo (virtuelni) ekran u Pixbuf."""
    root = Gdk.get_default_root_window()
    w, h = root.get_width(), root.get_height()
    pb = Gdk.pixbuf_get_from_window(root, 0, 0, w, h)
    if pb is None:
        raise RuntimeError("grab_root: pixbuf_get_from_window vratio None")
    return pb


def clamp_rect(x: int, y: int, w: int, h: int, maxw: int, maxh: int) -> tuple[int, int, int, int]:
    """Uokviri pravougaonik unutar (0,0,maxw,maxh); vrati (x,y,w,h) sa w,h>=1."""
    x = max(0, min(int(x), maxw - 1))
    y = max(0, min(int(y), maxh - 1))
    w = max(1, min(int(w), maxw - x))
    h = max(1, min(int(h), maxh - y))
    return x, y, w, h


def crop(pb: GdkPixbuf.Pixbuf, x: int, y: int, w: int, h: int) -> GdkPixbuf.Pixbuf:
    """Iseci region iz već uhvaćenog pixbuf-a (bez novog grab-a)."""
    x, y, w, h = clamp_rect(x, y, w, h, pb.get_width(), pb.get_height())
    return pb.new_subpixbuf(x, y, w, h)


def current_monitor_rect() -> tuple[int, int, int, int]:
    """Geometrija monitora POD MIŠEM u device-pikselima (x, y, w, h).

    Za više-monitorske postave: hvata samo ekran gde je trenutno pokazivač.
    Fallback: primarni monitor, pa ceo root.
    """
    disp = Gdk.Display.get_default()
    mon = None
    try:
        dev = disp.get_default_seat().get_pointer()
        _, px, py = dev.get_position()
        mon = disp.get_monitor_at_point(px, py)
    except Exception:
        mon = None
    if mon is None:
        mon = disp.get_primary_monitor() or (disp.get_monitor(0) if disp.get_n_monitors() else None)
    if mon is None:
        root = Gdk.get_default_root_window()
        return 0, 0, root.get_width(), root.get_height()
    g = mon.get_geometry()
    s = mon.get_scale_factor()  # HiDPI: geometrija je logička, pixbuf je device
    return g.x * s, g.y * s, g.width * s, g.height * s


def active_window_pid() -> int | None:
    """PID aktivnog prozora (za poklapanje sa registrovanom cell-shell app)."""
    try:
        out = subprocess.run(
            ["xdotool", "getactivewindow", "getwindowpid"],
            capture_output=True, text=True, timeout=1.5,
        ).stdout.strip()
        return int(out) if out.isdigit() else None
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def active_window_rect() -> tuple[int, int, int, int] | None:
    """Geometrija aktivnog prozora (X,Y,W,H) preko xdotool, ili None."""
    try:
        out = subprocess.run(
            ["xdotool", "getactivewindow", "getwindowgeometry", "--shell"],
            capture_output=True, text=True, timeout=1.5,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    vals: dict[str, int] = {}
    for line in out.splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            if v.strip().lstrip("-").isdigit():
                vals[k.strip()] = int(v)
    if {"X", "Y", "WIDTH", "HEIGHT"} <= vals.keys():
        return vals["X"], vals["Y"], vals["WIDTH"], vals["HEIGHT"]
    return None


def _unique_path(directory: Path, stem: str, ext: str) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    cand = directory / f"{stem}.{ext}"
    i = 1
    while cand.exists():
        cand = directory / f"{stem}-{i}.{ext}"
        i += 1
    return cand


def build_filename(cfg: dict[str, Any]) -> str:
    """Ime fajla iz šablona (strftime) + ekstenzija iz formata."""
    stem = time.strftime(cfg.get("filename_template", "oko-%Y%m%d-%H%M%S"))
    ext = "jpg" if cfg.get("format") == "jpg" else "png"
    return f"{stem}.{ext}"


def save_pixbuf(pb: GdkPixbuf.Pixbuf, path: str | Path, cfg: dict[str, Any]) -> str:
    """Snimi pixbuf na tačnu putanju (format iz cfg). Vrati putanju."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if cfg.get("format") == "jpg":
        q = str(cfg.get("jpg_quality", 92))
        pb.savev(str(path), "jpeg", ["quality"], [q])
    else:
        pb.savev(str(path), "png", [], [])
    return str(path)


def default_save_path(cfg: dict[str, Any]) -> Path:
    """Predložena putanja za snimanje (save_dir + jedinstveno ime)."""
    directory = Path(cfg.get("save_dir", str(Path.home() / "Pictures")))
    name = build_filename(cfg)
    stem, _, ext = name.rpartition(".")
    return _unique_path(directory, stem, ext)
