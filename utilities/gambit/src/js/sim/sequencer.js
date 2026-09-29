// Multi-Strategy sekvencer (korak 23): polazna strategija + blokovi uslova „AKO … ➔ PREBACI NA …“ + akcije po igri.
import { h, fmt } from '../ui/dom.js';
import { state } from '../state.js';
import { hybridStrategy } from '../../../shared/hybrid_schema.js';

const WHEN_LABELS = { lossStreak: 'Gubitnički niz', balanceDrop: 'Trenutni balans' };
const ACTION_BY_GAME = {
  mines: { key: 'minesShift', label: 'Za Mines: izvrši trenutnu rotaciju matrice polja (algoritam nove strategije)' },
  keno: { key: 'kenoSwapAnchors', label: 'Za Keno: zameni top 3 fiksna sidra sekundarnim parom' },
  dice: { key: 'diceRaiseMultiplier', label: 'Za Dice: nova strategija donosi svoj cilj/multiplikator (informativno — nema dodatne akcije)' },
};

export function mountSequencer(root, { onRun } = {}) {
  let strategies = [];
  const rows = [];
  let seq = 0;
  let rowsGame = state.game;

  const baseSelect = h('select', { id: 'seq-base-select' }, h('option', { value: '' }, '— Odaberi polaznu strategiju —'));
  const baseInfo = h('div', { id: 'seq-base-info', class: 'seq-base-info' }, 'Polazna strategija diktira pravila dok se ne ispuni prvi uslov.');
  const container = h('div', { id: 'sequencer-conditions-container', class: 'seq-conditions' });
  const addBtn = h('button', { id: 'seq-add-btn', type: 'button', class: 'btn-secondary' }, '+ Dodaj novi uslov promene');
  const nameInput = h('input', { id: 'seq-name', type: 'text', placeholder: 'Naziv hibridne simulacije', maxlength: '60' });
  const runBtn = h('button', { id: 'seq-run-btn', type: 'button', class: 'btn-primary blue' }, 'POKRENI MULTI-STRATEGY SIMULACIJU (1.000.000 krugova)');

  root.replaceChildren(
    h('div', { class: 'seq-panel' },
      h('div', { class: 'stat-sub' }, '1. Polazna tačka'),
      h('label', { class: 'field' }, h('span', {}, 'Polazna strategija'), baseSelect),
      baseInfo),
    h('div', { class: 'seq-panel grow' },
      h('div', { class: 'stat-sub' }, '2. Sekvencer uslova i okidača'),
      container,
      addBtn,
      h('p', { class: 'seq-hint' }, 'Uslovi se proveravaju odozgo nadole; svaki okida najviše jednom po sesiji. Balans i tekući ulog se prenose na novu strategiju.')),
    h('div', { class: 'seq-panel seq-actions' },
      h('label', { class: 'field grow' }, h('span', {}, 'Naziv hibridne simulacije'), nameInput),
      runBtn),
  );

  function strategyOptions(selected) {
    const sel = h('select', { class: 'seq-target' }, h('option', { value: '' }, '— strategija —'),
      ...strategies.map((s) => h('option', { value: s.name }, s.name)));
    if (selected) sel.value = selected;
    return sel;
  }

  async function renderBaseInfo() {
    const name = baseSelect.value;
    if (!name) { baseInfo.textContent = 'Polazna strategija diktira pravila dok se ne ispuni prvi uslov.'; return; }
    // lista nosi samo ime/tip — puni JSON se učitava po izboru
    const s = await window.gambitAPI.loadStrategy(state.game, name).catch(() => null);
    if (!s || s.error || baseSelect.value !== name) return;
    const parts = [`Ulog ${s.baseBet}`];
    if (s.game === 'dice') parts.push(`šansa ${fmt(s.winChance ?? 0, 2)}% (${s.condition} ${s.targetValue})`);
    if (s.game === 'mines') parts.push(`${s.minesCount} mina, ${(s.selectedFields || []).length} polja`);
    if (s.game === 'keno') parts.push(`rizik ${s.riskLevel}${s.anchor?.enabled ? ', sidro' : ''}`);
    parts.push(`na gubitak: ${s.onLoss?.action === 'increase' ? `+${s.onLoss.value}%` : 'reset'}`);
    baseInfo.textContent = `${s.strategyName || s.name}: ${parts.join(' · ')}`;
  }

  function addRow(cfg = {}) {
    const id = `seq-row-${++seq}`;
    const when = h('select', { class: 'seq-when' }, ...Object.entries(WHEN_LABELS).map(([k, v]) => h('option', { value: k }, v)));
    when.value = cfg.when || 'lossStreak';
    const value = h('input', { class: 'seq-value', type: 'number', min: '1', step: '1', value: String(cfg.value ?? 5) });
    const unit = h('span', { class: 'seq-unit' }, '');
    const target = strategyOptions(cfg.switchTo);
    const game = state.game;
    const action = ACTION_BY_GAME[game];
    const actionBox = h('input', { type: 'checkbox', class: 'seq-action', checked: !!cfg.actions?.[action.key] });
    const removeBtn = h('button', { type: 'button', class: 'btn-secondary danger seq-remove', title: 'Ukloni uslov' }, '🗑 Ukloni');
    const row = h('div', { id, class: 'seq-row', dataset: { kind: when.value } },
      h('div', { class: 'seq-sentence' },
        h('span', { class: 'kw' }, 'AKO'), when, h('span', { class: 'mid' }, ''), value, unit,
        h('span', { class: 'kw' }, '➔ PREBACI NA'), target, removeBtn),
      h('label', { class: 'seq-action-row' }, actionBox, h('span', {}, action.label)));
    const syncKind = () => {
      const mid = row.querySelector('.mid');
      if (when.value === 'balanceDrop') {
        mid.textContent = 'padne ispod'; unit.textContent = '% od početnog'; row.dataset.kind = 'balanceDrop';
        value.max = '100'; if (Number(value.value) > 100) value.value = '100';
      } else { mid.textContent = 'dostigne'; unit.textContent = 'krugova zaredom'; row.dataset.kind = 'lossStreak'; value.removeAttribute('max'); }
    };
    when.addEventListener('change', syncKind);
    syncKind();
    const entry = { id, row, when, value, target, actionBox, actionKey: action.key };
    removeBtn.addEventListener('click', () => api.removeRow(entry));
    rows.push(entry);
    container.append(row);
    return entry;
  }

  const api = {
    rows,
    el: { baseSelect, addBtn, nameInput, runBtn, container, baseInfo },
    setStrategies(list) {
      strategies = (list || []).filter((s) => s.type !== 'multi');
      if (rowsGame !== state.game) { api.clear(); rowsGame = state.game; } // redovi nose akciju po igri — nova igra = novi redovi
      const keepBase = baseSelect.value;
      baseSelect.replaceChildren(h('option', { value: '' }, '— Odaberi polaznu strategiju —'), ...strategies.map((s) => h('option', { value: s.name }, s.name)));
      baseSelect.value = strategies.some((s) => s.name === keepBase) ? keepBase : '';
      for (const r of rows) {
        const keep = r.target.value;
        const fresh = strategyOptions(keep);
        r.target.replaceWith(fresh);
        r.target = fresh;
      }
      renderBaseInfo();
    },
    setBase(name) { baseSelect.value = name; renderBaseInfo(); },
    addRow,
    removeRow(entry) {
      const i = rows.indexOf(entry);
      if (i >= 0) { rows.splice(i, 1); entry.row.remove(); }
    },
    clear() { for (const r of [...rows]) api.removeRow(r); },
    compile() {
      return hybridStrategy({
        game: state.game,
        strategyName: nameInput.value.trim(),
        baseStrategy: baseSelect.value,
        triggers: rows.map((r) => ({ when: r.when.value, value: Number(r.value.value), switchTo: r.target.value, actions: { [r.actionKey]: r.actionBox.checked } })),
      });
    },
  };

  baseSelect.addEventListener('change', renderBaseInfo);
  addBtn.addEventListener('click', () => addRow());
  runBtn.addEventListener('click', () => { if (onRun) onRun(api.compile()); });
  return api;
}
