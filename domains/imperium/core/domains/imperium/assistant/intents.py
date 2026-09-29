# core/domains/imperium/assistant/intents.py
# ========== IMPERIUM INTENTI (allowlist) ==========
# MINIMALNO i bezbedno: IMPERIUM je prazan skelet bez opasnih alata (TTS/SD su
# [TODO]) — jedina dozvoljena namera je navigacija ka poznatim GUI sekcijama.
# Sve ostalo (pitanja, analiza, predlozi) je chat/RAG passthrough: kad poruka
# ne mapira ni na jednu nameru sa ove liste, `AssistantAgent` prosto vrati
# modelov `reply` (v. core/cell/assistant/agent.py `handle` — intent "unknown").
# Exec/mrežni intenti NAMERNO izostaju — čekaju Approval Gate (F5).
from __future__ import annotations

from core.cell.assistant.intents import IntentSpec

IMPERIUM_INTENTS: dict[str, IntentSpec] = {
    "open": IntentSpec("open", is_write=False, is_navigate=True,
                       needs_entity=False, tool="open", required_params=("target",)),
    # ZAKON domenski agenti §5: GUI ekran = agent zna da ga otvori (Second Brain MAPS).
    "open_second_brain_map": IntentSpec("open_second_brain_map", is_write=False, is_navigate=True,
                                        needs_entity=False, tool="open_second_brain_map",
                                        required_params=()),
}
