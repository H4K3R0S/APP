#!/usr/bin/env python3
"""Brava: dok je hvatanje u toku, novi run_capture se ignoriše (jedna instanca)."""
from daemon import capture_flow


def test_busy_blocks_second(monkeypatch):
    # simuliraj da je hvatanje već u toku
    monkeypatch.setattr(capture_flow, "_busy", True, raising=False)

    def boom():
        raise AssertionError("grab_root ne sme biti pozvan kad je busy")

    monkeypatch.setattr(capture_flow.capture, "grab_root", boom)

    got = {}
    capture_flow.run_capture("screen", on_result=lambda r: got.update(r or {}))
    assert got.get("busy") is True


def test_is_busy_reflects_flag(monkeypatch):
    monkeypatch.setattr(capture_flow, "_busy", False, raising=False)
    assert capture_flow.is_busy() is False
    monkeypatch.setattr(capture_flow, "_busy", True, raising=False)
    assert capture_flow.is_busy() is True
