// Minimalistički Auto panel (Stake-stil): Broj krugova + Strategija (padajuća lista, Napravi/Izmeni/Obriši) + čipovi uslova.
// Detaljna pravila uloga žive u pop-upu „Napredna opklada" (strategy_editor.js) kao lista uslova.
// Interfejs kompatibilan sa starim buildAutoFields: { elements, inputs, getRules, setRules, validate }.
import { h } from '../ui/dom.js';
import { toast } from '../ui/toast.js';
import { notifyStrategiesChanged } from '../state.js';
import { openStrategyEditor } from './strategy_editor.js';
import { deriveSimpleRules, validateConditions, describeCondition, normalizeConditions } from '../../../shared/conditions.js';

const RESET_RULES = { onLoss: { action: 'reset', value: 0 }, onWin: { action: 'reset', value: 0 }, stopConditions: { takeProfit: 0, stopLoss: 0 } };

// Tri brzine auto igre: normalno (animacije polja jedno po jedno), brzo, i bez animacije (trenutno).
export const SPEEDS = {
  normal: { delayMs: 320, stepMs: 55, label: '🐢 Normalno', hint: 'sa animacijama' },
  fast: { delayMs: 70, stepMs: 12, label: '⚡ Brzo', hint: 'ubrzano' },
  instant: { delayMs: 0, stepMs: 0, label: '⏩ Bez animacije', hint: 'trenutno' },
};
const SPEED_ORDER = ['normal', 'fast', 'instant'];

// Inverzno od deriveSimpleRules: prosti onLoss/onWin/stop → lista uslova (za kompatibilnost i učitavanje starih strategija).
function conditionsFromSimple({ onLoss, onWin, stopConditions } = {}) {
  const out = [];
  if (onLoss && onLoss.action === 'increase') out.push({ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: Number(onLoss.value) || 0 });
  else if (onLoss && onLoss.action === 'reset' && onWin && onWin.action === 'increase') out.push({ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'reset', value: 0 });
  if (onWin && onWin.action === 'increase') out.push({ kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'increase', value: Number(onWin.value) || 0 });
  else if (onWin && onWin.action === 'reset' && onLoss && onLoss.action === 'increase') out.push({ kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'reset', value: 0 });
  const tp = Number(stopConditions?.takeProfit) || 0;
  if (tp > 0) out.push({ kind: 'profit', on: 'profitAbove', count: tp, do: 'stop', value: 0 });
  const sl = Number(stopConditions?.stopLoss) || 0;
  if (sl > 0) out.push({ kind: 'profit', on: 'profitBelow', count: sl, do: 'stop', value: 0 });
  return out;
}

