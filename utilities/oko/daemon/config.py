#!/usr/bin/env python3
"""OKO konfiguracija: ~/.config/oko/config.json (učitavanje, snimanje, podrazumevano)."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

def _dir() -> Path:
    """Config direktorijum — čita se pri svakom pristupu (env-override za testove)."""
    return Path(os.environ.get("OKO_CONFIG_DIR", Path.home() / ".config" / "oko"))


# Dinamički atributi modula (config.CONFIG_DIR itd. uvek prate tekući env).
_DYNAMIC = {
    "CONFIG_DIR": lambda: _dir(),
    "CONFIG_PATH": lambda: _dir() / "config.json",
    "LOG_PATH": lambda: _dir() / "oko.log",
    "LOCK_PATH": lambda: _dir() / "oko.lock",
}


def __getattr__(name: str):
    if name in _DYNAMIC:
        return _DYNAMIC[name]()
    raise AttributeError(name)

# Podrazumevane vrednosti — jedini izvor istine za default-e.
DEFAULTS: dict[str, Any] = {
    "hotkey": "Insert",                 # globalni taster (python-xlib keysym ime)
    "mode": "region",                   # region | window | screen
    "after_select": "ask",              # ask | file | clipboard
    "save_dir": str(Path.home() / "Pictures"),
    "format": "png",                    # png | jpg
    "jpg_quality": 92,
    "filename_template": "oko-%Y%m%d-%H%M%S",
    "ipc_port": 4807,
    "autostart": False,
    "element_pick": True,   # AI Windows Cache: element-birač u našim app (False = samo region)
    "hotkey_ai_cache": "",  # globalni taster za TRENUTNO korišćenje AI cache-a (prazno = isključen)
    "hotkey_cancel": "Escape",  # taster za otkaz biranja (u aplikaciji, uz Escape)
    "lang": "en",           # jezik interfejsa: en | sr (default engleski; pamti se)
}

_ALLOWED = set(DEFAULTS)


def _coerce(cfg: dict[str, Any]) -> dict[str, Any]:
    """Zadrži samo poznate ključeve; dopuni nedostajuće default-ima; osnovna sanacija."""
    out = dict(DEFAULTS)
    for k, v in cfg.items():
        if k in _ALLOWED and v is not None:
            out[k] = v
    if out["mode"] not in ("region", "window", "screen"):
        out["mode"] = DEFAULTS["mode"]
    if out["after_select"] not in ("ask", "file", "clipboard"):
        out["after_select"] = DEFAULTS["after_select"]
    if out["format"] not in ("png", "jpg"):
        out["format"] = DEFAULTS["format"]
    try:
        out["jpg_quality"] = max(1, min(100, int(out["jpg_quality"])))
    except (TypeError, ValueError):
        out["jpg_quality"] = DEFAULTS["jpg_quality"]
    try:
        out["ipc_port"] = int(out["ipc_port"])
    except (TypeError, ValueError):
        out["ipc_port"] = DEFAULTS["ipc_port"]
    out["autostart"] = bool(out["autostart"])
    out["element_pick"] = bool(out["element_pick"])
    out["hotkey_ai_cache"] = str(out["hotkey_ai_cache"]).strip() if isinstance(out["hotkey_ai_cache"], str) else ""
    out["hotkey_cancel"] = str(out["hotkey_cancel"]).strip() if isinstance(out["hotkey_cancel"], str) and out["hotkey_cancel"].strip() else DEFAULTS["hotkey_cancel"]
    if out["lang"] not in ("en", "sr"):
        out["lang"] = DEFAULTS["lang"]
    return out


def load() -> dict[str, Any]:
    """Učitaj config (spoji sa default-ima). Nepostojeći/neispravan → default."""
    try:
        raw = json.loads((_dir() / "config.json").read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            raw = {}
    except (FileNotFoundError, json.JSONDecodeError):
        raw = {}
    return _coerce(raw)


def save(cfg: dict[str, Any]) -> dict[str, Any]:
    """Snimi config (atomično). Vrati saniran, upisan config."""
    clean = _coerce(cfg)
    d = _dir()
    d.mkdir(parents=True, exist_ok=True)
    path = d / "config.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(clean, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return clean


def update(**changes: Any) -> dict[str, Any]:
    """Učitaj → primeni izmene → snimi. Vrati novi config."""
    cfg = load()
    cfg.update(changes)
    return save(cfg)
