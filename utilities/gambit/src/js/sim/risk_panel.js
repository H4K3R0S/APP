// AI Risk Management panel: najgori loss streak + preporuka sigurnosnog balansa + sažetak izveštaja.
import { h, fmt } from '../ui/dom.js';

const money = (x) => `${fmt(x, x < 1 ? 4 : 2)}$`;

export function createRiskPanel(el) {
  const worst = h('b', { id: 'sim-worst-streak', class: 'neg' }, '—');
  const rec = h('p', { id: 'sim-recommendation', class: 'rec' }, 'Pokreni masovni test da dobiješ preporuku.');
  const summary = h('div', { id: 'sim-summary', class: 'sim-summary' });
  el.replaceChildren(
    h('div', { class: 'sim-sub' }, 'AI procena rizika'),
    h('div', { class: 'risk-row' }, h('span', {}, 'Istorijski najgori Loss Streak:'), worst),
    rec,
    summary,
  );
  return {
    render(report) {
      const o = report.overall;
      worst.textContent = String(o.maxLossStreak);
      const perOne = o.recommendedBalance;
      const own = o.baseBet ? perOne * o.baseBet : null;
      rec.textContent = `Za početni ulog od 1$, istorijski najgori niz od ${o.maxLossStreak} promašaja zahteva minimalni sigurnosni balans od ${money(perOne)} kako ne bi došlo do bankrota.`
        + (own != null ? ` Za ulog strategije (${o.baseBet}$): ${money(own)}.` : '');
      summary.replaceChildren(
        h('div', {}, h('span', {}, 'Tier 3 prosek'), h('b', { class: o.tier3Avg >= 70 ? 'pos' : '' }, `${fmt(o.tier3Avg, 1)}%`)),
        h('div', {}, h('span', {}, 'Tier 5 (1000×)'), h('b', {}, `${fmt(o.tier5Avg, 1)}%`)),
        h('div', {}, h('span', {}, 'Bankrot prosek'), h('b', { class: 'neg' }, `${fmt(o.bankruptAvg, 1)}%`)),
        h('div', {}, h('span', {}, 'Sesija / krugova'), h('b', {}, `${report.sessionsTotal} / ${report.totalRounds.toLocaleString('sr-RS')}`)),
        h('div', {}, h('span', {}, 'Vreme'), h('b', {}, `${fmt(report.benchmark.durationMs / 1000, 2)} s`)),
        h('div', {}, h('span', {}, 'Brzina'), h('b', {}, `${report.benchmark.roundsPerSec.toLocaleString('sr-RS')} krug/s`)),
      );
    },
    reset() {
      worst.textContent = '—';
      rec.textContent = 'Pokreni masovni test da dobiješ preporuku.';
      summary.replaceChildren();
    },
  };
}
