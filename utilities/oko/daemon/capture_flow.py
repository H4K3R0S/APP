#!/usr/bin/env python3
"""Orkestracija hvatanja: mod → (overlay/geometrija) → akcija (fajl/clipboard) → snimi/kopiraj.

Pozivaju ga hotkey i IPC. Sva GUI dešavanja idu kroz GTK main-loop (pozivati iz main threada;
IPC/hotkey koriste GLib.idle_add). `on_result(dict|None)` — None = otkazano.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from . import capture, clipboard, config, domain_detect, save_dialog, state, util
from .editor_overlay import AnnotationEditor
from .region_overlay import RegionSelector

Result = dict[str, Any]
OnResult = Callable[[Result | None], None]

# Samo JEDNO hvatanje u toku (Insert/tray/IPC ne smeju otvoriti drugu instancu).
_busy = False


def is_busy() -> bool:
    return _busy


def run_capture(mode: str, *, dest: str | None = None, path: str | None = None,
                interactive: bool = True, on_result: OnResult | None = None,
                pick=None, force_element: bool = False) -> None:
    global _busy
    raw_on_result = on_result or (lambda _r: None)

    if _busy:
        util.log("run_capture: već u toku — ignorisano")
        return raw_on_result({"busy": True})

    cfg = config.load()
    domain, _title, _ = domain_detect.detect()

    def finish(r):
        """Jedina izlazna tačka — oslobodi bravu pa prosledi rezultat."""
        global _busy
        _busy = False
        raw_on_result(r)

    def apply(region, action: str) -> None:
        _apply_action(region, action, mode=mode, domain=domain, cfg=cfg,
                      path=path, interactive=interactive, on_result=finish)

    def _open_editor(crop) -> None:
        """Centriran providni editor nad isečkom; rezultat → akcija. Hvata pad
        konstrukcije da _busy ne iscuri (poziva se iz GTK signala/worker-marshala)."""
        def on_edit(pb2, act):
            if pb2 is None or act is None:
                return finish(None)
            apply(pb2, act)
        try:
            AnnotationEditor(crop, on_edit)
        except Exception as exc:
            util.notify("OKO greška", f"editor: {exc}")
            finish({"error": f"editor: {exc}"})

    _busy = True
    try:
        pb = capture.grab_root()
    except Exception as exc:  # grab pao
        util.notify("OKO greška", f"grab: {exc}")
        return finish({"error": f"grab: {exc}"})

    if mode == "region":
        if not interactive:
            return finish({"error": "region zahteva interakciju (koristi window/screen)"})

        def _do_region():
            # Region overlay samo na monitoru pod mišem (fallback i default).
            mx, my, mw, mh = capture.current_monitor_rect()
            pb_mon = capture.crop(pb, mx, my, mw, mh)

            def done(rect, picked):
                if not rect:
                    return finish(None)
                if picked == "edit":
                    return _open_editor(capture.crop(pb_mon, *rect))
                action = dest or picked or _default_action(cfg)
                apply(capture.crop(pb_mon, *rect), action)

            try:
                RegionSelector(pb_mon, done, origin=(mx, my))
            except Exception as exc:  # overlay pao → oslobodi bravu
                util.notify("OKO greška", f"overlay: {exc}")
                finish({"error": f"overlay: {exc}"})

        # Element-mod: ako je fokusirana NAŠA cell-shell app (registrovan pick-čekač
        # po PID-u), predaj joj biranje. NE-BLOKIRAJUĆE: hook čeka rezultat na worker-niti
        # i marshaluje nazad (main-loop ostaje slobodan). Kill-switch: cfg element_pick.
        if pick is not None and (force_element or cfg.get("element_pick", True)):
            _pid = capture.active_window_pid()
            _rid = pick.request(_pid) if _pid else None
            if _rid:
                def _on_rect(r):
                    try:
                        if not (r and all(k in r for k in ("x", "y", "w", "h"))):
                            return _do_region()  # nevalidan rect → region
                        crop = capture.crop(pb, r["x"], r["y"], r["w"], r["h"])
                        if dest:  # IPC forsiran cilj → direktno (bez editora)
                            return apply(crop, dest)
                        _open_editor(crop)  # isti providni editor kao region „Uredi"
                    except Exception as exc:  # ne curi _busy
                        finish({"error": f"element crop: {exc}"})

                pick.await_result(_rid, on_rect=_on_rect,
                                  on_cancel=lambda: finish(None),
                                  on_timeout=_do_region)
                return

        _do_region()
        return

    if mode == "window":
        rect = capture.active_window_rect()
        region = capture.crop(pb, *rect) if rect else pb
    elif mode == "screen":
        # Ceo monitor pod mišem (ne oba ekrana).
        region = capture.crop(pb, *capture.current_monitor_rect())
    else:
        return finish({"error": f"nepoznat mod: {mode}"})

    action = dest or (_default_action(cfg) if interactive else "file")
    apply(region, action)


def _default_action(cfg: dict[str, Any]) -> str:
    a = cfg.get("after_select", "ask")
    return "file" if a == "ask" else a


def _apply_action(region, action: str, *, mode, domain, cfg, path, interactive, on_result):
    size = (region.get_width(), region.get_height())
    if action == "clipboard":
        try:
            clipboard.copy_pixbuf(region)
        except Exception as exc:
            util.notify("OKO greška", f"clipboard: {exc}")
            return on_result({"error": f"clipboard: {exc}"})
        rec = state.record(dest="clipboard", path=None, mode=mode, domain=domain, size=size)
        util.notify("OKO → clipboard", f"{size[0]}×{size[1]}" + (f" · {domain}" if domain else ""))
        return on_result(rec)

    # action == "file"
    if path:
        target = path
    elif interactive and dest_is_ask(cfg):
        target = save_dialog.ask_save_path(cfg, preview_pixbuf=region)
    else:
        target = str(capture.default_save_path(cfg))
    if not target:
        return on_result(None)  # otkazan dijalog
    try:
        saved = capture.save_pixbuf(region, target, cfg)
    except Exception as exc:
        util.notify("OKO greška", f"snimanje: {exc}")
        return on_result({"error": f"snimanje: {exc}"})
    rec = state.record(dest="file", path=saved, mode=mode, domain=domain, size=size)
    util.notify("OKO → sačuvano", Path(saved).name + (f" · {domain}" if domain else ""))
    on_result(rec)


def dest_is_ask(cfg: dict[str, Any]) -> bool:
    """Da li fajl-akciju treba potvrditi kroz 'explorer' (kad korisnik interaktivno bira)."""
    return cfg.get("after_select", "ask") == "ask"
