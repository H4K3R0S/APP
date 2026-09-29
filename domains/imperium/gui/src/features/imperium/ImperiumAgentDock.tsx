// ==========          IMPERIUM AGENT DOCK          ==========
// Minimalni dock: deljeni CellAssistantChat sa generičkim asistentom ćelije
// (bez domenskog `onSend`). Daje chat + glas (STT/TTS preko GLAS-a) u IMPERIUM-u,
// koji je inače skelet. Montira ga shell preko `imperiumNav.AgentDock`.
import CellAssistantChat from "../../cell/CellAssistantChat";

function ImperiumAgentDock() {
  return <CellAssistantChat title="IMPERIUM Agent" startCollapsed />;
}

export default ImperiumAgentDock;
