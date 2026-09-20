#!/usr/bin/env python3
"""Mali nativni GTK prozor sa podešavanjima (bez browsera). Piše kroz kontroler."""
from __future__ import annotations

from pathlib import Path

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import Gtk  # noqa: E402

from . import config, i18n

_FORMATS = [("png", "png"), ("jpg", "jpg")]
_LANGS = [("en", "English"), ("sr", "Srpski")]


class SettingsWindow:
    """Jedna instanca; ponovni poziv fokusira postojeći prozor."""

    def __init__(self, controller):
        self.c = controller
        self.win: Gtk.Window | None = None

    def show(self) -> None:
        if self.win is not None:
            self.win.present()
            return
        cfg = self.c.settings_get()
        i18n.set_lang(cfg.get("lang", "en"))
        modes = [("region", i18n.t("mode_region")), ("window", i18n.t("mode_window")),
                 ("screen", i18n.t("mode_screen"))]
        after = [("ask", i18n.t("after_ask")), ("file", i18n.t("after_file")),
                 ("clipboard", i18n.t("after_clipboard"))]
        self.win = Gtk.Window(title=i18n.t("settings_title"))
        self.win.set_default_size(440, -1)
        self.win.set_resizable(False)
        self.win.set_keep_above(True)
        self.win.set_position(Gtk.WindowPosition.CENTER)
        self.win.connect("destroy", self._on_destroy)

        grid = Gtk.Grid(row_spacing=8, column_spacing=10, margin=16)
        self.win.add(grid)
        r = 0

        self.c_lang = self._row_combo(grid, r, i18n.t("language"), _LANGS, cfg.get("lang", "en")); r += 1
        self.e_hotkey = self._row_entry(grid, r, i18n.t("hotkey"), cfg["hotkey"]); r += 1
        self.c_mode = self._row_combo(grid, r, i18n.t("mode"), modes, cfg["mode"]); r += 1
        self.c_after = self._row_combo(grid, r, i18n.t("after_select"), after, cfg["after_select"]); r += 1
        self.e_dir, dbox = self._row_dir(grid, r, i18n.t("path"), cfg["save_dir"]); r += 1
        self.c_format = self._row_combo(grid, r, i18n.t("format"), _FORMATS, cfg["format"]); r += 1
        self.s_quality = self._row_spin(grid, r, i18n.t("jpg_quality"), cfg["jpg_quality"]); r += 1
        self.e_tmpl = self._row_entry(grid, r, i18n.t("filename_template"), cfg["filename_template"]); r += 1
        self.ch_elem = self._row_check(grid, r, i18n.t("ai_windows_cache"), cfg.get("element_pick", True)); r += 1
        self.e_ai = self._row_entry(grid, r, i18n.t("sc_ai_cache"), cfg.get("hotkey_ai_cache", "")); r += 1
        self.e_cancel = self._row_entry(grid, r, i18n.t("sc_cancel"), cfg.get("hotkey_cancel", "Escape")); r += 1
        self.ch_auto = self._row_check(grid, r, i18n.t("autostart"), cfg["autostart"]); r += 1

        self.lbl_msg = Gtk.Label(halign=Gtk.Align.START)
        grid.attach(self.lbl_msg, 0, r, 2, 1); r += 1

        btns = Gtk.Box(spacing=8, halign=Gtk.Align.END)
        b_close = Gtk.Button(label=i18n.t("close")); b_close.connect("clicked", lambda *_: self.win.destroy())
        b_save = Gtk.Button(label=i18n.t("save")); b_save.get_style_context().add_class("suggested-action")
        b_save.connect("clicked", self._on_save)
        btns.add(b_close); btns.add(b_save)
        grid.attach(btns, 0, r, 2, 1)

        self.win.show_all()
        self.win.present()

    # --- redovi ---
    def _label(self, grid, r, text):
        lbl = Gtk.Label(label=text, halign=Gtk.Align.START)
        grid.attach(lbl, 0, r, 1, 1)

    def _row_entry(self, grid, r, text, val):
        self._label(grid, r, text)
        e = Gtk.Entry(text=str(val), hexpand=True)
        grid.attach(e, 1, r, 1, 1)
        return e

    def _row_combo(self, grid, r, text, options, val):
        self._label(grid, r, text)
        c = Gtk.ComboBoxText()
        for key, label in options:
            c.append(key, label)
        c.set_active_id(val if any(k == val for k, _ in options) else options[0][0])
        c.set_hexpand(True)
        grid.attach(c, 1, r, 1, 1)
        return c

    def _row_spin(self, grid, r, text, val):
        self._label(grid, r, text)
        s = Gtk.SpinButton.new_with_range(1, 100, 1)
        s.set_value(int(val))
        grid.attach(s, 1, r, 1, 1)
        return s

    def _row_check(self, grid, r, text, val):
        ch = Gtk.CheckButton(label=text)
        ch.set_active(bool(val))
        grid.attach(ch, 0, r, 2, 1)
        return ch

    def _row_dir(self, grid, r, text, val):
        self._label(grid, r, text)
        box = Gtk.Box(spacing=6)
        e = Gtk.Entry(text=str(val), hexpand=True)
        b = Gtk.Button(label="…")
        b.connect("clicked", lambda *_: self._pick_dir(e))
        box.add(e); box.add(b)
        grid.attach(box, 1, r, 1, 1)
        return e, box

    def _pick_dir(self, entry):
        dlg = Gtk.FileChooserDialog(title=i18n.t("path"),
                                    action=Gtk.FileChooserAction.SELECT_FOLDER)
        dlg.add_buttons(i18n.t("cancel"), Gtk.ResponseType.CANCEL,
                        i18n.t("ok"), Gtk.ResponseType.ACCEPT)
        cur = entry.get_text()
        if cur and Path(cur).is_dir():
            dlg.set_current_folder(cur)
        if dlg.run() == Gtk.ResponseType.ACCEPT:
            entry.set_text(dlg.get_filename())
        dlg.destroy()

    # --- akcije ---
    def _collect(self) -> dict:
        return {
            "lang": self.c_lang.get_active_id(),
            "hotkey": self.e_hotkey.get_text().strip() or config.DEFAULTS["hotkey"],
            "mode": self.c_mode.get_active_id(),
            "after_select": self.c_after.get_active_id(),
            "save_dir": self.e_dir.get_text().strip(),
            "format": self.c_format.get_active_id(),
            "jpg_quality": int(self.s_quality.get_value()),
            "filename_template": self.e_tmpl.get_text().strip() or config.DEFAULTS["filename_template"],
            "element_pick": self.ch_elem.get_active(),
            "hotkey_ai_cache": self.e_ai.get_text().strip(),
            "hotkey_cancel": self.e_cancel.get_text().strip() or config.DEFAULTS["hotkey_cancel"],
            "autostart": self.ch_auto.get_active(),
        }

    def _on_save(self, *_):
        old_lang = i18n.current()
        cfg = self.c.settings_set(self._collect())
        i18n.set_lang(cfg.get("lang", "en"))
        if cfg.get("lang", "en") != old_lang:
            self.win.destroy()      # jezik promenjen → ponovo iscrtaj na novom jeziku
            self.show()
        else:
            self.lbl_msg.set_markup(f"<span foreground='#3ddc84'>{i18n.t('saved')}</span>")

    def _on_destroy(self, *_):
        self.win = None
