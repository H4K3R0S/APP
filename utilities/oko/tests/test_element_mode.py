#!/usr/bin/env python3
"""Element-mod na Insert: PID→pick→rect→crop, cancel=tih, no-waiter=region fallback."""
import pytest

from daemon import capture_flow


@pytest.fixture(autouse=True)
def _reset_busy():
    # Neki testovi monkeypatch-uju _apply_action pa `finish` ne oslobodi bravu;
    # resetuj globalni _busy pre svakog testa (izolacija).
    capture_flow._busy = False
    yield
    capture_flow._busy = False


class FakePick:
    def __init__(self, pid, result):
        self._pid = pid
        self._result = result
        self.requested = None

    def request(self, pid):
        self.requested = pid
        return "rid" if pid == self._pid else None

    def await_result(self, rid, on_rect, on_cancel, on_timeout):
        # sinhrono u testu (u produkciji: worker-nit + GLib.idle_add)
        res = self._result
        if res and res.get("rect"):
            on_rect(res["rect"])
        elif res and res.get("cancel"):
            on_cancel()
        else:
            on_timeout()


def _fake_pixbuf(monkeypatch):
    class PB:
        crop = None

        def get_width(self):
            return 1000

        def get_height(self):
            return 800

        def new_subpixbuf(self, x, y, w, h):
            PB.crop = (x, y, w, h)
            return self

    monkeypatch.setattr(capture_flow.capture, "grab_root", lambda: PB())
    return PB


def test_element_crop(monkeypatch):
    PB = _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    captured = {}
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda region, action, **k: captured.setdefault("done", (action,)))
    pick = FakePick(42, {"rect": {"x": 10, "y": 20, "w": 100, "h": 50}})
    capture_flow.run_capture("region", interactive=True, pick=pick, dest="file")
    assert PB.crop == (10, 20, 100, 50)
    assert "done" in captured


def test_no_waiter_falls_back(monkeypatch):
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    shown = {}
    monkeypatch.setattr(capture_flow, "RegionSelector",
                        lambda pb, done, origin=(0, 0): shown.setdefault("region", True))
    monkeypatch.setattr(capture_flow.capture, "current_monitor_rect", lambda: (0, 0, 1000, 800))
    pick = FakePick(999, {"rect": {"x": 1, "y": 1, "w": 1, "h": 1}})  # ne poklapa pid
    capture_flow.run_capture("region", interactive=True, pick=pick)
    assert shown.get("region")


def test_pick_cancel(monkeypatch):
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("ne sme se hvatati na cancel")))
    got = {}
    pick = FakePick(42, {"cancel": True})
    capture_flow.run_capture("region", interactive=True, pick=pick,
                             on_result=lambda r: got.setdefault("r", r))
    assert got.get("r") is None


def test_element_pick_disabled(monkeypatch):
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    monkeypatch.setattr(capture_flow.config, "load",
                        lambda: {**capture_flow.config.DEFAULTS, "element_pick": False})
    shown = {}
    monkeypatch.setattr(capture_flow, "RegionSelector",
                        lambda pb, done, origin=(0, 0): shown.setdefault("region", True))
    monkeypatch.setattr(capture_flow.capture, "current_monitor_rect", lambda: (0, 0, 1000, 800))
    pick = FakePick(42, {"rect": {"x": 1, "y": 1, "w": 1, "h": 1}})
    capture_flow.run_capture("region", interactive=True, pick=pick)
    assert shown.get("region")  # element isključen → region


def test_element_opens_editor(monkeypatch):
    # Element/sekcija hvatanje otvara ISTI providni editor (ne zaseban save-prozor).
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    opened = {}
    monkeypatch.setattr(capture_flow, "AnnotationEditor",
                        lambda pb, on_done: (opened.setdefault("yes", True), on_done(pb, "clipboard")))
    chosen = {}
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda region, action, **k: chosen.setdefault("a", action))
    pick = FakePick(42, {"rect": {"x": 1, "y": 2, "w": 3, "h": 4}})
    capture_flow.run_capture("region", interactive=True, pick=pick)
    assert opened.get("yes") and chosen.get("a") == "clipboard"


def test_element_editor_cancel(monkeypatch):
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    monkeypatch.setattr(capture_flow, "AnnotationEditor",
                        lambda pb, on_done: on_done(None, None))  # otkaz u editoru
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("ne sme hvatati na otkaz")))
    got = {}
    pick = FakePick(42, {"rect": {"x": 1, "y": 2, "w": 3, "h": 4}})
    capture_flow.run_capture("region", interactive=True, pick=pick, on_result=lambda r: got.setdefault("r", r))
    assert got.get("r") is None


