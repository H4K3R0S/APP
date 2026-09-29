// Live grafikon profita (uPlot): x = redni krug, y = kumulativni profit; zelena u plusu, crvena u minusu.
// Singleton vezan za #panel-live-chart; prati state 'round' (push) i 'reset'.
import uPlot from '../../../node_modules/uplot/dist/uPlot.esm.js';
import { state, subscribe } from '../state.js';
import { createSeries } from '../../../shared/profit_series.js';

const GREEN = '#22c55e';
const RED = '#ef4444';
const GRID = '#334155';
const TEXT = '#94a3b8';
const MAX_POINTS = 4000;

export function createProfitChart(el) {
  const series = createSeries(MAX_POINTS);
  const last = () => series.ys[series.ys.length - 1];
  const color = () => (last() >= 0 ? GREEN : RED);

  const opts = {
    width: Math.max(200, el.clientWidth),
    height: Math.max(120, el.clientHeight),
    cursor: { show: false },
    legend: { show: false },
    scales: { x: { time: false } },
    axes: [
      { stroke: TEXT, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID }, size: 26, font: '11px Inter, sans-serif' },
      { stroke: TEXT, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID }, size: 52, font: '11px Inter, sans-serif' },
    ],
    series: [
      {},
      { label: 'Profit', stroke: color, width: 2, fill: () => (last() >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)') },
    ],
  };
  const u = new uPlot(opts, [series.xs, series.ys], el);

  const ro = new ResizeObserver(() => {
    if (el.clientWidth && el.clientHeight) u.setSize({ width: el.clientWidth, height: el.clientHeight });
  });
  ro.observe(el);

  return {
    push(cumProfit) {
      series.push(cumProfit); // decimacija u shared/profit_series.js (x = pravi krug, najnovija tačka se čuva)
      u.setData([series.xs, series.ys]);
    },
    reset() {
      series.reset();
      u.setData([series.xs, series.ys]);
    },
    size() { return series.size(); },
    rounds() { return series.rounds(); },
    destroy() { ro.disconnect(); u.destroy(); },
    uplot: u,
  };
}

let instance = null;

export function mountProfitChart(el) {
  if (instance) return instance;
  el.replaceChildren();
  el.classList.add('filled', 'chart-host');
  instance = createProfitChart(el);
  // Dugme za reset grafikona tokom igre (čisti krivu; statistika ostaje netaknuta)
  const resetBtn = document.createElement('button');
  resetBtn.id = 'chart-reset-btn';
  resetBtn.type = 'button';
  resetBtn.className = 'chart-reset-btn';
  resetBtn.title = 'Resetuj grafikon';
  resetBtn.textContent = '↺ Grafikon';
  resetBtn.addEventListener('click', () => instance.reset());
  el.append(resetBtn);
  subscribe((key) => {
    if (key === 'round') instance.push(state.stats.cumulativeProfit);
    if (key === 'reset') instance.reset();
  });
  return instance;
}

export function getProfitChart() {
  return instance;
}
