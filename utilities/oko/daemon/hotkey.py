#!/usr/bin/env python3
"""Globalni hotkey preko python-xlib (XGrabKey na root). Radi u zasebnom threadu;
okidač se prosleđuje GTK main-loopu preko GLib.idle_add."""
from __future__ import annotations

import select
import threading
from typing import Callable

from gi.repository import GLib
from Xlib import X, XK, display

from . import util


class HotkeyListener:
    def __init__(self, on_trigger: Callable[[], None]):
        self._on_trigger = on_trigger
        self._disp = display.Display()
        self._disp.set_error_handler(self._x_error)  # async X greške ne ruše app
        self._root = self._disp.screen().root
        self._root.change_attributes(event_mask=X.KeyPressMask)
        self._keycode: int | None = None
        # Sekundarni (opcioni) taster: trenutni AI-cache okidač, sa svojim callback-om.
        self._sec_code: int | None = None
        self._sec_cb: Callable[[], None] | None = None
        # NumLock (Mod2) / CapsLock (Lock) varijante — da grab radi u svim stanjima.
        self._mod_masks = [0, X.LockMask, X.Mod2Mask, X.LockMask | X.Mod2Mask]
        self._running = False
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def _keycode_for(self, name: str) -> int | None:
        keysym = XK.string_to_keysym(name)
        if not keysym:
            return None
        code = self._disp.keysym_to_keycode(keysym)
        return code or None

    @staticmethod
    def _x_error(err, _req=None):  # tihi handler (npr. BadAccess kad je taster već zauzet)
        util.log(f"X greška (ignorisano): {err}")

    def _grab(self, keycode: int) -> None:
        for m in self._mod_masks:
            self._root.grab_key(keycode, m, True, X.GrabModeAsync, X.GrabModeAsync)
        self._disp.sync()

    def _ungrab_code(self, keycode: int | None) -> None:
        if keycode is not None:
            for m in self._mod_masks:
                self._root.ungrab_key(keycode, m)
            self._disp.sync()

    def _ungrab(self) -> None:
        self._ungrab_code(self._keycode)

    def set_key(self, name: str) -> bool:
        """Prebaci grab na novi taster. Vrati True ako uspešno."""
        code = self._keycode_for(name)
        if code is None:
            util.notify("OKO", f"nepoznat taster: {name}")
            return False
        with self._lock:
            self._ungrab()
            self._keycode = code
            self._grab(code)
        util.log(f"hotkey postavljen: {name} (keycode {code})")
        return True

    def set_secondary(self, name: str, callback: Callable[[], None] | None = None) -> bool:
        """Registruj/promeni opcioni drugi taster (npr. trenutni AI-cache).

        `name` prazno → ukloni sekundarni grab. Vrati True ako je stanje primenjeno.
        """
        with self._lock:
            self._ungrab_code(self._sec_code)
            self._sec_code = None
            name = (name or "").strip()
            if not name:
                self._sec_cb = None
                util.log("sekundarni hotkey uklonjen")
                return True
            code = self._keycode_for(name)
            if code is None:
                self._sec_cb = None
                util.notify("OKO", f"nepoznat taster: {name}")
                return False
            if callback is not None:
                self._sec_cb = callback
            self._sec_code = code
            self._grab(code)
        util.log(f"sekundarni hotkey postavljen: {name} (keycode {code})")
        return True

    def start(self, name: str) -> bool:
        if not self.set_key(name):
            return False
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        return True

    def _loop(self) -> None:
        fd = self._disp.fileno()
        while self._running:
            ready, _, _ = select.select([fd], [], [], 0.5)
            if not ready:
                continue
            for _ in range(self._disp.pending_events()):
                ev = self._disp.next_event()
                if ev.type != X.KeyPress:
                    continue
                if ev.detail == self._keycode:
                    GLib.idle_add(self._on_trigger)
                elif ev.detail == self._sec_code and self._sec_cb is not None:
                    GLib.idle_add(self._sec_cb)

    def stop(self) -> None:
        self._running = False
        with self._lock:
            self._ungrab()
            self._ungrab_code(self._sec_code)
