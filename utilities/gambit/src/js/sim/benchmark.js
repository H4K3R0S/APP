// Benchmark kartica (korak 30): vreme, indeks brzine, po radniku, stabilnost, režim; mini istorija iz data/benchmark.jsonl.
import { h, fmt } from '../ui/dom.js';

const n0 = (x) => Number(x || 0).toLocaleString('sr-RS');

export function createBenchmarkCard(el) {
  const card = h('div', { id: 'sim-benchmark', class: 'bench-card', hidden: true });
  const history = h('div', { id: 'sim-benchmark-history', class: 'bench-history' });
  el.append(h('div', { class: 'stat-sub bench-title' }, 'Sistemski benchmark'), card, history);
  return {
    render(report) {
      const b = report.benchmark || {};
      const st = b.stability || { label: 'n/a', pct: null };
      const stText = st.pct == null ? 'n/a (premalo intervala)' : `${st.label} (${fmt(st.pct, 1)}% intervala u ritmu${st.gaps ? `, ${st.gaps} propuštenih` : ' — bez dropovanja frejmova'})`;
      card.hidden = false;
      card.replaceChildren(
        h('div', {}, h('span', {}, 'Ukupno vreme obrade'), h('b', {}, `${fmt(b.durationMs / 1000, 2)} s`)),
        h('div', {}, h('span', {}, 'Indeks brzine procesora'), h('b', {}, `${n0(b.roundsPerSec)} krugova/sek`)),
        h('div', {}, h('span', {}, 'Po radniku'), h('b', {}, `${n0(b.roundsPerSecPerWorker)} krugova/sek`)),
        h('div', {}, h('span', {}, 'Status stabilnosti'), h('b', { class: st.label === 'Seckanje' ? 'neg' : st.label === 'Stabilno' ? 'pos' : '' }, stText)),
        h('div', {}, h('span', {}, 'Režim radnika'), h('b', {}, `${b.workerMode === 'threads' ? 'Worker niti' : 'Procesi'} × ${b.threads}`)),
      );
    },
    renderHistory(rows = []) {
      if (!rows.length) { history.replaceChildren(); return; }
      history.replaceChildren(
        h('div', { class: 'bench-hrow head' }, ...['Kada', 'Igra', 'Strategija', 'Radnici', 'Režim', 'Krugova/s', 'Vreme'].map((t) => h('span', {}, t))),
        ...rows.slice(0, 5).map((r) => h('div', { class: 'bench-hrow' },
          h('span', {}, String(r.ts || '').replace('T', ' ').slice(5, 16)),
          h('span', {}, r.game), h('span', { title: r.strategy }, r.strategy), h('span', {}, String(r.threads)),
          h('span', {}, r.workerMode === 'threads' ? 'niti' : 'procesi'), h('span', {}, n0(r.roundsPerSec)), h('span', {}, `${fmt((r.durationMs || 0) / 1000, 1)} s`))),
      );
    },
    el: { card, history },
  };
}
