#!/usr/bin/env python3
"""Region-overlay: zamrznut screenshot preko celog ekrana + rubber-band izbor.

Brz, keyboard-first: povuci pravougaonik → Enter=Fajl, C=Clipboard, Esc=Otkaži,
ili klikni na pilule [💾 Fajl] / [📋 Clipboard]. Radi nad već uhvaćenim pixbuf-om.
Poziva `on_done(rect_or_None, action_or_None)` gde je action 'file'|'clipboard'.
"""
from __future__ import annotations

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gtk  # noqa: E402

from . import i18n

_MIN = 4          # minimalna stranica izbora u px
_PILL_W, _PILL_H, _PILL_GAP = 118, 34, 12


class RegionSelector:
    def __init__(self, pixbuf, on_done, origin=(0, 0)):
        self.pb = pixbuf
        self.on_done = on_done
        self.origin = origin  # (x,y) monitora u virtuelnom prostoru — prozor ide tu
        self.sx = self.sy = self.ex = self.ey = 0
        self.selecting = False
        self.has_sel = False
        self.finished = False
        self._pills: list[tuple[str, int, int, int, int]] = []

        w, h = pixbuf.get_width(), pixbuf.get_height()
        win = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
        win.set_decorated(False)
        win.set_resizable(False)
        win.set_keep_above(True)
        win.set_app_paintable(True)
        win.move(self.origin[0], self.origin[1])
        win.set_default_size(w, h)
        win.add_events(
            Gdk.EventMask.BUTTON_PRESS_MASK
            | Gdk.EventMask.BUTTON_RELEASE_MASK
            | Gdk.EventMask.POINTER_MOTION_MASK
            | Gdk.EventMask.KEY_PRESS_MASK
        )
        win.connect("draw", self._on_draw)
        win.connect("button-press-event", self._on_press)
        win.connect("button-release-event", self._on_release)
        win.connect("motion-notify-event", self._on_motion)
        win.connect("key-press-event", self._on_key)
        win.connect("realize", lambda *_: win.get_window().set_cursor(
            Gdk.Cursor.new_for_display(win.get_display(), Gdk.CursorType.CROSSHAIR)))
        self.win = win
        win.show_all()
        win.present()
        win.grab_focus()

    # --- geometrija izbora ---
    def _rect(self) -> tuple[int, int, int, int]:
        x, y = min(self.sx, self.ex), min(self.sy, self.ey)
        w, h = abs(self.ex - self.sx), abs(self.ey - self.sy)
        return x, y, w, h

    # --- događaji ---
    def _on_press(self, _w, ev):
        if ev.button != 1:
            return
        if self.has_sel:
            for action, px, py, pw, ph in self._pills:
                if px <= ev.x <= px + pw and py <= ev.y <= py + ph:
                    return self._finish(action)
        self.sx, self.sy = int(ev.x), int(ev.y)
        self.ex, self.ey = self.sx, self.sy
        self.selecting = True
        self.has_sel = False
        self.win.queue_draw()

    def _on_motion(self, _w, ev):
        if self.selecting:
            self.ex, self.ey = int(ev.x), int(ev.y)
            self.win.queue_draw()

    def _on_release(self, _w, ev):
        if ev.button != 1 or not self.selecting:
            return
        self.selecting = False
        self.ex, self.ey = int(ev.x), int(ev.y)
        _, _, w, h = self._rect()
        self.has_sel = w >= _MIN and h >= _MIN
        self.win.queue_draw()

    def _on_key(self, _w, ev):
        k = Gdk.keyval_name(ev.keyval)
        if k == "Escape":
            self._finish(None)
        elif self.has_sel and k in ("Return", "KP_Enter"):
            self._finish("file")
        elif self.has_sel and k in ("c", "C"):
            self._finish("clipboard")
        elif self.has_sel and k in ("e", "E"):
            self._finish("edit")

    def _finish(self, action):
        if self.finished:
            return
        self.finished = True
        rect = self._rect() if (action and self.has_sel) else None
        self.win.destroy()
        self.on_done(rect, action if rect else None)

    # --- crtanje ---
    def _on_draw(self, _w, cr):
        Gdk.cairo_set_source_pixbuf(cr, self.pb, 0, 0)
        cr.paint()
        # zatamni sve
        cr.set_source_rgba(0, 0, 0, 0.45)
        cr.paint()
        x, y, w, h = self._rect()
        if w > 0 and h > 0:
            # osvetli izbor (vrati original)
            cr.save()
            cr.rectangle(x, y, w, h)
            cr.clip()
            Gdk.cairo_set_source_pixbuf(cr, self.pb, 0, 0)
            cr.paint()
            cr.restore()
            # okvir
            cr.set_source_rgba(0.20, 0.75, 1.0, 0.95)
            cr.set_line_width(1.5)
            cr.rectangle(x + 0.5, y + 0.5, w, h)
            cr.stroke()
            self._draw_dim(cr, x, y, w, h)
        if self.has_sel:
            self._draw_pills(cr, x, y, w, h)
        return False

    def _draw_dim(self, cr, x, y, w, h):
        cr.set_source_rgba(1, 1, 1, 0.9)
        cr.select_font_face("Sans")
        cr.set_font_size(12)
        cr.move_to(x, max(14, y - 6))
        cr.show_text(f"{w}×{h}")

    def _draw_pills(self, cr, x, y, w, h):
        pills = (("file", "💾 " + i18n.t("file")), ("clipboard", "📋 " + i18n.t("clipboard")), ("edit", "✏️ " + i18n.t("edit")))
        total = _PILL_W * 3 + _PILL_GAP * 2
        px = max(6, min(x, self.pb.get_width() - total - 6))
        py = y + h + 10
        if py + _PILL_H > self.pb.get_height() - 6:
            py = max(6, y - _PILL_H - 10)

        # zajednička podloga iza pilula (oštre ivice)
        cr.rectangle(px - 6, py - 6, total + 12, _PILL_H + 12)
        cr.set_source_rgba(0.05, 0.06, 0.09, 0.72); cr.fill()

        self._pills = []
        for i, (action, label) in enumerate(pills):
            bx = px + i * (_PILL_W + _PILL_GAP)
            accent = (action == "edit")     # „Uredi" istaknut kao poziv na akciju
            cr.rectangle(bx, py, _PILL_W, _PILL_H)
            if accent:
                cr.set_source_rgba(0.20, 0.75, 1.0, 0.95)
            else:
                cr.set_source_rgba(0.16, 0.17, 0.22, 0.96)
            cr.fill()
            cr.set_source_rgba(0.05, 0.06, 0.09, 1) if accent else cr.set_source_rgba(0.93, 0.95, 0.98, 1)
            cr.select_font_face("Sans")
            cr.set_font_size(14)
            ext = cr.text_extents(label)
            cr.move_to(bx + (_PILL_W - ext.width) / 2 - ext.x_bearing, py + (_PILL_H + ext.height) / 2 - 1)
            cr.show_text(label)
            self._pills.append((action, bx, py, _PILL_W, _PILL_H))
