// Uporedni grafikon po 12 budžeta (uPlot bars): % sesija do Tier 3 (5×) naspram % bankrota.
import uPlot from '../../../node_modules/uplot/dist/uPlot.esm.js';
import { BUDGETS } from '../../../shared/sim_constants.js';

const GREEN = '#22c55e';
const RED = '#ef4444';
const GRID = '#334155';
const TEXT = '#94a3b8';

export function createBudgetChart(el, budgets = BUDGETS) {
  const xs = budgets.map((_, i) => i);
  const empty = () => budgets.map(() => 0);
  // kartica ima padding 12 + legenda ispod plota (~28px)
  const size = () => ({ width: Math.max(200, el.clientWidth - 24), height: Math.max(160, el.clientHeight - 24 - 28) });
  const opts = {
    ...size(),
    cursor: { show: false },
    legend: { show: true },
    scales: { x: { time: false, range: [-0.6, budgets.length - 0.4] }, y: { range: [0, 100] } },
    axes: [
      { stroke: TEXT, grid: { show: false }, ticks: { stroke: GRID }, size: 30, font: '11px Inter, sans-serif',
        splits: () => xs, values: () => budgets.map((b) => `$${b}`) },
      { stroke: TEXT, grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID }, size: 44, font: '11px Inter, sans-serif',
        values: (_u, vals) => vals.map((v) => `${v}%`) },
    ],
    series: [
      {},
      { label: 'Tier 3 (5×)', stroke: GREEN, fill: 'rgba(34,197,94,0.75)', points: { show: false }, paths: uPlot.paths.bars({ size: [0.42, 40], align: 1 }) },
      { label: 'Bankrot', stroke: RED, fill: 'rgba(239,68,68,0.75)', points: { show: false }, paths: uPlot.paths.bars({ size: [0.42, 40], align: -1 }) },
    ],
  };
  const u = new uPlot(opts, [xs, empty(), empty()], el);
  const ro = new ResizeObserver(() => {
    if (el.clientWidth && el.clientHeight) u.setSize(size());
  });
  ro.observe(el);

  return {
    render(report) {
      const byBudget = new Map((report?.budgets || []).map((b) => [b.budget, b]));
      const tier3 = budgets.map((b) => byBudget.get(b)?.tierPct?.[2] ?? 0);
      const bankrupt = budgets.map((b) => byBudget.get(b)?.bankruptPct ?? 0);
      u.setData([xs, tier3, bankrupt]);
    },
    reset() { u.setData([xs, empty(), empty()]); },
    uplot: u,
  };
}
