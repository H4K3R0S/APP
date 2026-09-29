"""Sheme odgovora ćelijskog API-ja."""

from pydantic import BaseModel


class CellStatusResponse(BaseModel):
    """Stanje ćelije koje CORE prikazuje na kartici domena."""

    domain_id: str
    name: str
    domain_version: str
    kernel_version: str
    port: int
    operating_system: str
    node_name: str
    database_path: str
    rag_enabled: bool
    rag_namespace: str
    pending_upgrades: int
    ai_endpoint: str
    ai_assistant_model: str | None


class CellPersonaResponse(BaseModel):
    """Persona FILMIUM opsega, onako kako je vidi ekran podešavanja ćelije."""

    id: str
    name: str
    markdown: str
    customized: bool


class CellPersonaUpdateRequest(BaseModel):
    """Nov tekst persone."""

    markdown: str


class CellAssistantAskRequest(BaseModel):
    """Pitanje asistentu ćelije (lokalna Ollama)."""

    question: str


class CellAssistantAskResponse(BaseModel):
    """Odgovor asistenta ćelije."""

    answer: str
    sources: list[str]
    is_fallback: bool
