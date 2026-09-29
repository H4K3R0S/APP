// Marker-grafikon hibridne sesije (korak 25): linija profita u boji aktivne strategije + vertikalni markeri
// prebacivanja sa tooltip-om („Krug N: … Aktivirana promena na B. Balans sačuvan na X$“).
import uPlot from '../../../node_modules/uplot/dist/uPlot.esm.js';
import { h, fmt } from '../ui/dom.js';

const PALETTE = ['#3b82f6', '#f97316', '#a855f7', '#22c55e', '#ec4899', '#eab308'];
const GRID = '#334155';
const TEXT = '#94a3b8';
const MARKER = '#fbbf24';

const WHEN_TEXT = { lossStreak: (v) => `Loss streak dostigao ${v}`, balanceDrop: (v) => `Balans pao ispod ${v}% početnog` };

export function createHybridChart(el) {
  let u = null;
  const tooltip = h('div', { id: 'hybrid-tooltip', class: 'hybrid-tooltip', hidden: true });
  const legend = h('div', { id: 'hybrid-legend', class: 'hybrid-legend' });
  const plot = h('div', { class: 'hybrid-plot' });
  el.replaceChildren(legend, plot, tooltip);
  const size = () => ({ width: Math.max(200, el.clientWidth - 24), height: Math.max(160, el.clientHeight - 24 - 30) });

  function placeMarkers(handovers) {
    if (!u) return;
    for (const m of u.over.querySelectorAll('.hybrid-marker')) m.remove();
    for (const hd of handovers) {
      const x = u.valToPos(hd.round, 'x');
      if (!Number.isFinite(x)) continue;
      const text = `Krug ${hd.round}: ${(WHEN_TEXT[hd.when] || (() => 'Okidač'))(hd.value)}. Aktivirana promena na ${hd.to}. Balans sačuvan na ${fmt(hd.balance, 2)}$ (ulog ${hd.bet}).`;
      const m = h('div', { class: 'hybrid-marker', dataset: { text }, title: text }, '⚡');
      m.style.left = `${x}px`;
      m.addEventListener('mouseenter', () => { tooltip.textContent = text; tooltip.hidden = false; tooltip.style.left = `${Math.min(x + 12, el.clientWidth - 260)}px`; });
      m.addEventListener('mouseleave', () => { tooltip.hidden = true; });
      u.over.append(m);
    }
  }

  return {
    // session: {series:[{x,y}], handovers:[{round,to,...}]}; baseName: ime polazne strategije
    render(session, baseName = 'Polazna') {
      if (u) { u.destroy(); u = null; }
      const pts = session?.series?.length ? session.series : [{ x: 0, y: 0 }];
      const hs = [...(session?.handovers || [])].sort((a, b) => a.round - b.round);
      const segNames = [baseName, ...hs.map((x) => x.to)];
      const uniq = [...new Set(segNames)];
      const xs = pts.map((p) => p.x);
      const data = uniq.map(() => new Array(xs.length).fill(null));
      let seg = 0;
      for (let i = 0; i < xs.length; i++) {
        while (seg < hs.length && xs[i] > hs[seg].round) seg += 1; // krug prelaska je odigrala STARA strategija
        const si = uniq.indexOf(segNames[seg]);
        data[si][i] = pts[i].y;
        if (i > 0 && data[si][i - 1] == null) data[si][i - 1] = pts[i - 1].y; // spoji segmente bez rupe
      }
      const opts = {
        ...size(),
        cursor: { show: false },
        legend: { show: false },
        scales: { x: { time: false } },
        axes: [
          { stroke: TEXT, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID }, size: 26, font: '11px Inter, sans-serif' },
          { stroke: TEXT, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID }, size: 52, font: '11px Inter, sans-serif' },
        ],
        series: [{}, ...uniq.map((name, i) => ({ label: name, stroke: PALETTE[i % PALETTE.length], width: 2, points: { show: false } }))],
        hooks: {
          draw: [(up) => {
            const ctx = up.ctx;
            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = MARKER;
            ctx.lineWidth = 2;
            for (const hd of hs) {
              const x = up.valToPos(hd.round, 'x', true);
              ctx.beginPath(); ctx.moveTo(x, up.bbox.top); ctx.lineTo(x, up.bbox.top + up.bbox.height); ctx.stroke();
            }
            ctx.restore();
          }],
          setSize: [() => placeMarkers(hs)],
        },
      };
      u = new uPlot(opts, [xs, ...data], plot);
      legend.replaceChildren(...uniq.map((name, i) => h('span', { class: 'hl-item' }, h('i', { style: `background:${PALETTE[i % PALETTE.length]}` }), name)),
        h('span', { class: 'hl-item' }, h('i', { style: `background:${MARKER}` }), `${hs.length} prebacivanja`));
      placeMarkers(hs);
      return { series: uniq.length, markers: hs.length };
    },
    resize() { if (u) u.setSize(size()); },
    destroy() { if (u) { u.destroy(); u = null; } },
  };
}
