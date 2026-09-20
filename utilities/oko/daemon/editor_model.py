#!/usr/bin/env python3
"""Editor model: stanje anotacija + geometrija + render. BEZ Gtk (headless-testabilno)."""
from __future__ import annotations

from typing import Any

import cairo
import gi

gi.require_version("GdkPixbuf", "2.0")
gi.require_version("Gdk", "3.0")
from gi.repository import Gdk, GdkPixbuf  # noqa: E402


def fit_scale(iw: int, ih: int, max_w: int, max_h: int) -> float:
    """Skala (≤1) da slika stane u max okvir; ne uvećava."""
    if iw <= 0 or ih <= 0:
        return 1.0
    return min(1.0, max_w / iw, max_h / ih)


def view_to_image(pt: tuple, scale: float, offset: tuple = (0, 0)) -> tuple:
    """Ekran(pregled)→slika: oduzmi offset radne zone pa podeli skalom."""
    return ((pt[0] - offset[0]) / scale, (pt[1] - offset[1]) / scale)


def image_to_view(pt: tuple, scale: float, offset: tuple = (0, 0)) -> tuple:
    return (pt[0] * scale + offset[0], pt[1] * scale + offset[1])


def offset_keeping(view_pt: tuple, img_pt: tuple, scale: float) -> tuple:
    """Pan-offset takav da `img_pt` ostane tačno ispod `view_pt` pri datoj skali.
    Koristi zoom „na tački pod kursorom"."""
    return (view_pt[0] - img_pt[0] * scale, view_pt[1] - img_pt[1] * scale)


def clamp_zoom(z: float, lo: float = 0.1, hi: float = 8.0) -> float:
    return max(lo, min(hi, z))


class EditorModel:
    """Baza (pixbuf) + anotacije + nalepljeni objekti + crop + interni clip. Undo stek."""

    def __init__(self, base: GdkPixbuf.Pixbuf):
        self.base = base
        self.shapes: list[dict[str, Any]] = []
        self.objects: list[dict[str, Any]] = []   # {pixbuf, x, y}
        self.crop: tuple | None = None            # (x,y,w,h) u px slike
        self.clip: GdkPixbuf.Pixbuf | None = None
        self._undo: list[tuple[str, Any]] = []    # (vrsta, podatak) za povratak

    def add_shape(self, shape: dict) -> None:
        self.shapes.append(shape)
        self._undo.append(("shape", shape))

    def undo(self) -> None:
        if not self._undo:
            return
        kind, data = self._undo.pop()
        if kind == "shape":
            if self.shapes:
                self.shapes.pop()
        elif kind == "object":
            if data in self.objects:
                self.objects.remove(data)
        elif kind == "crop":
            self.crop = data  # prethodni crop (ili None)

    def _clamp_rect(self, rect: tuple, w: int, h: int) -> tuple | None:
        x, y, rw, rh = rect
        x0 = max(0, min(int(x), w)); y0 = max(0, min(int(y), h))
        x1 = max(0, min(int(x + rw), w)); y1 = max(0, min(int(y + rh), h))
        cw, ch = x1 - x0, y1 - y0
        return (x0, y0, cw, ch) if cw > 0 and ch > 0 else None

    def set_crop(self, rect: tuple | None) -> None:
        prev = self.crop
        self.crop = (self._clamp_rect(rect, self.base.get_width(), self.base.get_height())
                     if rect else None)
        self._undo.append(("crop", prev))

    def clear_crop(self) -> None:
        self.set_crop(None)

    def copy_region(self, rect: tuple) -> None:
        r = self._clamp_rect(rect, self.base.get_width(), self.base.get_height())
        if r is None:
            return
        self.clip = self._render_pixbuf().new_subpixbuf(*r)  # kopira TRENUTNI izgled

    def paste(self) -> int | None:
        if self.clip is None:
            return None
        obj = {"pixbuf": self.clip, "x": 0, "y": 0}   # nalepi na 0,0
        self.objects.append(obj)
        self._undo.append(("object", obj))
        return len(self.objects) - 1

    def move_object(self, idx: int, x: float, y: float) -> None:
        if 0 <= idx < len(self.objects):
            self.objects[idx]["x"] = x
            self.objects[idx]["y"] = y

    def _surface_from_base(self) -> cairo.ImageSurface:
        w, h = self.base.get_width(), self.base.get_height()
        surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
        cr = cairo.Context(surface)
        Gdk.cairo_set_source_pixbuf(cr, self.base, 0, 0)
        cr.paint()
        for obj in self.objects:
            Gdk.cairo_set_source_pixbuf(cr, obj["pixbuf"], obj["x"], obj["y"])
            cr.paint()
        for sh in self.shapes:
            self._draw_shape(cr, sh)
        surface.flush()
        return surface

    def _render_pixbuf(self) -> GdkPixbuf.Pixbuf:
        """Ceo izgled (baza+objekti+oblici), BEZ kropa — koristi i copy_region."""
        surface = self._surface_from_base()
        return Gdk.pixbuf_get_from_surface(surface, 0, 0,
                                           self.base.get_width(), self.base.get_height())

    def render(self) -> GdkPixbuf.Pixbuf:
        full = self._render_pixbuf()
        if self.crop:
            x, y, w, h = self.crop
            return full.new_subpixbuf(x, y, w, h)
        return full

    def _draw_shape(self, cr: cairo.Context, sh: dict) -> None:
        cr.set_source_rgba(*sh.get("color", (1, 0, 0, 1)))
        cr.set_line_width(sh.get("width", 3))
        cr.set_line_cap(cairo.LINE_CAP_ROUND)
        cr.set_line_join(cairo.LINE_JOIN_ROUND)
        t = sh.get("type")
        if t == "pen":
            pts = sh.get("pts", [])
            if pts:
                cr.move_to(*pts[0])
                for p in pts[1:]:
                    cr.line_to(*p)
                cr.stroke()
        elif t in ("line", "arrow"):
            (x0, y0), (x1, y1) = sh["pts"][0], sh["pts"][1]
            cr.move_to(x0, y0); cr.line_to(x1, y1); cr.stroke()
            if t == "arrow":
                self._arrow_head(cr, x0, y0, x1, y1, sh.get("width", 3))
        elif t == "rect":
            (x0, y0), (x1, y1) = sh["pts"][0], sh["pts"][1]
            cr.rectangle(min(x0, x1), min(y0, y1), abs(x1 - x0), abs(y1 - y0)); cr.stroke()
        elif t == "ellipse":
            (x0, y0), (x1, y1) = sh["pts"][0], sh["pts"][1]
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            rx, ry = abs(x1 - x0) / 2 or 1, abs(y1 - y0) / 2 or 1
            cr.save(); cr.translate(cx, cy); cr.scale(rx, ry)
            cr.arc(0, 0, 1, 0, 2 * 3.141592653589793); cr.restore(); cr.stroke()
        elif t == "text":
            cr.select_font_face("Sans")
            cr.set_font_size(max(10, sh.get("width", 3) * 6))
            cr.move_to(*sh.get("pos", (0, 0)))
            cr.show_text(sh.get("s", ""))

    @staticmethod
    def _arrow_head(cr: cairo.Context, x0, y0, x1, y1, width) -> None:
        import math
        ang = math.atan2(y1 - y0, x1 - x0)
        size = max(8, width * 3)
        for da in (math.radians(150), math.radians(-150)):
            cr.move_to(x1, y1)
            cr.line_to(x1 + size * math.cos(ang + da), y1 + size * math.sin(ang + da))
        cr.stroke()
