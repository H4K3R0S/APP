// Pet Tier progres barova (1.5× / 2× / 5× / 10× / 1000×) — procenat sesija koje su dostigle nivo.
import { h, fmt } from '../ui/dom.js';
import { TIER_LABELS } from '../../../shared/sim_constants.js';

export function createTiers(el) {
  const rows = TIER_LABELS.map((label, i) => {
    const bar = h('div', { class: 'bar' });
    const pct = h('span', { class: 'pct' }, '—');
    const row = h('div', { class: 'tier-row', dataset: { tier: String(i + 1) } },
      h('div', { class: 'tier-head' }, h('span', { class: 'lbl' }, label), pct),
      h('div', { class: 'track' }, bar));
    return { row, bar, pct };
  });
  el.replaceChildren(h('div', { class: 'sim-sub' }, 'Uspešnost po Tier nivoima'), ...rows.map((r) => r.row));
  return {
    update(tierPcts = []) {
      rows.forEach((r, i) => {
        const v = Number(tierPcts[i]);
        if (!Number.isFinite(v)) { r.pct.textContent = '—'; r.bar.style.width = '0%'; return; }
        r.pct.textContent = `${fmt(v, 1)}%`;
        r.bar.style.width = `${Math.max(0, Math.min(100, v))}%`;
        r.row.classList.toggle('good', v >= 70);
        r.row.classList.toggle('mid', v >= 30 && v < 70);
        r.row.classList.toggle('bad', v < 30);
      });
    },
    reset() { this.update([]); },
  };
}
