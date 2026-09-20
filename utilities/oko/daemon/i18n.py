#!/usr/bin/env python3
"""i18n — prevodi interfejsa (en/sr). Default EN. `set_lang` iz config-a; `t(key)` lookup.

Fallback: traženi jezik → EN → sam ključ. Nema zavisnosti (čist Python)."""
from __future__ import annotations

_LANG = "en"

STRINGS: dict[str, dict[str, str]] = {
    "en": {
        # zajedničke akcije
        "save": "Save", "close": "Close", "cancel": "Cancel", "ok": "OK",
        "file": "File", "clipboard": "Clipboard", "edit": "Edit", "saved": "Saved ✓",
        # settings prozor
        "settings_title": "OKO — Settings",
        "hotkey": "Hotkey", "mode": "Mode", "after_select": "After selection",
        "path": "Path", "format": "Format", "jpg_quality": "JPG quality",
        "filename_template": "Filename template",
        "ai_windows_cache": "AI Windows Cache (captures sections/elements in windows)",
        "sc_ai_cache": "Shortcut: instant AI cache",
        "sc_cancel": "Shortcut: cancel (Esc)",
        "autostart": "Autostart (systemd --user)",
        "language": "Language",
        "mode_region": "region", "mode_window": "window", "mode_screen": "screen",
        "after_ask": "ask (File/Clipboard)", "after_file": "file immediately",
        "after_clipboard": "clipboard immediately",
        # tray
        "tray_region": "Capture region", "tray_window": "Capture window",
        "tray_screen": "Capture screen", "tray_settings": "Settings…", "tray_quit": "Quit",
        # dijalozi
        "save_title": "OKO — save capture", "text_title": "Text",
        "dest_prompt": "Where to put the capture?",
    },
    "sr": {
        "save": "Sačuvaj", "close": "Zatvori", "cancel": "Otkaži", "ok": "OK",
        "file": "Fajl", "clipboard": "Clipboard", "edit": "Uredi", "saved": "Sačuvano ✓",
        "settings_title": "OKO — Podešavanja",
        "hotkey": "Hotkey", "mode": "Mod", "after_select": "Posle izbora",
        "path": "Putanja", "format": "Format", "jpg_quality": "JPG kvalitet",
        "filename_template": "Šablon imena",
        "ai_windows_cache": "AI Windows Cache (hvata sekcije/elemente u prozorima)",
        "sc_ai_cache": "Prečica: trenutni AI cache",
        "sc_cancel": "Prečica: otkaz (Esc)",
        "autostart": "Autostart (systemd --user)",
        "language": "Jezik",
        "mode_region": "region", "mode_window": "prozor", "mode_screen": "ekran",
        "after_ask": "pitaj (Fajl/Clipboard)", "after_file": "odmah fajl",
        "after_clipboard": "odmah clipboard",
        "tray_region": "Uhvati region", "tray_window": "Uhvati prozor",
        "tray_screen": "Uhvati ekran", "tray_settings": "Podešavanja…", "tray_quit": "Izlaz",
        "save_title": "OKO — sačuvaj snimak", "text_title": "Tekst",
        "dest_prompt": "Gde da smestim snimak?",
    },
}


def set_lang(lang: str) -> None:
    global _LANG
    _LANG = lang if lang in STRINGS else "en"


def current() -> str:
    return _LANG


def t(key: str, lang: str | None = None) -> str:
    lg = lang if (lang in STRINGS) else (_LANG if lang is None else "en")
    return STRINGS.get(lg, STRINGS["en"]).get(key) or STRINGS["en"].get(key) or key
