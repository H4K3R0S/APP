#!/usr/bin/env python3
"""OKO daemon — sklapa hotkey + IPC + tray i vrti GTK main-loop.

Kontroler marshaluje capture na GTK main thread (GUI mora tamo); IPC/hotkey pozivaju
preko GLib.idle_add. Single-instance lock štiti da samo jedan daemon drži taster.
"""
from __future__ import annotations

import fcntl
import os
import signal
import subprocess
import sys
import threading

import gi

gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk  # noqa: E402

from . import capture_flow, config, i18n, state, util
from .hotkey import HotkeyListener
from .ipc import IPCServer
from .pick_registry import PickRegistry
from .settings_window import SettingsWindow
from .tray import Tray


class Controller:
    def __init__(self):
        self.hotkey = HotkeyListener(self._on_hotkey)
        self.ipc: IPCServer | None = None
        self.tray: Tray | None = None
        self.settings_win = SettingsWindow(self)
        self.picks = PickRegistry()  # element-mod: cell-shell long-poll čekači

    # --- hotkey / tray akcije (već na main threadu ili preko idle_add) ---
    def _on_hotkey(self) -> bool:
        cfg = config.load()
        capture_flow.run_capture(cfg.get("mode", "region"), interactive=True,
                                 pick=self._pick_hook())
        return False  # GLib.idle_add: ne ponavljaj

    def _on_hotkey_ai_cache(self) -> bool:
        """Trenutni AI-cache: forsira element-birač i kad je „AI Windows Cache" isključen."""
        cfg = config.load()
        capture_flow.run_capture(cfg.get("mode", "region"), interactive=True,
                                 pick=self._pick_hook(), force_element=True)
        return False

    def _pick_hook(self):
        """Most ka PickRegistry za capture_flow. `await_result` NE blokira GTK main-loop:
        čeka rezultat na worker-niti pa marshaluje callback nazad preko GLib.idle_add."""
        reg = self.picks

        class _Hook:
            def request(self, pid):
                return reg.request_pick(pid) if pid else None

            def await_result(self, rid, on_rect, on_cancel, on_timeout):
                def worker():
                    res = reg.get_result(rid, timeout=20.0)  # off-main-thread

                    def on_main():
                        if res and res.get("rect"):
                            on_rect(res["rect"])
                        elif res and res.get("cancel"):
                            on_cancel()
                        else:
                            on_timeout()
                        return False

                    GLib.idle_add(on_main)

                threading.Thread(target=worker, daemon=True).start()

        return _Hook()

    # --- IPC: element-mod (cell-shell) ---
    def pick_wait(self, pid):
        res = self.picks.wait_for_pick(pid)
        if res.get("action") == "pick":
            # prosledi cell-shell-u koji taster koristi kao „otkaz" u overlay-u
            res["cancel_key"] = config.load().get("hotkey_cancel", "Escape")
        return res

    def pick_result(self, request_id, payload):
        self.picks.submit_result(request_id, payload)
        return {"ok": True}

    def capture(self, mode: str) -> None:
        """Fire-and-forget iz tray-a (na main threadu)."""
        capture_flow.run_capture(mode, interactive=True)

    # --- IPC kontroler API ---
    def capture_sync(self, *, mode, dest, path, interactive):
        """Blokira dok capture ne završi (marshal na main thread). Za region čeka korisnika."""
        done = threading.Event()
        holder: dict = {}

        def go():
            capture_flow.run_capture(
                mode, dest=dest, path=path, interactive=interactive,
                on_result=lambda r: (holder.__setitem__("r", r), done.set()),
            )
            return False

        GLib.idle_add(go)
        if not done.wait(timeout=180):
            return {"error": "timeout"}
        return holder.get("r")

    def last(self):
        return state.last()

    def settings_get(self):
        return config.load()

    def settings_set(self, changes: dict):
        old = config.load()
        cfg = config.update(**dict(changes or {}))
        if cfg.get("hotkey") != old.get("hotkey"):
            GLib.idle_add(lambda: (self.hotkey.set_key(cfg["hotkey"]), False)[1])
        if cfg.get("hotkey_ai_cache") != old.get("hotkey_ai_cache"):
            GLib.idle_add(lambda: (self.hotkey.set_secondary(
                cfg.get("hotkey_ai_cache", ""), self._on_hotkey_ai_cache), False)[1])
        i18n.set_lang(cfg.get("lang", "en"))
        _sync_autostart(cfg.get("autostart", False))
        return cfg

    def health(self):
        cfg = config.load()
        return {"ok": True, "hotkey": cfg["hotkey"], "mode": cfg["mode"],
                "port": cfg["ipc_port"], "pid": os.getpid()}

    def open_settings(self):
        """Otvori mali nativni GTK prozor sa podešavanjima (na main threadu)."""
        GLib.idle_add(lambda: (self.settings_win.show(), False)[1])

    def quit(self):
        util.log("izlaz")
        self.hotkey.stop()
        if self.ipc:
            self.ipc.stop()
        Gtk.main_quit()


def _sync_autostart(enabled: bool) -> None:
    """Ukey/enable systemd --user servis prema config-u (best-effort)."""
    action = "enable" if enabled else "disable"
    try:
        subprocess.run(["systemctl", "--user", action, "--now", "oko.service"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=5)
    except (OSError, subprocess.SubprocessError):
        pass


def _acquire_lock():
    config.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    fh = open(config.LOCK_PATH, "w")
    try:
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return None
    fh.write(str(os.getpid()))
    fh.flush()
    return fh


def main() -> int:
    lock = _acquire_lock()
    if lock is None:
        print("OKO već radi (lock zauzet).", file=sys.stderr)
        return 1

    cfg = config.load()
    i18n.set_lang(cfg.get("lang", "en"))
    ctl = Controller()
    ctl.ipc = IPCServer(ctl, cfg["ipc_port"])
    ctl.ipc.start()
    if not ctl.hotkey.start(cfg["hotkey"]):
        util.notify("OKO", f"hotkey '{cfg['hotkey']}' nije uspeo — koristi tray/IPC")
    if cfg.get("hotkey_ai_cache"):
        ctl.hotkey.set_secondary(cfg["hotkey_ai_cache"], ctl._on_hotkey_ai_cache)
    ctl.tray = Tray(ctl)

    signal.signal(signal.SIGINT, lambda *_: ctl.quit())
    signal.signal(signal.SIGTERM, lambda *_: ctl.quit())
    util.log(f"OKO start (port {cfg['ipc_port']}, hotkey {cfg['hotkey']}, mode {cfg['mode']})")
    Gtk.main()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
