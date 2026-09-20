#!/usr/bin/env python3
"""Anotacioni editor: centriran providni panel (određene veličine, NE fullscreen).

Oštre ivice. Gore-levo Save/Clipboard (jedan ispod drugog); alati u dve grupe oko
centra (5 levo od centra, ostali desno); gore-centar zoom; gore-desno X. Boje: onoliko
swatch-eva koliko alata + 1 spektar-piker. Prazan deo top-trake = povlačenje prozora.
Slika se skalira da stane; zoom na točkić (na tački pod kursorom), dugmad ➖/➕/⤢ i pan
(✋ ili srednji taster). Alati: olovka/linija/strelica/pravoug./krug/tekst, crop, pomeri;
CTRL+Z undo, CTRL+C/V region copy/paste; Enter=Sačuvaj, Esc=Otkaz.
Rezultat: on_done(render_pixbuf, 'file'|'clipboard'|None).
"""
from __future__ import annotations

import cairo
import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, Gtk  # noqa: E402

from . import i18n
from .editor_model import (EditorModel, clamp_zoom, fit_scale, offset_keeping,
                           view_to_image)

_TOOLS = ["pen", "line", "arrow", "rect", "ellipse", "text", "crop", "move", "pan"]
_TOOL_LBL = {"pen": "✏", "line": "╱", "arrow": "↗", "rect": "▭", "ellipse": "◯",
             "text": "T", "crop": "⛶", "move": "✥", "pan": "✋"}
# 9 preset boja (koliko i alata) + zaseban spektar-piker
_SWATCHES = [(0.96, 0.26, 0.30, 1), (1, 0.55, 0.15, 1), (1, 0.85, 0.20, 1),
             (0.30, 0.85, 0.40, 1), (0.15, 0.75, 0.72, 1), (0.25, 0.62, 1, 1),
             (0.65, 0.45, 1, 1), (0.96, 0.96, 0.98, 1), (0.06, 0.07, 0.10, 1)]
_WIDTHS = [2, 4, 6, 10, 16]

_BG = (0.07, 0.08, 0.12, 0.92)
_CANVAS = (0.10, 0.11, 0.15, 0.97)
_CELL = (0.16, 0.17, 0.22, 0.96)
_CELL_HOVER = (0.24, 0.26, 0.33, 0.99)
_ACCENT = (0.20, 0.75, 1.0, 0.97)
_TXT = (0.92, 0.94, 0.98, 1)

_PAD = 14
_TOP_H = 98            # visina top-trake (kontrole); ispod je platno


