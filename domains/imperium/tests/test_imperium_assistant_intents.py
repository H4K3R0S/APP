"""IMPERIUM Asistent — allowlist namera + navigate izvršioci (ZAKON domenski agenti §5)."""
import pytest

from core.cell.assistant.protocols import AssistantActionError
from core.domains.imperium.assistant.executors import ImperiumExecutors
from core.domains.imperium.assistant.intents import IMPERIUM_INTENTS


def test_komande_prisutne():
    assert set(IMPERIUM_INTENTS) == {"open", "open_second_brain_map"}
    assert IMPERIUM_INTENTS["open"].is_navigate is True
    assert IMPERIUM_INTENTS["open"].is_write is False
    assert IMPERIUM_INTENTS["open_second_brain_map"].is_navigate is True
    assert IMPERIUM_INTENTS["open_second_brain_map"].is_write is False
    assert IMPERIUM_INTENTS["open_second_brain_map"].required_params == ()


def test_nema_upisnih_namera():
    assert not any(spec.is_write for spec in IMPERIUM_INTENTS.values())


def test_open_navigate():
    out = ImperiumExecutors().run("open", {"target": "dashboard"})
    assert out == {"kind": "navigate", "route": "/imperium"}


def test_open_second_brain_map_navigate():
    out = ImperiumExecutors().run("open_second_brain_map", {})
    assert out == {"kind": "navigate", "route": "/second-brain?view=mapa"}


def test_nepoznata_namera_je_action_error():
    with pytest.raises(AssistantActionError):
        ImperiumExecutors().run("nepostoji", {})
