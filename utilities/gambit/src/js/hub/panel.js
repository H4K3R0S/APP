// Hub bočni info-panel (korak 28): pravila/okidači, karton rizika, Učitaj / Obriši / Izvezi. Klizi sa desne ivice.
import { h, fmt } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { notifyStrategiesChanged } from '../state.js';
import { describeRules } from '../../../shared/describe.js';

const GAME_LABEL = { dice: 'Dice', mines: 'Mines', keno: 'Keno' };
const money = (x) => `${fmt(x, x < 1 ? 4 : 2)}$`;

export function createPanel(container, { onLoad, indexOf = () => 0 } = {}) {
  const idEl = h('div', { class: 'hp-id' });
  const title = h('h2', { id: 'hub-panel-title' });
  const meta = h('div', { class: 'hp-id', id: 'hub-panel-meta' });
  const closeBtn = h('button', { class: 'hp-close', type: 'button', title: 'Zatvori' }, '✕');
  const rules = h('div', { id: 'hub-panel-rules', class: 'hp-rules' });
  const triggers = h('div', { id: 'hub-panel-triggers' });
  const risk = h('div', { id: 'hub-panel-risk' });
  const loadBtn = h('button', { id: 'hub-load-btn', type: 'button', class: 'btn-primary' }, '🚀 UČITAJ U EKRAN IGRE');
  const deleteBtn = h('button', { id: 'hub-delete-btn', type: 'button', class: 'btn-secondary danger' }, '🗑️ Obriši');
  const exportBtn = h('button', { id: 'hub-export-btn', type: 'button', class: 'btn-secondary' }, '📤 Izvezi');
  const root = h('aside', { id: 'hub-panel' },
    h('div', { class: 'hp-head' }, h('div', { style: 'flex:1' }, idEl, title, meta), closeBtn),
    h('div', { class: 'hp-body' },
      h('div', { class: 'hp-section' }, h('div', { class: 'stat-sub' }, 'Pravila i okidači'), rules, triggers),
      h('div', { class: 'hp-section' }, h('div', { class: 'stat-sub' }, 'Statistički karton rizika'), risk)),
    h('div', { class: 'hp-actions' }, loadBtn, h('div', { class: 'row' }, deleteBtn, exportBtn)),
  );
  container.append(root);

  let current = null; // { entry, strategy, analysis }
  let openSeq = 0; // brzi klikovi A pa B: samo poslednji open piše u DOM

  function renderRisk(entry, analysis) {
    const s = entry.summary;
    if (!s) {
      risk.replaceChildren(h('div', { class: 'hp-none' }, 'Podaci nedostupni. Pokreni masovnu simulaciju nad ovom strategijom da generišeš analizu rizika.'));
      return;
    }
    const baseBet = Number(analysis?.overall?.baseBet) || Number(current?.strategy?.baseBet) || 0;
    risk.replaceChildren(h('div', { class: 'hp-risk' },
      h('div', {}, h('span', {}, 'Istorijski najgori Loss Streak'), h('b', { class: 'neg' }, String(s.maxLossStreak))),
      h('div', {}, h('span', {}, 'Šansa za 1000× (Tier 5)'), h('b', {}, `${fmt(s.tier5Avg, 2)}%`)),
      h('div', {}, h('span', {}, 'Uspešnost do Tier 3'), h('b', { class: s.tier3Avg > 70 ? 'pos' : '' }, `${fmt(s.tier3Avg, 1)}%`)),
      h('div', {}, h('span', {}, 'Bankrot prosek'), h('b', { class: 'neg' }, `${fmt(s.bankruptAvg, 1)}%`)),
      h('div', { class: 'rec-box' }, h('span', {}, 'AI preporuka za minimalni balans'),
        h('b', {}, `Za ulog od 1$: ${money(s.recommendedBalance)}${baseBet && baseBet !== 1 ? ` · za ulog ${baseBet}$: ${money(s.recommendedBalance * baseBet)}` : ''}`)),
    ));
  }

  const api = {
    el: { root, title, rules, triggers, risk, loadBtn, deleteBtn, exportBtn, closeBtn },
    isOpen: () => root.classList.contains('open'),
    current: () => current,
    async open(entry) {
      const seq = ++openSeq;
      const [strategy, analysis] = await Promise.all([
        window.gambitAPI.loadStrategy(entry.game, entry.name),
        entry.hasAnalysis ? window.gambitAPI.loadAnalysis(entry.game, entry.name) : Promise.resolve(null),
      ]);
      if (seq !== openSeq) return null;
      if (!strategy || strategy.error) { toast(strategy?.error || 'Strategija nije nađena', 'error'); return null; }
      current = { entry, strategy, analysis: analysis && !analysis.error ? analysis : null };
      idEl.textContent = `#STR-${String(indexOf(entry) + 1).padStart(3, '0')}`;
      title.textContent = entry.name;
      meta.textContent = `Tip: ${entry.type === 'multi' ? 'Multi-Strategy' : 'Solo'} | Igra: ${GAME_LABEL[entry.game] || entry.game}`;
      const rows = describeRules(strategy);
      rules.replaceChildren(...rows.filter((r) => !r.trigger).flatMap((r) => [h('span', {}, r.label), h('b', {}, r.value)]));
      triggers.replaceChildren(...rows.filter((r) => r.trigger).map((r) => h('div', { class: 'hp-trigger' }, `„${r.value}“`)));
      renderRisk(entry, current.analysis);
      root.classList.add('open');
      return current;
    },
    close() { root.classList.remove('open'); },
    async delete({ confirm = true } = {}) {
      if (!current) return false;
      const { entry } = current;
      if (confirm && !window.confirm(`Obrisati strategiju „${entry.name}“ (i njenu analizu)?`)) return false;
      const res = await window.gambitAPI.deleteStrategy(entry.game, entry.name);
      const ok = res === true;
      toast(ok ? `Obrisano: ${entry.name}` : (res?.error || 'Brisanje nije uspelo'), ok ? 'ok' : 'error');
      if (ok) { api.close(); current = null; notifyStrategiesChanged(); }
      return ok;
    },
    async exportJson() {
      if (!current) return false;
      const text = JSON.stringify(current.strategy, null, 2);
      try { await navigator.clipboard.writeText(text); toast('JSON kopiran u clipboard', 'ok'); return true; } catch { toast('Clipboard nedostupan', 'error'); return false; }
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  deleteBtn.addEventListener('click', () => api.delete());
  exportBtn.addEventListener('click', () => api.exportJson());
  loadBtn.addEventListener('click', () => { if (current && onLoad) onLoad(current.entry, current.strategy); });
  return api;
}
