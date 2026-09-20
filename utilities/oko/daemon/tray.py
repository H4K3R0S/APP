#!/usr/bin/env python3
"""Tray ikonica (Gtk.StatusIcon) sa menijem: brzo hvatanje, podešavanja, izlaz."""
from __future__ import annotations

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk  # noqa: E402

from . import i18n


class Tray:
    def __init__(self, controller):
        self.c = controller
        self.icon = Gtk.StatusIcon()
        self.icon.set_from_icon_name("camera-photo")
        self.icon.set_tooltip_text("OKO")
        self.icon.set_visible(True)
        self.icon.connect("popup-menu", self._on_popup)
        self.icon.connect("activate", lambda *_: self.c.capture("region"))

    def _menu(self) -> Gtk.Menu:
        m = Gtk.Menu()
        hk = self.c.settings_get().get("hotkey", "Insert")

        def item(label, cb):
            it = Gtk.MenuItem(label=label)
            it.connect("activate", lambda *_: cb())
            m.append(it)

        head = Gtk.MenuItem(label="OKO")
        head.set_sensitive(False)
        m.append(head)
        m.append(Gtk.SeparatorMenuItem())
        item(f"{i18n.t('tray_region')} ({hk})", lambda: self.c.capture("region"))
        item(i18n.t("tray_window"), lambda: self.c.capture("window"))
        item(i18n.t("tray_screen"), lambda: self.c.capture("screen"))
        m.append(Gtk.SeparatorMenuItem())
        item(f"⚙  {i18n.t('tray_settings')}", self.c.open_settings)
        m.append(Gtk.SeparatorMenuItem())
        item(i18n.t("tray_quit"), self.c.quit)
        m.show_all()
        return m

    def _on_popup(self, icon, button, tm):
        menu = self._menu()
        menu.popup(None, None, Gtk.StatusIcon.position_menu, icon, button, tm)
