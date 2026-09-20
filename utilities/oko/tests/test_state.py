#!/usr/bin/env python3
"""State: record → last (memorija) + reload sa diska."""
import importlib

from daemon import state as state_mod


def test_record_and_last():
    importlib.reload(state_mod)  # čist memorijski keš
    state_mod.record(dest="file", path="/tmp/a.png", mode="region", domain="filmium", size=(100, 50))
    last = state_mod.last()
    assert last["path"] == "/tmp/a.png"
    assert last["domain"] == "filmium"
    assert last["size"] == [100, 50]


def test_last_reads_disk_after_reset():
    importlib.reload(state_mod)
    state_mod.record(dest="clipboard", path=None, mode="screen", domain=None)
    state_mod._last = None  # obriši memoriju → mora sa diska
    last = state_mod.last()
    assert last["dest"] == "clipboard"
    assert last["mode"] == "screen"
