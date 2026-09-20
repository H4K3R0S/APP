#!/usr/bin/env python3
"""GTK 'explorer' dijalog za snimanje slike; pamti izabrani direktorijum u config."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf, Gtk  # noqa: E402

from . import config, i18n


def _preview_size(iw: int, ih: int, box: int = 240) -> tuple[int, int]:
    """Dimenzije sličice koja staje u `box`×`box`, bez uvećavanja."""
    if iw <= 0 or ih <= 0:
        return (box, box)
    s = min(1.0, box / iw, box / ih)
    return (max(1, int(iw * s)), max(1, int(ih * s)))


def ask_save_path(cfg: dict[str, Any], preview_pixbuf=None) -> str | None:
    """Otvori Save dijalog u zapamćenoj putanji. Vrati izabranu putanju ili None.

    Ako se direktorijum promeni, upiše novi `save_dir` u config (pamćenje).
    `preview_pixbuf` (opciono) → sličica uhvaćene slike u dijalogu.
    """
    from .capture import default_save_path

    suggested = default_save_path(cfg)
    dlg = Gtk.FileChooserDialog(title=i18n.t("save_title"), action=Gtk.FileChooserAction.SAVE)
    dlg.add_buttons(
        i18n.t("cancel"), Gtk.ResponseType.CANCEL,
        i18n.t("save"), Gtk.ResponseType.ACCEPT,
    )
    dlg.set_do_overwrite_confirmation(True)
    try:
        dlg.set_current_folder(str(suggested.parent))
    except Exception:
        pass
    dlg.set_current_name(suggested.name)
    dlg.set_keep_above(True)

    if preview_pixbuf is not None:
        pw, ph = _preview_size(preview_pixbuf.get_width(), preview_pixbuf.get_height())
        thumb = preview_pixbuf.scale_simple(pw, ph, GdkPixbuf.InterpType.BILINEAR)
        img = Gtk.Image.new_from_pixbuf(thumb)
        dlg.set_preview_widget(img)
        dlg.set_preview_widget_active(True)

    path: str | None = None
    if dlg.run() == Gtk.ResponseType.ACCEPT:
        path = dlg.get_filename()
    dlg.destroy()

    if path:
        chosen_dir = str(Path(path).parent)
        if chosen_dir != cfg.get("save_dir"):
            config.update(save_dir=chosen_dir)
            cfg["save_dir"] = chosen_dir
    return path
