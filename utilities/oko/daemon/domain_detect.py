#!/usr/bin/env python3
"""Prepoznavanje domena iz aktivnog prozora (v1: naslov + WM_CLASS preko xdotool/xprop).

Čista `classify()` je odvojena od I/O (`detect()`) radi testiranja. Kasnije nadogradivo
(DOM hook / OCR) — potpis ostaje isti.
"""
from __future__ import annotations

import subprocess

# Port → domen (naši lokalni web-servisi).
_PORT_DOMAIN = {
    "4801": "filmium",
    "4802": "codium",
    "4803": "imperium",
    "4804": "kalima",
    "4806": "workplace",
    "4901": "second-brain",
}

# Ključne reči → domen (kad nema porta u naslovu).
_KEYWORDS = [
    ("second brain", "second-brain"),
    ("second-brain", "second-brain"),
    ("filmium", "filmium"),
    ("codium", "codium"),
    ("imperium", "imperium"),
    ("kalima", "kalima"),
    ("workplace", "workplace"),
]


def classify(title: str | None, wm_class: str | None) -> str | None:
    """Vrati domen-slug ili None. Čista funkcija (bez I/O) — testabilna."""
    hay = f"{title or ''} {wm_class or ''}".lower()
    if not hay.strip():
        return None
    for port, domain in _PORT_DOMAIN.items():
        if f":{port}" in hay:
            return domain
    for needle, domain in _KEYWORDS:
        if needle in hay:
            return domain
    return None


def _run(cmd: list[str]) -> str:
    try:
        return subprocess.run(
            cmd, capture_output=True, text=True, timeout=1.5
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _active_window_id() -> str:
    return _run(["xdotool", "getactivewindow"])


def _window_title(win_id: str) -> str:
    return _run(["xdotool", "getwindowname", win_id]) if win_id else ""


def _window_class(win_id: str) -> str:
    if not win_id:
        return ""
    out = _run(["xprop", "-id", win_id, "WM_CLASS"])
    # WM_CLASS(STRING) = "navigator", "firefox"  ->  uzmi navodnike
    parts = [p.strip().strip('"') for p in out.split("=", 1)[-1].split(",")]
    return " ".join(p for p in parts if p)


def detect() -> tuple[str | None, str, str]:
    """Detektuj (domen, naslov, wm_class) aktivnog prozora. domen može biti None."""
    win = _active_window_id()
    title = _window_title(win)
    wm_class = _window_class(win)
    return classify(title, wm_class), title, wm_class
