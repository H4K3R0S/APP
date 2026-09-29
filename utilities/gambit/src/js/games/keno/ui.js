// Keno UI: leva sekcija (tabovi, ulog, rizik, očisti/nasumično, dugme) + srednja (tabla 40 + isplatna tablica).
import { h, fmt } from '../../ui/dom.js';
import { RISKS, MAX_PICKS, BOARD, paytableFor } from '../../../../shared/keno_paytables.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;
const RISK_LABELS = { classic: 'Klasičan (Classic)', low: 'Niski (Low)', medium: 'Srednji (Medium)', high: 'Visoki (High)' };
const localRng = { int: (n) => Math.floor(Math.random() * n) };

export function mountKenoUI(panels) {
  const params = { betAmount: 1, riskLevel: 'classic' };
  let selected = new Set();
  let mode = 'manual';
  let locked = false;
  const betHandlers = [];
  const numberHandlers = [];
  const drawHandlers = [];

  // --- Leva sekcija ---
  const tabManual = h('button', { id: 'keno-tab-manual', class: 'tab active', type: 'button' }, 'Manual');
  const tabAuto = h('button', { id: 'keno-tab-auto', class: 'tab', type: 'button' }, 'Auto');
  panels.left.tabs.append(h('div', { class: 'mode-tabs' }, tabManual, tabAuto));

  const betInput = h('input', { id: 'keno-bet', type: 'number', step: '0.001', min: '0', value: '1' });
  const halfBtn = h('button', { id: 'keno-half', type: 'button', class: 'quick' }, '½');
  const doubleBtn = h('button', { id: 'keno-double', type: 'button', class: 'quick' }, '2×');
  const riskSelect = h('select', { id: 'keno-risk' }, ...RISKS.map((r) => h('option', { value: r }, RISK_LABELS[r])));
  const clearBtn = h('button', { id: 'keno-clear', type: 'button', class: 'btn-secondary' }, 'Očisti tabelu');
  const pickBtn = h('button', { id: 'keno-autopick', type: 'button', class: 'btn-secondary' }, 'Izaberi nasumično (10)');
  const autoPanel = h('div', { id: 'keno-auto-panel', hidden: true });
  panels.left.inputs.append(
    h('label', { class: 'field' }, h('span', {}, 'Ulog (Bet Amount)'), h('div', { class: 'bet-row' }, betInput, halfBtn, doubleBtn)),
    h('label', { class: 'field' }, h('span', {}, 'Režim rizika (Risk Level)'), riskSelect),
    h('div', { class: 'keno-quick' }, clearBtn, pickBtn),
    autoPanel,
  );
  const playOneBtn = h('button', { id: 'keno-play-one', type: 'button', class: 'btn-play-one', hidden: true }, '▶ Odigraj 1 krug');
  const betBtn = h('button', { id: 'keno-bet-btn', type: 'button', class: 'btn-primary' }, 'POKRENI IGRU');
  panels.left.actions.append(playOneBtn, betBtn);
  const playOneHandlers = [];
  playOneBtn.addEventListener('click', () => { for (const fn of playOneHandlers) fn(); });

  // --- Srednja sekcija: tabla + isplatna tablica ---
  const cells = [null];
  for (let n = 1; n <= BOARD; n++) {
    const c = h('button', { type: 'button', class: 'keno-number', dataset: { number: String(n) } }, String(n));
    c.addEventListener('click', () => { for (const fn of numberHandlers) fn(n); });
    cells.push(c);
  }
  const board = h('div', { id: 'keno-board', class: 'keno-board' }, ...cells.slice(1));
  const paytable = h('div', { id: 'keno-paytable', class: 'keno-paytable' });
  const statsSlot = h('div', { id: 'keno-stats-slot', class: 'keno-stats-slot' });
  panels.center.render.append(h('div', { class: 'keno-render' }, h('div', { class: 'keno-main' }, board, paytable), statsSlot));

  function renderPaytable() {
    const picks = selected.size;
    const rows = paytableFor(params.riskLevel, picks);
    paytable.replaceChildren(
      h('div', { class: 'stat-sub' }, picks ? `Isplata za ${picks} ${picks === 1 ? 'broj' : 'brojeva'}` : 'Izaberi 1–10 brojeva'),
      ...rows.map((m, hits) => h('div', { class: `pt-row ${m > 0 ? 'pays' : ''}` }, h('span', {}, `${hits}×`), h('b', {}, `${fmt(m, 2)}×`))),
    );
  }
  function renderSelection() {
    const full = selected.size >= MAX_PICKS;
    for (let n = 1; n <= BOARD; n++) {
      const sel = selected.has(n);
      cells[n].classList.toggle('keno-selected', sel);
      cells[n].disabled = locked || (full && !sel);
    }
    renderPaytable();
  }
  function render(skip) {
    if (skip !== betInput) betInput.value = String(params.betAmount);
    riskSelect.value = params.riskLevel;
    renderSelection();
  }
  function setBet(v) {
    const n = Number(v);
    params.betAmount = Number.isFinite(n) && n >= 0 ? r8(n) : 0;
    render();
  }

  betInput.addEventListener('change', () => setBet(betInput.value));
  betInput.addEventListener('input', () => { const n = Number(betInput.value); if (n >= 0) { params.betAmount = r8(n); render(betInput); } });
  halfBtn.addEventListener('click', () => setBet(params.betAmount / 2));
  doubleBtn.addEventListener('click', () => setBet(params.betAmount * 2));
  riskSelect.addEventListener('change', () => { params.riskLevel = RISKS.includes(riskSelect.value) ? riskSelect.value : 'classic'; render(); });
  clearBtn.addEventListener('click', () => api.clear());
  pickBtn.addEventListener('click', () => api.autoPick());
  tabManual.addEventListener('click', () => api.setMode('manual'));
  tabAuto.addEventListener('click', () => api.setMode('auto'));
  betBtn.addEventListener('click', () => { for (const fn of betHandlers) fn(); });

  const api = {
    el: { betInput, halfBtn, doubleBtn, riskSelect, clearBtn, pickBtn, betBtn, playOneBtn, board, cells, paytable, autoPanel, tabManual, tabAuto, statsSlot },
    onPlayOne(fn) { playOneHandlers.push(fn); },
    getParams() { return { betAmount: params.betAmount, riskLevel: params.riskLevel, selectedNumbers: [...selected].sort((a, b) => a - b) }; },
    setParams(p = {}) {
      if (p.betAmount != null) { const n = Number(p.betAmount); params.betAmount = n >= 0 ? r8(n) : 0; }
      if (p.riskLevel && RISKS.includes(p.riskLevel)) params.riskLevel = p.riskLevel;
      if (Array.isArray(p.selectedNumbers)) api.setSelected(p.selectedNumbers);
      render();
    },
    setSelected(nums) {
      selected = new Set([...new Set((nums || []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= BOARD))].slice(0, MAX_PICKS));
      renderSelection();
    },
    // true ako je stanje promenjeno; false kad je 10 već izabrano (11. odbijen) ili je zaključano
    toggleNumber(n) {
      if (locked) return false;
      if (selected.has(n)) { selected.delete(n); renderSelection(); return true; }
      if (selected.size >= MAX_PICKS) return false;
      selected.add(n);
      renderSelection();
      return true;
    },
    clear() { selected = new Set(); api.clearDraw(); renderSelection(); },
    autoPick(k = MAX_PICKS, rng = localRng) {
      const pool = Array.from({ length: BOARD }, (_, i) => i + 1);
      const out = [];
      while (out.length < Math.min(k, MAX_PICKS)) { const i = rng.int(pool.length); out.push(pool.splice(i, 1)[0]); }
      api.setSelected(out);
      return out.sort((a, b) => a - b);
    },
    getMode() { return mode; },
    setMode(m) {
      mode = m === 'auto' ? 'auto' : 'manual';
      tabManual.classList.toggle('active', mode === 'manual');
      tabAuto.classList.toggle('active', mode === 'auto');
      autoPanel.hidden = mode !== 'auto';
      playOneBtn.hidden = mode !== 'auto';
      betBtn.textContent = mode === 'auto' ? 'POKRENI AUTO IGRU' : 'POKRENI IGRU';
    },
    onBet(fn) { betHandlers.push(fn); },
    onNumber(fn) { numberHandlers.push(fn); },
    onDraw(fn) { drawHandlers.push(fn); },
    drawHandlers,
    // Vizuelno izvlačenje: hit = izvučen i izabran, miss = izvučen a nije izabran
    markNumber(n, kind) { cells[n].classList.add(kind === 'hit' ? 'keno-hit' : 'keno-miss'); },
    clearDraw() { for (let n = 1; n <= BOARD; n++) cells[n].classList.remove('keno-hit', 'keno-miss'); },
    setAnchors(nums) {
      for (let n = 1; n <= BOARD; n++) cells[n].classList.remove('keno-anchor');
      for (const n of nums || []) if (cells[n]) cells[n].classList.add('keno-anchor');
    },
    // heat: Float32Array(81) ∈ [0,1] ili null (isključi)
    setHeat(heat) {
      board.classList.toggle('heat-on', !!heat);
      for (let n = 1; n <= BOARD; n++) cells[n].style.setProperty('--heat', heat ? String(heat[n] || 0) : '0');
    },
    setLocked(b) {
      locked = !!b;
      for (const el of [betInput, halfBtn, doubleBtn, riskSelect, clearBtn, pickBtn, tabManual, tabAuto]) el.disabled = locked;
      renderSelection();
    },
    isLocked: () => locked,
    setBusy(b) { betBtn.disabled = !!b; },
  };

  render();
  return api;
}