// cfg = { prefix, game, buildStrategy({strategyName, conditions})→strategija, applyStrategy(strategija) }
export function buildAutoPanel(cfg) {
  const { prefix, game, buildStrategy, applyStrategy } = cfg;
  let conditions = [];

  const betsInput = h('input', { id: `${prefix}-auto-bets`, type: 'number', step: '1', min: '0', value: '0', placeholder: '0 = ∞' });
  const infinityBtn = h('button', { type: 'button', class: 'inf-btn', title: 'Beskonačno' }, '∞');
  infinityBtn.addEventListener('click', () => { betsInput.value = '0'; });

  const select = h('select', { id: `${prefix}-strategy-select` }, h('option', { value: '' }, '— Bez strategije (ravan ulog) —'));
  const createBtn = h('button', { id: `${prefix}-strategy-create`, type: 'button', class: 'link-btn' }, '＋ Napravi strategiju');
  const editBtn = h('button', { id: `${prefix}-strategy-edit`, type: 'button', class: 'link-btn' }, '✎ Izmeni');
  const deleteBtn = h('button', { id: `${prefix}-strategy-delete`, type: 'button', class: 'btn-secondary danger', title: 'Obriši izabranu' }, '🗑');
  const chips = h('div', { id: `${prefix}-conditions`, class: 'cond-chips' });
  // Skriveno polje imena (kompatibilnost: injector/smoke); pravo imenovanje ide kroz pop-up.
  const nameInput = h('input', { id: `${prefix}-strategy-name`, type: 'hidden' });

  // Brzina auto igre (3 opcije)
  let speed = 'normal';
  const speedBtns = {};
  const speedRow = h('div', { id: `${prefix}-speed`, class: 'speed-row' }, ...SPEED_ORDER.map((k) => {
    const b = h('button', { type: 'button', class: `speed-btn ${k === speed ? 'on' : ''}`, dataset: { speed: k }, title: SPEEDS[k].hint }, SPEEDS[k].label);
    b.addEventListener('click', () => api.setSpeed(k));
    speedBtns[k] = b;
    return b;
  }));

  const elements = [
    h('label', { class: 'field' }, h('span', {}, 'Broj krugova (0 = ∞)'), h('div', { class: 'bet-row' }, betsInput, infinityBtn)),
    h('div', { class: 'field' },
      h('div', { class: 'strat-head' }, h('span', {}, 'Strategija'), h('div', { class: 'row' }, createBtn, editBtn)),
      h('div', { class: 'row' }, select, deleteBtn)),
    h('div', { class: 'field' }, h('span', {}, 'Brzina auto igre'), speedRow),
    h('div', { class: 'field' }, h('span', {}, 'Uslovi'), chips),
    nameInput,
  ];
  const inputs = [betsInput, infinityBtn, select, createBtn, editBtn, deleteBtn, ...Object.values(speedBtns)];

  function renderChips() {
    if (!conditions.length) { chips.replaceChildren(h('span', { class: 'cond-empty' }, 'Nema uslova — ravan ulog. Klikni „Napravi strategiju".')); return; }
    chips.replaceChildren(...conditions.map((c, i) => h('span', { class: 'cond-chip', title: describeCondition(c) }, `${i + 1}. ${describeCondition(c)}`)));
  }

  const api = {
    elements, inputs, el: { betsInput, select, createBtn, editBtn, deleteBtn, chips, nameInput },
    list: [],
    getConditions: () => conditions.map((c) => ({ ...c })),
    setConditions(list) { conditions = normalizeConditions(list); renderChips(); },
    getSpeed: () => ({ key: speed, ...SPEEDS[speed] }),
    setSpeed(k) {
      if (!SPEEDS[k]) return;
      speed = k;
      for (const key of SPEED_ORDER) speedBtns[key].classList.toggle('on', key === speed);
    },
    getRules() {
      const derived = conditions.length ? deriveSimpleRules(conditions) : RESET_RULES;
      return { maxBets: Math.max(0, Math.floor(Number(betsInput.value) || 0)), conditions: api.getConditions(), ...derived };
    },
    setRules(r = {}) {
      if (r.maxBets != null) betsInput.value = String(r.maxBets);
      if (r.conditions != null) api.setConditions(r.conditions);
      else if (r.onLoss || r.onWin || r.stopConditions) api.setConditions(conditionsFromSimple(r)); // kompatibilnost sa prostim pravilima
    },
    validate() {
      if (conditions.length) {
        const v = validateConditions(conditions);
        if (!v.ok) return v.errors[0];
      }
      return null;
    },
    async refresh(selectName) {
      const l = await window.gambitAPI.listStrategies(game);
      api.list = Array.isArray(l) ? l : [];
      select.replaceChildren(h('option', { value: '' }, '— Bez strategije (ravan ulog) —'),
        ...api.list.map((s) => h('option', { value: s.name }, s.hasAnalysis ? `${s.name} ✓` : s.name)));
      select.value = selectName && api.list.some((s) => s.name === selectName) ? selectName : '';
      return api.list;
    },
    // Primeni gotov objekat strategije (npr. iz Hub injekcije) direktno — bez učitavanja sa diska.
    async apply(s) {
      if (!s) return null;
      if (applyStrategy) applyStrategy(s);
      api.setConditions(s.conditions && s.conditions.length ? s.conditions : conditionsFromSimple(s));
      if (s.maxBets != null) betsInput.value = String(s.maxBets);
      await api.refresh(s.strategyName);
      return s;
    },
    async load(name) {
      if (!name) { api.setConditions([]); return null; }
      const s = await window.gambitAPI.loadStrategy(game, name);
      if (!s || s.error) { toast(s?.error || `Strategija ${name} nije nađena`, 'error'); return null; }
      if (applyStrategy) applyStrategy(s);
      // strategija sa uslovima → koristi ih; stara/prosta strategija → izvedi uslove iz onLoss/onWin/stop
      api.setConditions(s.conditions && s.conditions.length ? s.conditions : conditionsFromSimple(s));
      if (s.maxBets != null) betsInput.value = String(s.maxBets);
      // padajuća lista možda još ne sadrži tek sačuvanu strategiju (npr. injekcija posle save) → osveži je
      if (![...select.options].some((o) => o.value === name)) await api.refresh(name);
      else select.value = name;
      return s;
    },
    async save(strategyName, conds) {
      const name = strategyName != null ? strategyName : nameInput.value;
      const useConds = conds != null ? conds : api.getConditions();
      const strategy = buildStrategy({ strategyName: name, conditions: useConds });
      const res = await window.gambitAPI.saveStrategy(game, strategy);
      if (!res || res.error) { toast(res?.error || 'Čuvanje nije uspelo', 'error'); return null; }
      api.setConditions(useConds);
      await api.refresh(res.name);
      toast(`Sačuvano: ${res.name}`, 'ok');
      notifyStrategiesChanged();
      return res;
    },
    async remove(name) {
      const target = name || select.value || nameInput.value;
      if (!target) { toast('Izaberi strategiju za brisanje', 'error'); return false; }
      const res = await window.gambitAPI.deleteStrategy(game, target);
      const ok = res === true;
      await api.refresh();
      toast(ok ? `Obrisano: ${target}` : (res?.error || 'Nema šta da se obriše'), ok ? 'ok' : 'error');
      if (ok) { api.setConditions([]); notifyStrategiesChanged(); }
      return ok;
    },
    openEditor(name) {
      openStrategyEditor({
        game,
        initial: { strategyName: name || select.value || '', conditions: api.getConditions() },
        onSave: ({ strategyName, conditions: conds }) => api.save(strategyName, conds),
      });
    },
  };

  createBtn.addEventListener('click', () => api.openEditor(''));
  editBtn.addEventListener('click', () => api.openEditor());
  deleteBtn.addEventListener('click', () => api.remove());
  select.addEventListener('change', () => api.load(select.value));
  renderChips();
  api.refresh();
  return api;
}
