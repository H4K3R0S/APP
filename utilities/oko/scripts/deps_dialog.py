#!/usr/bin/env python3
"""Mali GTK prozorčić: nedostajuće zavisnosti + copy-paste uputstvo + INSTALL dugme.

Poziv: deps_dialog.py --apt "pkg1 pkg2"
INSTALL → pkexec apt-get install -y <pkgs> (grafička auth). Izlaz 0 = instalirano/ok,
1 = otkaz/neuspeh. Copy → u clipboard. Zatvori → izlaz 1.
"""
from __future__ import annotations

import argparse
import subprocess
import threading

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gdk, GLib, Gtk  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apt", default="")
    args = ap.parse_args()
    apt = args.apt.split()
    cmd = "sudo apt-get install -y " + " ".join(apt)
    rc = {"code": 1}

    win = Gtk.Window(title="OKO — potrebne zavisnosti")
    win.set_default_size(560, -1)
    win.set_resizable(False)
    win.set_keep_above(True)
    win.set_position(Gtk.WindowPosition.CENTER)
    win.connect("destroy", Gtk.main_quit)

    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin=18)
    win.add(box)

    box.add(Gtk.Label(
        label="OKO za rad zahteva sistemske pakete koji nedostaju:",
        halign=Gtk.Align.START))
    lbl = Gtk.Label(halign=Gtk.Align.START)
    lbl.set_markup("<b>" + GLib.markup_escape_text(", ".join(apt)) + "</b>")
    box.add(lbl)

    box.add(Gtk.Label(label="Komanda za instalaciju (kopiraj u terminal):",
                      halign=Gtk.Align.START, margin_top=6))
    ent = Gtk.Entry(text=cmd, editable=False)
    ent.set_hexpand(True)
    box.add(ent)

    status = Gtk.Label(halign=Gtk.Align.START)
    box.add(status)

    btns = Gtk.Box(spacing=8, halign=Gtk.Align.END)
    b_close = Gtk.Button(label="Zatvori")
    b_copy = Gtk.Button(label="📋 Kopiraj")
    b_inst = Gtk.Button(label="INSTALL")
    b_inst.get_style_context().add_class("suggested-action")
    btns.add(b_close); btns.add(b_copy); btns.add(b_inst)
    box.add(btns)

    def on_copy(_b):
        cb = Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
        cb.set_text(cmd, -1)
        status.set_markup("<i>Komanda kopirana u clipboard.</i>")

    def on_close(_b):
        rc["code"] = 1
        win.destroy()

    def worker():
        try:
            p = subprocess.run(["pkexec", "apt-get", "install", "-y", *apt],
                               capture_output=True, text=True, timeout=600)
            ok = p.returncode == 0
        except Exception as exc:  # noqa: BLE001
            ok, p = False, None
            GLib.idle_add(status.set_markup,
                          "<span foreground='#d33'>Greška: %s</span>" % GLib.markup_escape_text(str(exc)))

        def done():
            if ok:
                rc["code"] = 0
                status.set_markup("<span foreground='#3a3'>Instalirano ✓ — pokrećem OKO…</span>")
                GLib.timeout_add(700, win.destroy)
            else:
                b_inst.set_sensitive(True)
                if p is not None:
                    status.set_markup("<span foreground='#d33'>Neuspeh (kod %d). Probaj ručno.</span>"
                                      % p.returncode)
            return False
        GLib.idle_add(done)

    def on_install(_b):
        b_inst.set_sensitive(False)
        status.set_markup("<i>Instaliram (traži se lozinka)…</i>")
        threading.Thread(target=worker, daemon=True).start()

    b_close.connect("clicked", on_close)
    b_copy.connect("clicked", on_copy)
    b_inst.connect("clicked", on_install)

    win.show_all()
    Gtk.main()
    return rc["code"]


if __name__ == "__main__":
    raise SystemExit(main())
