#!/usr/bin/env python3
"""Config: default-i, roundtrip, sanacija, partial update."""
from daemon import config


def test_defaults_when_missing():
    cfg = config.load()
    assert cfg["hotkey"] == "Insert"
    assert cfg["mode"] == "region"
    assert cfg["ipc_port"] == 4807
    assert cfg["after_select"] == "ask"


def test_roundtrip_and_coercion():
    saved = config.save({
        "hotkey": "Print", "mode": "bogus", "after_select": "clipboard",
        "format": "jpg", "jpg_quality": 999, "ipc_port": "5000", "extra": "x",
    })
    assert saved["mode"] == "region"          # neispravno → default
    assert saved["jpg_quality"] == 100        # klamp
    assert saved["ipc_port"] == 5000          # cast
    assert "extra" not in saved               # nepoznat ključ odbačen
    reloaded = config.load()
    assert reloaded["hotkey"] == "Print"
    assert reloaded["after_select"] == "clipboard"


def test_partial_update_keeps_rest():
    config.save({"hotkey": "Insert", "mode": "screen"})
    cfg = config.update(mode="window")
    assert cfg["mode"] == "window"
    assert cfg["hotkey"] == "Insert"


def test_shortcut_defaults():
    cfg = config.load()
    assert cfg["element_pick"] is True          # AI Windows Cache podrazumevano ON
    assert cfg["hotkey_ai_cache"] == ""         # trenutni AI-cache okidač: prazno = isključen
    assert cfg["hotkey_cancel"] == "Escape"     # otkaz u aplikaciji


def test_shortcut_coercion():
    saved = config.save({"hotkey_ai_cache": "  F9 ", "hotkey_cancel": 123, "element_pick": 0})
    assert saved["hotkey_ai_cache"] == "F9"     # trim
    assert saved["hotkey_cancel"] == "Escape"   # nevalidan tip → default
    assert saved["element_pick"] is False


def test_lang_default_and_coercion():
    assert config.load()["lang"] == "en"                 # default engleski
    assert config.save({"lang": "sr"})["lang"] == "sr"
    assert config.save({"lang": "xx"})["lang"] == "en"   # nevalidan → default
