# core/domains/imperium/assistant/executors.py
# ========== IMPERIUM IZVRŠIOCI ==========
# IMPERIUM je prazan skelet: nema opasnih alata (TTS/SD su [TODO], čekaju
# Approval Gate F5). Jedini izvršilac je navigacija ka poznatim GUI sekcijama
# — LOW-rizik, bez upisa. Sve ostalo je chat/RAG passthrough (LLM odgovara
# direktno kroz `reply`, bez namere sa allowlist-e).
from __future__ import annotations

from core.cell.assistant.protocols import AssistantActionError

# IMPERIUM GUI je za sada prazan skelet (samo početna) — v.
# gui/src/features/imperium/imperiumNav.tsx. Dopuniti kad stignu nove sekcije
# (YouTube, streaming, content creation, SEO, marketing, analytics).
OPEN_ROUTES: dict[str, str] = {
    "pocetna": "/imperium",
    "početna": "/imperium",
    "dashboard": "/imperium",
    "imperium": "/imperium",
    "home": "/imperium",
}
# Second Brain MAPS mapa (podrazumevani pogled „Mapa"; ZAKON domenski agenti §5).
SECOND_BRAIN_MAP_ROUTE = "/second-brain?view=mapa"


class ImperiumExecutors:
    """Izvršioci IMPERIUM Asistenta — MINIMALNI i LOW-rizik (samo navigacija).

    Bez ijedne upisne namere (preview/apply se nikad ne pozivaju dok
    `IMPERIUM_INTENTS` ne sadrži `is_write=True` unos) — implementirane ovde
    samo da ispune `Executors` protokol i vrate jasnu grešku ako se ipak
    pozovu. Exec/mrežni alati čekaju Approval Gate (F5)."""

    def run(self, intent_name: str, params: dict) -> dict:
        if intent_name == "open":
            target = (params.get("target") or "").strip().lower()
            route = OPEN_ROUTES.get(target)
            if route is None:
                raise AssistantActionError(f"Nepoznata sekcija: {target!r}")
            return {"kind": "navigate", "route": route}
        if intent_name == "open_second_brain_map":
            return {"kind": "navigate", "route": SECOND_BRAIN_MAP_ROUTE}
        raise AssistantActionError(f"Nepoznata namera: {intent_name}")

    def preview(self, intent_name: str, params: dict) -> dict:
        raise AssistantActionError(f"Nepoznat upis: {intent_name}")

    def apply(self, intent_name: str, params: dict) -> dict:
        raise AssistantActionError(f"Nepoznat upis: {intent_name}")
