#!/usr/bin/env python3
"""Domen-detekcija: čista classify() nad naslovom/WM_CLASS."""
import pytest

from daemon.domain_detect import classify


@pytest.mark.parametrize("title,wm,expected", [
    ("FILMIUM — Kurator", "", "filmium"),
    ("Neki tab · 127.0.0.1:4801/actors — Chrome", "google-chrome", "filmium"),
    ("localhost:4802 dev", "", "codium"),
    ("KALIMA red team :4804", "", "kalima"),
    ("Workplace :4806", "", "workplace"),
    ("Second Brain graf", "", "second-brain"),
    ("app on :4901", "", "second-brain"),
    ("Imperium strategija", "", "imperium"),
    ("YouTube - Google Chrome", "google-chrome", None),
    ("", "", None),
])
def test_classify(title, wm, expected):
    assert classify(title, wm) == expected


def test_port_precedence_over_keyword():
    # port pobeđuje: naslov pominje filmium ali radi na kalima portu
    assert classify("filmium tab :4804", "") == "kalima"