def test_element_dest_bypasses_editor(monkeypatch):
    # IPC forsiran cilj (dest) → direktno, bez editora.
    PB = _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    monkeypatch.setattr(capture_flow, "AnnotationEditor",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("dest ne sme otvarati editor")))
    chosen = {}
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda region, action, **k: chosen.setdefault("a", action))
    pick = FakePick(42, {"rect": {"x": 1, "y": 2, "w": 3, "h": 4}})
    capture_flow.run_capture("region", interactive=True, pick=pick, dest="file")
    assert chosen.get("a") == "file"


def test_force_element_overrides_disabled(monkeypatch):
    # element_pick=False, ali trenutni AI-cache okidač (force_element=True) → ipak element-birač
    PB = _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 42)
    monkeypatch.setattr(capture_flow.config, "load",
                        lambda: {**capture_flow.config.DEFAULTS, "element_pick": False})
    captured = {}
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda region, action, **k: captured.setdefault("done", action))
    pick = FakePick(42, {"rect": {"x": 5, "y": 6, "w": 30, "h": 40}})
    capture_flow.run_capture("region", interactive=True, pick=pick, dest="file",
                             force_element=True)
    assert PB.crop == (5, 6, 30, 40)   # element-crop se desio uprkos element_pick=False
    assert captured.get("done") == "file"


def test_region_edit_opens_editor(monkeypatch):
    PB = _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 0)  # nema element pick
    monkeypatch.setattr(capture_flow.capture, "current_monitor_rect", lambda: (0, 0, 1000, 800))
    monkeypatch.setattr(capture_flow, "RegionSelector",
                        lambda pb, done, origin=(0, 0): done((1, 2, 10, 10), "edit"))
    opened = {}

    class FakeEditor:
        def __init__(self, pb, on_done):
            opened["yes"] = True         # centriran editor nad isečkom
            on_done(pb, "clipboard")     # simuliraj Sačuvaj u clipboard

    monkeypatch.setattr(capture_flow, "AnnotationEditor", FakeEditor)
    applied = {}
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda region, action, **k: applied.setdefault("a", action))
    capture_flow.run_capture("region", interactive=True)
    assert opened.get("yes") and applied.get("a") == "clipboard"


def test_region_edit_cancel(monkeypatch):
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 0)
    monkeypatch.setattr(capture_flow.capture, "current_monitor_rect", lambda: (0, 0, 1000, 800))
    monkeypatch.setattr(capture_flow, "RegionSelector",
                        lambda pb, done, origin=(0, 0): done((1, 2, 10, 10), "edit"))
    monkeypatch.setattr(capture_flow, "AnnotationEditor",
                        lambda pb, on_done: on_done(None, None))  # otkaz
    monkeypatch.setattr(capture_flow, "_apply_action",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("otkaz ne hvata")))
    got = {}
    capture_flow.run_capture("region", interactive=True, on_result=lambda r: got.setdefault("r", r))
    assert got.get("r") is None


def test_region_edit_editor_throws_releases_busy(monkeypatch):
    # Ako AnnotationEditor pukne kad se "Uredi" klikne (GTK signal callback IZVAN
    # konstrukcije), _busy se mora osloboditi — inače daemon zaglavi na {"busy": True}.
    _fake_pixbuf(monkeypatch)
    monkeypatch.setattr(capture_flow.capture, "active_window_pid", lambda: 0)
    monkeypatch.setattr(capture_flow.capture, "current_monitor_rect", lambda: (0, 0, 1000, 800))
    holder = {}
    # Realno: RegionSelector NE zove done pri konstrukciji; čuva ga za kasniji klik.
    monkeypatch.setattr(capture_flow, "RegionSelector",
                        lambda pb, done, origin=(0, 0): holder.__setitem__("done", done))

    def boom(*a, **k):
        raise RuntimeError("gtk fail")

    monkeypatch.setattr(capture_flow, "AnnotationEditor", boom)
    got = {}
    capture_flow.run_capture("region", interactive=True, on_result=lambda r: got.setdefault("r", r))
    holder["done"]((1, 2, 10, 10), "edit")               # klik "Uredi" KASNIJE, van try-a
    assert capture_flow.is_busy() is False               # brava oslobođena
    assert got.get("r") and "error" in got["r"]          # rezultat = greška
