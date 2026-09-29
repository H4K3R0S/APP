import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type { Adjustments, Stroke, Tool } from "./types";

// ==========          PLATNO (render engine — F1 skeleton)          ==========
/*
 * Nedestruktivno (u duhu DIZAJN.md): render = osnovna slika + crteži, sa CSS
 * filterom za podešavanja (preview). F1: pen/brush/eraser, zoom/pan, izvoz PNG.
 * Kasnije: slojevi, selekcije, WebGL filteri (vidi DIZAJN.md).
 */

export interface CanvasHandle {
  ucitajSliku: (file: File) => void;
  izveziPng: () => void;
  novoPlatno: (w: number, h: number) => void;
}

interface CanvasProps {
  tool: Tool;
  color: string;
  brushSize: number;
  adjustments: Adjustments;
  onZoom: (z: number) => void;
  zoom: number;
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { tool, color, brushSize, adjustments, onZoom, zoom },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [slika, setSlika] = useState<HTMLImageElement | null>(null);
  const [dim, setDim] = useState({ w: 900, h: 600 });
  const strokesRef = useRef<Stroke[]>([]);
  const crtaRef = useRef<Stroke | null>(null);
  const [, forceRender] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const filter = `brightness(${adjustments.brightness}%) contrast(${adjustments.contrast}%) saturate(${adjustments.saturation}%)`;

  function crtaj(): void {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // podloga
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (slika) {
      ctx.drawImage(slika, 0, 0, canvas.width, canvas.height);
    }
    const svi = crtaRef.current ? [...strokesRef.current, crtaRef.current] : strokesRef.current;
    for (const s of svi) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.size;
      if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      }
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();
    }
  }

  useEffect(() => {
    crtaj();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slika, dim]);

  useImperativeHandle(ref, () => ({
    ucitajSliku: (file: File) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setDim({ w: img.naturalWidth, h: img.naturalHeight });
        setSlika(img);
        strokesRef.current = [];
        setPan({ x: 0, y: 0 });
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    novoPlatno: (w: number, h: number) => {
      setDim({ w, h });
      setSlika(null);
      strokesRef.current = [];
    },
    izveziPng: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // primeni podešavanja u izvoz: preslikaj kroz privremeno platno sa filterom
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      const octx = out.getContext("2d");
      if (!octx) return;
      octx.filter = filter;
      octx.drawImage(canvas, 0, 0);
      out.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "izvoz.png";
        a.click();
        URL.revokeObjectURL(a.href);
      }, "image/png");
    },
  }));

  function pozicija(e: ReactPointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onDown(e: ReactPointerEvent): void {
    if (tool === "move") {
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
      return;
    }
    if (tool === "brush" || tool === "pen" || tool === "eraser") {
      const p = pozicija(e);
      crtaRef.current = { tool, color, size: tool === "pen" ? Math.max(1, brushSize / 2) : brushSize, points: [p] };
      (e.target as Element).setPointerCapture(e.pointerId);
    }
  }

  function onMove(e: ReactPointerEvent): void {
    if (panStart.current) {
      const s = panStart.current;
      setPan({ x: s.px + (e.clientX - s.x), y: s.py + (e.clientY - s.y) });
      return;
    }
    if (crtaRef.current) {
      crtaRef.current.points.push(pozicija(e));
      crtaj();
    }
  }

  function onUp(): void {
    panStart.current = null;
    if (crtaRef.current) {
      strokesRef.current.push(crtaRef.current);
      crtaRef.current = null;
      forceRender((n) => n + 1);
    }
  }

  function onWheel(e: ReactWheelEvent): void {
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    onZoom(Math.min(8, Math.max(0.1, zoom * factor)));
  }

  return (
    <div className="pe-canvas-stage" ref={wrapRef} onWheel={onWheel}>
      <div
        className="pe-canvas-holder"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <canvas
          ref={canvasRef}
          width={dim.w}
          height={dim.h}
          className="pe-canvas"
          style={{ filter, cursor: tool === "move" ? "grab" : "crosshair" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
    </div>
  );
});

export default Canvas;
