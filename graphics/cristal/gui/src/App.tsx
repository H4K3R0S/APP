import { useRef, useState } from "react";
import {
  Brush,
  Crop,
  Download,
  Eraser,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  Minus,
  Move,
  PaintBucket,
  PenTool,
  Pipette,
  Redo2,
  Sparkles,
  Square,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { getCurrentWindow } from "@tauri-apps/api/window";

import Canvas, { type CanvasHandle } from "./editor/Canvas";
import { NEUTRAL_ADJ, type Adjustments, type Tool } from "./editor/types";

// Seamless prozor (kao CORE): guard-ovano — van Tauri-ja klik je bezopasan.
function peWin() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

const ALATI: { id: Tool; ikona: typeof Move; naziv: string }[] = [
  { id: "move", ikona: Move, naziv: "Pomeri" },
  { id: "select", ikona: Square, naziv: "Selekcija" },
  { id: "crop", ikona: Crop, naziv: "Iseci" },
  { id: "brush", ikona: Brush, naziv: "Četka" },
  { id: "pen", ikona: PenTool, naziv: "Olovka" },
  { id: "eraser", ikona: Eraser, naziv: "Gumica" },
  { id: "text", ikona: Type, naziv: "Tekst" },
  { id: "fill", ikona: PaintBucket, naziv: "Popuna" },
  { id: "picker", ikona: Pipette, naziv: "Pipeta" },
];

const BOJE = ["#ffffff", "#111318", "#ff5c7a", "#7c5cff", "#3fb6ff", "#4fe08b", "#ffd166", "#ff8a3d"];

type Panel = "slojevi" | "assets" | "preseti";

function App() {
  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState("#7c5cff");
  const [brushSize, setBrushSize] = useState(14);
  const [zoom, setZoom] = useState(1);
  const [adj, setAdj] = useState<Adjustments>(NEUTRAL_ADJ);
  const [panel, setPanel] = useState<Panel>("slojevi");
  const [imeProjekta, setImeProjekta] = useState("Bez naslova");
  const canvasRef = useRef<CanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function otvori(): void {
    fileRef.current?.click();
  }

  return (
    <div className="pe-app">
      {/* ==========          TOPBAR          ========== */}
      <header className="pe-topbar" data-tauri-drag-region>
        <div className="pe-brand">
          <span className="pe-logo"><Sparkles size={16} /></span>
          <strong>Cristal</strong>
        </div>
        <div className="pe-project">
          <input
            className="pe-project-name"
            value={imeProjekta}
            onChange={(e) => setImeProjekta(e.target.value)}
          />
        </div>
        <div className="pe-top-actions">
          <button className="pe-icon-btn" title="Poništi"><Undo2 size={16} /></button>
          <button className="pe-icon-btn" title="Ponovi"><Redo2 size={16} /></button>
          <span className="pe-sep" />
          <button className="pe-btn ghost" onClick={otvori}><FolderOpen size={15} /> Otvori</button>
          <button className="pe-btn accent" onClick={() => canvasRef.current?.izveziPng()}>
            <Download size={15} /> Izvezi
          </button>
          <span className="pe-sep" />
          {/* Seamless window kontrole (min/max/close) — kao CORE prozor */}
          <div className="pe-winctl">
            <button className="pe-winbtn" title="Minimizuj" onClick={() => peWin()?.minimize()}>
              <Minus size={15} />
            </button>
            <button className="pe-winbtn" title="Maksimizuj" onClick={() => peWin()?.toggleMaximize()}>
              <Square size={12} />
            </button>
            <button className="pe-winbtn pe-winbtn-close" title="Zatvori" onClick={() => peWin()?.close()}>
              <X size={15} />
            </button>
          </div>
        </div>
      </header>

      <div className="pe-body">
        {/* ==========          LEVI RAIL + PANEL          ========== */}
        <aside className="pe-left">
          <div className="pe-tools">
            {ALATI.map((a) => {
              const Ikona = a.ikona;
              return (
                <button
                  key={a.id}
                  className={`pe-tool ${tool === a.id ? "active" : ""}`}
                  title={a.naziv}
                  onClick={() => setTool(a.id)}
                >
                  <Ikona size={18} />
                </button>
              );
            })}
          </div>

          <div className="pe-panel">
            <div className="pe-panel-tabs">
              <button className={panel === "slojevi" ? "on" : ""} onClick={() => setPanel("slojevi")}>
                <Layers size={14} /> Slojevi
              </button>
              <button className={panel === "assets" ? "on" : ""} onClick={() => setPanel("assets")}>
                <ImageIcon size={14} /> Assets
              </button>
              <button className={panel === "preseti" ? "on" : ""} onClick={() => setPanel("preseti")}>
                <Sparkles size={14} /> Preseti
              </button>
            </div>
            <div className="pe-panel-body">
              {panel === "slojevi" && (
                <ul className="pe-layers">
                  <li className="pe-layer active"><span className="pe-layer-thumb" /> Crtež</li>
                  <li className="pe-layer"><span className="pe-layer-thumb img" /> Osnova (slika)</li>
                </ul>
              )}
              {panel === "assets" && <p className="pe-hint">Prevuci slike ovde ili „Otvori".</p>}
              {panel === "preseti" && (
                <div className="pe-presets">
                  {["Auto", "B&W", "HDR", "Toplo", "Hladno", "Vintage"].map((p) => (
                    <button key={p} className="pe-preset">{p}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ==========          PLATNO          ========== */}
        <main className="pe-center">
          <Canvas
            ref={canvasRef}
            tool={tool}
            color={color}
            brushSize={brushSize}
            adjustments={adj}
            zoom={zoom}
            onZoom={setZoom}
          />
          <div className="pe-bottom-dock">
            <button className="pe-icon-btn" onClick={() => setZoom((z) => Math.max(0.1, z * 0.9))}><ZoomOut size={15} /></button>
            <span className="pe-zoom">{Math.round(zoom * 100)}%</span>
            <button className="pe-icon-btn" onClick={() => setZoom((z) => Math.min(8, z * 1.1))}><ZoomIn size={15} /></button>
            <button className="pe-icon-btn" onClick={() => setZoom(1)} title="100%">1:1</button>
          </div>
        </main>

        {/* ==========          DESNI PANEL          ========== */}
        <aside className="pe-right">
          <section className="pe-prop">
            <h3>Alat</h3>
            <label className="pe-field">
              <span>Veličina</span>
              <input type="range" min={1} max={80} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
              <em>{brushSize}px</em>
            </label>
            <div className="pe-field">
              <span>Boja</span>
              <div className="pe-swatches">
                {BOJE.map((b) => (
                  <button
                    key={b}
                    className={`pe-swatch ${color === b ? "on" : ""}`}
                    style={{ background: b }}
                    onClick={() => setColor(b)}
                  />
                ))}
                <input className="pe-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="pe-prop">
            <h3>Podešavanja</h3>
            {([
              ["Osvetljenje", "brightness"],
              ["Kontrast", "contrast"],
              ["Zasićenost", "saturation"],
            ] as const).map(([labela, kljuc]) => (
              <label className="pe-field" key={kljuc}>
                <span>{labela}</span>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={adj[kljuc]}
                  onChange={(e) => setAdj({ ...adj, [kljuc]: Number(e.target.value) })}
                />
                <em>{adj[kljuc] - 100 > 0 ? "+" : ""}{adj[kljuc] - 100}</em>
              </label>
            ))}
            <button className="pe-btn ghost small" onClick={() => setAdj(NEUTRAL_ADJ)}>Resetuj</button>
          </section>
        </aside>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            canvasRef.current?.ucitajSliku(f);
            setImeProjekta(f.name.replace(/\.[^.]+$/, ""));
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default App;
