import ThemePanel from "../settings/ThemePanel";
import VoicePanel from "../settings/VoicePanel";


// ==========          IMPERIUM — PODEŠAVANJA          ==========
//
// IMPERIUM je za sada prazan skelet, pa podešavanja nose samo temu: izbor
// pozadine (IMPERIUM ima dve slike) i ambijentalni efekat „Povezane tačke".

const IMPERIUM_BACKGROUNDS = [
  { id: "imperium", label: "Geometrija", url: "/imperium-bg.png" },
  { id: "imperium-2", label: "Talasi", url: "/imperium-bg-2.png" },
];

function ImperiumSettings() {
  return (
    <div className="workspace" style={{ padding: "28px 32px", overflow: "auto" }}>
      <header style={{ marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 12, letterSpacing: "0.08em", color: "#94a3b8" }}>
          IMPERIUM
        </p>
        <h1 style={{ margin: "2px 0 0", fontSize: 22 }}>Podešavanja</h1>
      </header>
      <ThemePanel
        backgrounds={IMPERIUM_BACKGROUNDS}
        subtitle="Pozadina i ambijentalni efekat „Povezane tačke“ za IMPERIUM. Menja se odmah i pamti na ovom uređaju."
      />
      <div style={{ marginTop: 24 }}>
        <VoicePanel />
      </div>
    </div>
  );
}

export default ImperiumSettings;
