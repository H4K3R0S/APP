#!/usr/bin/env python3
"""i18n: lookup po jeziku, fallback na EN pa na ključ; set_lang/current."""
from daemon import i18n


def test_lookup_and_fallback():
    assert i18n.t("save", "en") == "Save"
    assert i18n.t("save", "sr") == "Sačuvaj"
    assert i18n.t("save", "xx") == "Save"          # nepoznat jezik → EN
    assert i18n.t("__nema__", "sr") == "__nema__"  # nepoznat ključ → sam ključ


def test_current_lang():
    i18n.set_lang("sr")
    assert i18n.current() == "sr"
    assert i18n.t("edit") == "Uredi"               # bez arg → tekući jezik
    i18n.set_lang("en")
    assert i18n.t("edit") == "Edit"
    i18n.set_lang("xx")                            # nevalidan → EN
    assert i18n.current() == "en"