class AnnotationEditor:
    def __init__(self, base_pixbuf, on_done):
        self.model = EditorModel(base_pixbuf)
        self.on_done = on_done
        self.finished = False
        self.tool = "pen"
        self.color = _SWATCHES[0]
        self.width = _WIDTHS[1]
        self.zoom = 1.0
        self.off = (0.0, 0.0)
        self.fit = 1.0
        self.drag = None
        self.sel_obj = None
        self.pan_start = None
        self._hit: list[tuple] = []
        self._hover = None

        win = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
        win.set_decorated(False); win.set_resizable(False); win.set_keep_above(True)
        win.set_app_paintable(True)
        win.set_position(Gtk.WindowPosition.CENTER)
        screen = win.get_screen()
        vis = screen.get_rgba_visual()
        if vis is not None:
            win.set_visual(vis)                # providnost ako ima kompozitora
        sw, sh = screen.get_width(), screen.get_height()
        self.W = int(min(1120, sw * 0.92))
        self.H = int(min(780, sh * 0.92))
        win.set_default_size(self.W, self.H)
        win.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK
                       | Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.KEY_PRESS_MASK
                       | Gdk.EventMask.SCROLL_MASK)
        win.connect("draw", self._on_draw)
        win.connect("button-press-event", self._on_press)
        win.connect("button-release-event", self._on_release)
        win.connect("motion-notify-event", self._on_motion)
        win.connect("scroll-event", self._on_scroll)
        win.connect("key-press-event", self._on_key)
        win.connect("delete-event", lambda *_: (self._finish(None, None), True)[1])
        self.win = win
        self._reset_view()
        win.show_all(); win.present(); win.grab_focus()

    # --- geometrija platna / zoom ---
    def _canvas(self):
        return (_PAD, _TOP_H, self.W - 2 * _PAD, self.H - _TOP_H - _PAD)

    def _scale(self):
        return self.fit * self.zoom

    def _reset_view(self):
        cx, cy, cw, ch = self._canvas()
        iw, ih = self.model.base.get_width(), self.model.base.get_height()
        self.fit = fit_scale(iw, ih, cw, ch)
        self.zoom = 1.0
        s = self._scale()
        self.off = (cx + (cw - iw * s) / 2, cy + (ch - ih * s) / 2)
        self.win.queue_draw()

    def _zoom_at(self, vpt, factor):
        old = self._scale()
        ip = view_to_image(vpt, old, self.off)
        self.zoom = clamp_zoom(self.zoom * factor)
        self.off = offset_keeping(vpt, ip, self._scale())
        self.win.queue_draw()

    def _to_img(self, x, y):
        return view_to_image((x, y), self._scale(), self.off)

    def _in_canvas(self, x, y) -> bool:
        cx, cy, cw, ch = self._canvas()
        return cx <= x <= cx + cw and cy <= y <= cy + ch

    # --- crtanje (oštre ivice) ---
    def _on_draw(self, _w, cr):
        cr.set_source_rgba(0, 0, 0, 0)
        cr.set_operator(cairo.OPERATOR_SOURCE); cr.paint()
        cr.set_operator(cairo.OPERATOR_OVER)
        cr.rectangle(0, 0, self.W, self.H); cr.set_source_rgba(*_BG); cr.fill()

        cx, cy, cw, ch = self._canvas()
        cr.rectangle(cx, cy, cw, ch); cr.set_source_rgba(*_CANVAS); cr.fill()
        cr.save()
        cr.rectangle(cx, cy, cw, ch); cr.clip()
        cr.translate(*self.off); cr.scale(self._scale(), self._scale())
        Gdk.cairo_set_source_pixbuf(cr, self.model.base, 0, 0); cr.paint()
        for obj in self.model.objects:
            Gdk.cairo_set_source_pixbuf(cr, obj["pixbuf"], obj["x"], obj["y"]); cr.paint()
        for sh in self.model.shapes:
            self.model._draw_shape(cr, sh)
        if self.drag and self.drag.get("type") in ("line", "arrow", "rect", "ellipse", "pen", "crop"):
            if self.drag["type"] == "crop":
                self.model._draw_shape(cr, {"type": "rect", "color": _ACCENT,
                                            "width": 1 / self._scale(), "pts": self.drag["pts"]})
            else:
                self.model._draw_shape(cr, {**self.drag, "color": self.color, "width": self.width})
        cr.restore()
        self._draw_toolbar(cr)
        return False

    def _cell(self, cr, kind, key, label, x, y, w, h, active=False, accent=False, font=15):
        hov = self._hover == (kind, key)
        if active or accent:
            cr.set_source_rgba(*_ACCENT)
        elif hov:
            cr.set_source_rgba(*_CELL_HOVER)
        else:
            cr.set_source_rgba(*_CELL)
        cr.rectangle(x, y, w, h); cr.fill()          # oštra ivica
        cr.set_source_rgba(0.05, 0.06, 0.09, 1) if (active or accent) else cr.set_source_rgba(*_TXT)
        cr.select_font_face("Sans"); cr.set_font_size(font)
        ext = cr.text_extents(label)
        cr.move_to(x + (w - ext.width) / 2 - ext.x_bearing, y + (h + ext.height) / 2 - 1)
        cr.show_text(label)
        self._hit.append((kind, key, x, y, w, h))

    def _draw_toolbar(self, cr):
        self._hit = []
        W, PAD = self.W, _PAD
        # gore-levo: Save iznad Clipboard
        self._cell(cr, "file", None, "💾 " + i18n.t("save"), PAD, 8, 118, 27, accent=True, font=14)
        self._cell(cr, "clipboard", None, "📋 " + i18n.t("clipboard"), PAD, 39, 118, 27, font=14)
        # gore-desno: X (i Undo levo od njega)
        self._cell(cr, "cancel", None, "✕", W - PAD - 36, 8, 36, 36, font=20)
        self._cell(cr, "undo", None, "↶", W - PAD - 36 - 44, 8, 36, 36, font=20)
        # gore-centar: zoom
        zw = 156
        zx = W // 2 - zw // 2
        self._cell(cr, "zoom_out", None, "➖", zx, 8, 36, 32, font=16)
        self._cell(cr, "zoom_fit", None, f"{int(self._scale() * 100)}%", zx + 40, 8, 76, 32, font=15)
        self._cell(cr, "zoom_in", None, "➕", zx + 120, 8, 36, 32, font=16)
        # alati — 2 grupe, veće ikonice
        lx = PAD + 118 + 24                       # odvojeno od Save bloka
        for i, t in enumerate(_TOOLS[:5]):        # 5 levo od centra
            self._cell(cr, "tool", t, _TOOL_LBL[t], lx + i * 54, 8, 48, 48,
                       active=(t == self.tool), font=25)
        rx = zx + zw + 24                         # ostali desno od centra
        for i, t in enumerate(_TOOLS[5:]):
            self._cell(cr, "tool", t, _TOOL_LBL[t], rx + i * 54, 8, 48, 48,
                       active=(t == self.tool), font=25)
        # boje: 9 swatch-eva + spektar-piker, ispod levog dela
        cy = 62
        for i, c in enumerate(_SWATCHES):
            x = lx + i * 32
            cr.rectangle(x, cy, 26, 26); cr.set_source_rgba(*c); cr.fill()
            if c == self.color:
                cr.set_source_rgba(*_ACCENT); cr.set_line_width(2)
                cr.rectangle(x - 1, cy - 1, 28, 28); cr.stroke()
            self._hit.append(("color", i, x, cy, 26, 26))
        sx = lx + len(_SWATCHES) * 32 + 6
        grad = cairo.LinearGradient(sx, 0, sx + 26, 0)
        for i, rgb in enumerate([(1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1), (1, 0, 1)]):
            grad.add_color_stop_rgb(i / 5, *rgb)
        cr.rectangle(sx, cy, 26, 26); cr.set_source(grad); cr.fill()
        cr.set_source_rgba(*_TXT); cr.set_line_width(1)
        cr.rectangle(sx + 0.5, cy + 0.5, 26, 26); cr.stroke()
        self._hit.append(("spectrum", None, sx, cy, 26, 26))
        # debljina linije (uz boje)
        self._cell(cr, "width", None, f"● {self.width}", sx + 40, cy - 3, 58, 30, font=14)

    # --- hit-test ---
    def _hit_test(self, x, y):
        for kind, key, hx, hy, hw, hh in self._hit:
            if hx <= x <= hx + hw and hy <= y <= hy + hh:
                return kind, key
        return None, None

    def _on_press(self, _w, ev):
        if ev.button == 3:
            return self._finish(None, None)
        if ev.button == 2:                       # srednji taster = pan
            self.pan_start = (ev.x, ev.y, self.off); return
        kind, key = self._hit_test(ev.x, ev.y)
        if kind == "tool":
            self.tool = key; self.win.queue_draw(); return
        if kind == "color":
            self.color = _SWATCHES[key]; self.win.queue_draw(); return
        if kind == "spectrum":
            return self._pick_spectrum()
        if kind == "width":
            self.width = _WIDTHS[(_WIDTHS.index(self.width) + 1) % len(_WIDTHS)]
            self.win.queue_draw(); return
        if kind == "zoom_in":
            cx, cy, cw, ch = self._canvas(); return self._zoom_at((cx + cw / 2, cy + ch / 2), 1.25)
        if kind == "zoom_out":
            cx, cy, cw, ch = self._canvas(); return self._zoom_at((cx + cw / 2, cy + ch / 2), 0.8)
        if kind == "zoom_fit":
            return self._reset_view()
        if kind == "undo":
            self.model.undo(); self.win.queue_draw(); return
        if kind == "file":
            return self._commit("file")
        if kind == "clipboard":
            return self._commit("clipboard")
        if kind == "cancel":
            return self._finish(None, None)
        if not self._in_canvas(ev.x, ev.y):
            # prazan deo top-trake → povuci ceo prozor
            if ev.y < _TOP_H:
                self.win.begin_move_drag(ev.button, int(ev.x_root), int(ev.y_root), ev.time)
            return
        if self.tool == "pan":
            self.pan_start = (ev.x, ev.y, self.off); return
        ip = self._to_img(ev.x, ev.y)
        if self.tool == "text":
            return self._ask_text(ip)
        if self.tool == "move":
            self.sel_obj = self._pick_object(ip); return
        if self.tool == "pen":
            self.drag = {"type": "pen", "pts": [ip]}
        else:
            self.drag = {"type": self.tool, "pts": [ip, ip]}

    def _on_motion(self, _w, ev):
        if self.pan_start is not None:
            sx, sy, so = self.pan_start
            self.off = (so[0] + (ev.x - sx), so[1] + (ev.y - sy)); self.win.queue_draw(); return
        if self.drag is None and self.sel_obj is None:
            hov = self._hit_test(ev.x, ev.y)
            hov = hov if hov[0] else None
            if hov != self._hover:
                self._hover = hov; self.win.queue_draw()
            return
        ip = self._to_img(ev.x, ev.y)
        if self.sel_obj is not None and self.tool == "move":
            self.model.move_object(self.sel_obj, ip[0], ip[1]); self.win.queue_draw(); return
        if self.drag is None:
            return
        if self.drag["type"] == "pen":
            self.drag["pts"].append(ip)
        else:
            self.drag["pts"][1] = ip
        self.win.queue_draw()

    def _on_scroll(self, _w, ev):
        if not self._in_canvas(ev.x, ev.y):
            return
        if ev.direction == Gdk.ScrollDirection.UP:
            self._zoom_at((ev.x, ev.y), 1.15)
        elif ev.direction == Gdk.ScrollDirection.DOWN:
            self._zoom_at((ev.x, ev.y), 1 / 1.15)
        elif ev.direction == Gdk.ScrollDirection.SMOOTH:
            ok, _dx, dy = ev.get_scroll_deltas()
            if ok and dy:
                self._zoom_at((ev.x, ev.y), 1.15 if dy < 0 else 1 / 1.15)

    def _on_release(self, _w, ev):
        if self.pan_start is not None:
            self.pan_start = None; return
        if self.sel_obj is not None:
            self.sel_obj = None; return
        if self.drag is None:
            return
        d = self.drag; self.drag = None
        if d["type"] == "crop":
            (x0, y0), (x1, y1) = d["pts"]
            self.model.set_crop((min(x0, x1), min(y0, y1), abs(x1 - x0), abs(y1 - y0)))
        else:
            self.model.add_shape({**d, "color": self.color, "width": self.width})
        self.win.queue_draw()

    def _on_key(self, _w, ev):
        k = Gdk.keyval_name(ev.keyval)
        ctrl = bool(ev.state & Gdk.ModifierType.CONTROL_MASK)
        if k == "Escape":
            return self._finish(None, None)
        if k in ("Return", "KP_Enter"):
            return self._commit("file")
        if ctrl and k in ("z", "Z"):
            self.model.undo(); self.win.queue_draw(); return
        if ctrl and k in ("c", "C"):
            r = self.model.crop or (0, 0, self.model.base.get_width(), self.model.base.get_height())
            self.model.copy_region(r); return
        if ctrl and k in ("v", "V"):
            idx = self.model.paste()
            if idx is not None:
                self.tool = "move"; self.sel_obj = idx
            self.win.queue_draw(); return
        if k in ("plus", "KP_Add", "equal"):
            cx, cy, cw, ch = self._canvas(); return self._zoom_at((cx + cw / 2, cy + ch / 2), 1.25)
        if k in ("minus", "KP_Subtract"):
            cx, cy, cw, ch = self._canvas(); return self._zoom_at((cx + cw / 2, cy + ch / 2), 0.8)
        if k in ("0", "KP_0"):
            return self._reset_view()

    # --- pomoćno ---
    def _pick_object(self, ip):
        for i in range(len(self.model.objects) - 1, -1, -1):
            o = self.model.objects[i]
            if o["x"] <= ip[0] <= o["x"] + o["pixbuf"].get_width() and \
               o["y"] <= ip[1] <= o["y"] + o["pixbuf"].get_height():
                return i
        return None

    def _pick_spectrum(self):
        dlg = Gtk.ColorChooserDialog(title="Boja", transient_for=self.win)
        dlg.set_keep_above(True)
        if dlg.run() == Gtk.ResponseType.OK:
            c = dlg.get_rgba()
            self.color = (c.red, c.green, c.blue, c.alpha)
        dlg.destroy()
        self.win.queue_draw()

    def _ask_text(self, ip):
        dlg = Gtk.Dialog(title=i18n.t("text_title"), transient_for=self.win, modal=True)
        dlg.set_keep_above(True); dlg.add_button(i18n.t("ok"), 1)
        e = Gtk.Entry(); e.set_activates_default(True)
        dlg.get_content_area().add(e); dlg.show_all()
        dlg.run(); s = e.get_text(); dlg.destroy()
        if s:
            self.model.add_shape({"type": "text", "color": self.color, "width": self.width,
                                  "pos": ip, "s": s})
            self.win.queue_draw()

    def _commit(self, action):
        pb = self.model.render()
        self._finish(pb, action)

    def _finish(self, pb, action):
        if self.finished:
            return
        self.finished = True
        self.win.destroy()
        self.on_done(pb, action)
