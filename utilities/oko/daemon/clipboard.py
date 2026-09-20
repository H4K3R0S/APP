#!/usr/bin/env python3
"""Kopiranje slike u clipboard (nativno GTK — daemon uvek radi pa slika opstaje)."""
from __future__ import annotations

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gtk  # noqa: E402


def copy_pixbuf(pb) -> None:
    """Stavi pixbuf u sistemski clipboard i pokušaj store() (za clipboard menadžer)."""
    clip = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
    clip.set_image(pb)
    clip.store()
