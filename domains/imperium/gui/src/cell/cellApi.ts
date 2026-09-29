import { getJson, postJson, putJson } from "../services/httpClient";


// ==========          ĆELIJSKI API (generički)          ==========
//
// Domen-agnostičan klijent ćelije: stanje ćelije, persone i asistent. Nijedna
// domenska ruta nije zakucana — asistent gađa generički `/cell/assistant/ask`
// koji cell API nudi samo ako domen ima asistenta; ako ga nema, poziv padne i
// `CellAssistantChat` prikaže razumljivu poruku.

export type CellAssistantAnswer = {
  answer: string;
  sources: string[];
  is_fallback: boolean;
};

export type CellStatus = {
  domain_id: string;
  name: string;
  domain_version: string;
  kernel_version: string;
  port: number;
  operating_system: string;
  node_name: string;
  database_path: string;
  rag_enabled: boolean;
  rag_namespace: string;
  pending_upgrades: number;
  ai_endpoint: string;
  ai_assistant_model: string | null;
};

export type CellPersona = {
  id: string;
  name: string;
  markdown: string;
  customized: boolean;
};

/** Pitanje asistentu domena nad lokalnom Ollamom ćelije (ako domen ima asistenta). */
export function askCellAssistant(question: string): Promise<CellAssistantAnswer> {
  return postJson<CellAssistantAnswer, { question: string }>(
    "/cell/assistant/ask",
    { question },
  );
}

/** Stanje ćelije, uključujući Ollama model i adresu iz cell.json. */
export function getCellStatus(): Promise<CellStatus> {
  return getJson<CellStatus>("/cell/status");
}

/** Persone domena ćelije. */
export function listCellPersonas(): Promise<CellPersona[]> {
  return getJson<CellPersona[]>("/cell/personas");
}

/** Upisuje izmenjen tekst persone. */
export function saveCellPersona(id: string, markdown: string): Promise<CellPersona> {
  return putJson<CellPersona, { markdown: string }>(
    `/cell/personas/${encodeURIComponent(id)}`,
    { markdown },
  );
}
