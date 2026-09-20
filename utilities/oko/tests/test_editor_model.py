#!/usr/bin/env python3
"""Editor model: geometrija, oblici/undo, crop, copy/paste, render (headless)."""
import gi

gi.require_version("GdkPixbuf", "2.0")
from gi.repository import GdkPixbuf  # noqa: E402

from daemon import editor_model as em


def _pb(w=40, h=30):
    # neproziran RGBA pixbuf u memoriji (bez ekrana)
    pb = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, True, 8, w, h)
    pb.fill(0x3366ffff)
    return pb


def test_fit_scale():
    assert em.fit_scale(100, 100, 1400, 900) == 1.0        # manja → ne uvećava
    assert em.fit_scale(2800, 900, 1400, 900) == 0.5       # široka → skala po širini
    assert 0 < em.fit_scale(1400, 1800, 1400, 900) <= 0.5  # visoka → po visini


def test_view_image_roundtrip():
    p = (123.0, 77.0)
    back = em.image_to_view(em.view_to_image(p, 0.5, (10, 20)), 0.5, (10, 20))
    assert abs(back[0] - p[0]) < 1e-6 and abs(back[1] - p[1]) < 1e-6


def test_add_and_undo():
    m = em.EditorModel(_pb())
    m.add_shape({"type": "pen", "color": (1, 0, 0, 1), "width": 3, "pts": [(1, 1), (2, 2)]})
    m.add_shape({"type": "rect", "color": (0, 1, 0, 1), "width": 2, "pts": [(0, 0), (5, 5)]})
    assert len(m.shapes) == 2
    m.undo()
    assert len(m.shapes) == 1
    m.undo()
    assert len(m.shapes) == 0
    m.undo()  # prazan stek → no-op
    assert len(m.shapes) == 0


def test_crop_clamped():
    m = em.EditorModel(_pb(40, 30))
    m.set_crop((-5, -5, 1000, 1000))     # van granica → klamp na (0,0,40,30)
    assert m.crop == (0, 0, 40, 30)
    m.set_crop((0, 0, 0, 0))             # degenerisan → None
    assert m.crop is None


def test_copy_paste_object():
    m = em.EditorModel(_pb(40, 30))
    assert m.paste() is None             # bez copy → no-op
    m.copy_region((0, 0, 10, 10))
    idx = m.paste()
    assert idx == 0 and len(m.objects) == 1
    assert (m.objects[0]["x"], m.objects[0]["y"]) == (0, 0)   # na 0,0
    m.move_object(0, 5, 7)
    assert (m.objects[0]["x"], m.objects[0]["y"]) == (5, 7)
    m.undo()                             # skloni paste
    assert len(m.objects) == 0


def test_render_smoke():
    m = em.EditorModel(_pb(40, 30))
    m.add_shape({"type": "arrow", "color": (1, 0, 0, 1), "width": 3, "pts": [(2, 2), (30, 20)]})
    m.add_shape({"type": "text", "color": (1, 1, 1, 1), "width": 2, "pos": (5, 15), "s": "AB"})
    out = m.render()
    assert out.get_width() == 40 and out.get_height() == 30   # bez kropa = veličina baze


def test_crop_changes_output_size():
    m = em.EditorModel(_pb(40, 30))
    m.set_crop((5, 5, 20, 10))
    out = m.render()
    assert out.get_width() == 20 and out.get_height() == 10


def test_render_object_offscreen():
    m = em.EditorModel(_pb(40, 30))
    m.copy_region((0, 0, 20, 20))
    m.paste(); m.move_object(0, 35, 25)   # delimično van → ne sme da baci
    out = m.render()
    assert out.get_width() == 40


def test_preview_size():
    from daemon import save_dialog
    assert save_dialog._preview_size(480, 240, box=240) == (240, 120)   # skala 0.5
    assert save_dialog._preview_size(100, 50, box=240) == (100, 50)     # manja → ista


def test_zoom_helpers():
    # offset takav da img tačka ostane pod istom view tačkom pri novoj skali
    off = em.offset_keeping((300, 200), (50, 40), 2.0)
    back = em.view_to_image((300, 200), 2.0, off)
    assert abs(back[0] - 50) < 1e-6 and abs(back[1] - 40) < 1e-6
    assert em.clamp_zoom(0.001) == 0.1 and em.clamp_zoom(999) == 8.0
    assert em.clamp_zoom(1.5) == 1.5
