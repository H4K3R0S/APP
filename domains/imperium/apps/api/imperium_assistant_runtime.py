# apps/api/imperium_assistant_runtime.py
# ========== IMPERIUM ASISTENT RUNTIME ==========
# Sklapa AssistantAgent po personi. IMPERIUM je prazan skelet bez opasnih
# alata (TTS/SD su [TODO], čekaju Approval Gate F5) — izvršioci su MINIMALNI
# (samo navigacija); sve ostalo je chat/RAG passthrough (v.
# core/domains/imperium/assistant/executors.py).
from __future__ import annotations

from pathlib import Path

from core.ai.ollama_client import OllamaClient
from core.cell.assistant.agent import AssistantAgent
from core.cell.assistant.atoms import AtomLoader
from core.cell.assistant.confirm import ConfirmStore
from core.cell.assistant.interaction_log import InteractionLog
from core.cell.manifest import load_cell_manifest
from core.domains.imperium.assistant.executors import ImperiumExecutors
from core.domains.imperium.assistant.intents import IMPERIUM_INTENTS
from core.domains.imperium.search.hybrid_retriever import HybridRetriever

_ROOT = Path(__file__).resolve().parents[2]
_MANIFEST = load_cell_manifest(_ROOT)
_PERSONAS = _ROOT / ".ai" / "atomi" / "personas"
_SHARED = _PERSONAS / "_shared"
_DEFAULT = "strateg"
# Beli spisak persona — sprečava da persona_id (spolja kontrolisan) uđe u
# putanju fajl-sistema pre provere (path traversal na _PERSONAS / persona_id).
_KNOWN_PERSONE = frozenset({
    "strateg", "analiticar-trzista", "scenarista", "producent", "seo-specijalista",
})

_ollama = OllamaClient(endpoint=_MANIFEST.ai_endpoint, timeout=60.0)

# Deljeni store/log preživljavaju zahtev (token izdat u /command mora ga naći
# /confirm u sledećem zahtevu; log je persona-agnostičan).
_confirm = ConfirmStore()
_log = InteractionLog(_ROOT / ".ai" / "atomi" / "logs" / "assistant")

# Minimalni izvršioci — samo navigacija (open). Bez upisnih namera dok ne
# stignu bezbedni alati domena (F5 Approval Gate je preduslov za exec/mrežne
# intente).
_executors = ImperiumExecutors()

# DOMEN-LOKALNI RAG (v. ai_workplace/.ai/DOMENSKI-AGENTI.md): IMPERIUM agent je
# Q&A/konverzacioni (odgovor iz `reply` + RAG kontekst), pa ZADRŽAVA lokalni RAG
# (HybridRetriever, FTS5 + best-effort vektor). Uklonjen build_fallthrough_retriever
# (centralni ruter :4800) — model radi samo unutar domena. (Indeks van
# request-putanje je buduća optimizacija.)
_local_retriever = HybridRetriever(domain="imperium", k=5)
_KEEP_ALIVE = "10m"  # model topao → sledeći upit ~1s umesto ~5s


def _generate(model: str, prompt: str, *, system: str | None = None, fmt: str | None = None) -> str:
    return _ollama.generate(model, prompt, system=system, fmt=fmt, keep_alive=_KEEP_ALIVE)


def get_agent(persona_id: str = _DEFAULT) -> AssistantAgent:
    """Sklopi agenta za personu (pada na `strateg` ako persona ne postoji)."""

    pid = persona_id if persona_id in _KNOWN_PERSONE else _DEFAULT
    atoms = AtomLoader(_PERSONAS / pid, shared_root=_SHARED)
    return AssistantAgent(
        intents=IMPERIUM_INTENTS, executors=_executors, resolver=None,
        atoms=atoms, confirm=_confirm, log=_log,
        generate=_generate, model=_MANIFEST.ai_assistant_model or "qwen2.5:7b",
        retrieve=_local_retriever,  # domen-lokalni RAG, bez centralnog rutera
    )
