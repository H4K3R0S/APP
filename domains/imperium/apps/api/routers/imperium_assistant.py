# apps/api/routers/imperium_assistant.py
# ========== ROUTER: IMPERIUM ASISTENT ==========
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from apps.api.schemas.imperium_assistant import (
    AssistantCommandRequest,
    AssistantCommandResponse,
    AssistantConfirmRequest,
    AssistantRefuteRequest,
)
from core.cell.assistant.agent import AssistantAgent
from core.cell.assistant.protocols import AssistantActionError

router = APIRouter(prefix="/api/v1/imperium/assistant", tags=["IMPERIUM Asistent"])


def get_agent_dep(persona_id: str = "strateg") -> AssistantAgent:
    """Tanak omotač oko runtime-a — pozvan direktno (ne kroz Depends), pa
    testovi menjaju ponašanje monkeypatch-om `imperium_assistant_runtime.get_agent`."""

    # Lenj uvoz: runtime graf (OllamaClient, retriever) se gradi tek pri
    # prvom pozivu, ne pri uvozu routera — brži boot ćelije.
    from apps.api import imperium_assistant_runtime

    return imperium_assistant_runtime.get_agent(persona_id)


@router.post("/command", response_model=AssistantCommandResponse)
def command(payload: AssistantCommandRequest) -> AssistantCommandResponse:
    agent = get_agent_dep(payload.persona_id or "strateg")
    return AssistantCommandResponse.from_domain(agent.handle(payload.message))


@router.post("/confirm")
def confirm(payload: AssistantConfirmRequest) -> dict:
    agent = get_agent_dep()
    try:
        return agent.confirm(payload.token)
    except KeyError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error
    except AssistantActionError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)) from error


@router.post("/refute")
def refute(payload: AssistantRefuteRequest) -> dict:
    return {"refuted": get_agent_dep().refute(payload.log_id)}
