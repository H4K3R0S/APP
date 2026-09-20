#!/usr/bin/env python3
"""OKO stanje: zapis poslednjeg snimka (u memoriji + na disku za /last posle restarta)."""
from __future__ import annotations

import json
import time
from typing import Any

from . import config

_last: dict[str, Any] | None = None


def _state_path():
    return config.CONFIG_DIR / "last.json"


def record(*, dest: str, path: str | None, mode: str, domain: str | None,
           size: tuple[int, int] | None = None) -> dict[str, Any]:
    """Zabeleži poslednji snimak. dest = 'file' | 'clipboard'."""
    global _last
    _last = {
        "dest": dest,
        "path": path,
        "mode": mode,
        "domain": domain,
        "size": list(size) if size else None,
        "ts": int(time.time()),
    }
    try:
        config.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        _state_path().write_text(json.dumps(_last, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass
    return _last


def last() -> dict[str, Any] | None:
    """Vrati poslednji snimak (iz memorije ili sa diska)."""
    global _last
    if _last is not None:
        return _last
    try:
        _last = json.loads(_state_path().read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        _last = None
    return _last
