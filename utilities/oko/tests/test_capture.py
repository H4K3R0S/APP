#!/usr/bin/env python3
"""Capture čista matematika/imenovanje (bez pravog grab-a)."""
from pathlib import Path

from daemon import capture


def test_clamp_inside():
    assert capture.clamp_rect(10, 20, 100, 50, 1920, 1080) == (10, 20, 100, 50)


def test_clamp_overflow():
    x, y, w, h = capture.clamp_rect(1900, 1070, 500, 500, 1920, 1080)
    assert x + w <= 1920 and y + h <= 1080
    assert w >= 1 and h >= 1


def test_clamp_negative():
    assert capture.clamp_rect(-5, -5, 30, 30, 800, 600) == (0, 0, 30, 30)


def test_build_filename_ext():
    assert capture.build_filename({"format": "png", "filename_template": "shot"}).endswith(".png")
    assert capture.build_filename({"format": "jpg", "filename_template": "shot"}).endswith(".jpg")


def test_default_save_path_unique(tmp_path):
    cfg = {"save_dir": str(tmp_path), "format": "png", "filename_template": "oko"}
    p1 = capture.default_save_path(cfg)
    Path(p1).write_bytes(b"x")
    p2 = capture.default_save_path(cfg)
    assert p1 != p2
    assert str(p2).startswith(str(tmp_path))
