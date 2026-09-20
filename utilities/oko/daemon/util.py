#!/usr/bin/env python3
"""Sitni helperi: notifikacija (notify-send ako postoji) + log u fajl."""
from __future__ import annotations

import shutil
import subprocess
import time

from . import config

_HAVE_NOTIFY = shutil.which("notify-send") is not None


def log(msg: str) -> None:
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n"
    try:
        config.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with config.LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(line)
    except OSError:
        pass


def notify(summary: str, body: str = "") -> None:
    log(f"{summary} {body}".strip())
    if _HAVE_NOTIFY:
        try:
            subprocess.Popen(
                ["notify-send", "-a", "OKO", "-t", "2500", summary, body],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        except OSError:
            pass
