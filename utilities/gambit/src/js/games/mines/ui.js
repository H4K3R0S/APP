// Mines UI: leva sekcija (tabovi, ulog, broj mina, ukupni profit, dugme) + srednja (mreža 5×5).
import { h, fmt } from '../../ui/dom.js';
import { multiplier, nextMultiplier, MIN_MINES, MAX_MINES, FIELDS } from '../../../../shared/mines_math.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;
const FIELD_CLASSES = ['field-diamond', 'field-exploded', 'field-revealed', 'field-selected', 'field-dim'];

export function mountMinesUI(panels) {
  const params = { betAmount: 1, minesCount: 3 };
  let mode = 'manual';
  let revealed = 0;
  let roundActive = false;
  let potentialCount = 0; // broj izabranih polja u Auto režimu (za prikaz mogućeg multiplikatora)
  const betHandlers = [];
  const fieldHandlers = [];

  // --- Leva sekcija ---
  const tabManual = h('button', { id: 'mines-tab-manual', class: 'tab active', type: 'button' }, 'Manual');
  const tabAuto = h('button', { id: 'mines-tab-auto', class: 'tab', type: 'button' }, 'Auto');
  panels.left.tabs.append(h('div', { class: 'mode-tabs' }, tabManual, tabAuto));

  const betInput = h('input', { id: 'mines-bet', type: 'number', step: '0.001', min: '0', value: '1' });
  const halfBtn = h('button', { id: 'mines-half', type: 'button', class: 'quick' }, '½');
  const doubleBtn = h('button', { id: 'mines-double', type: 'button', class: 'quick' }, '2×');
  const minesSelect = h('select', { id: 'mines-count' },
    ...Array.from({ length: MAX_MINES - MIN_MINES + 1 }, (_, i) => h('option', { value: String(i + 1) }, String(i + 1))));
  minesSelect.value = '3';
  const profitLabel = h('span', {}, 'Ukupni profit (1.13×)');
  const profitInput = h('input', { id: 'mines-profit', type: 'text', disabled: true });
  const autoPanel = h('div', { id: 'mines-auto-panel', hidden: true });
  panels.left.inputs.append(
    h('label', { class: 'field' }, h('span', {}, 'Ulog (Bet Amount)'), h('div', { class: 'bet-row' }, betInput, halfBtn, doubleBtn)),
    h('label', { class: 'field' }, h('span', {}, 'Broj mina (Mines)'), minesSelect),
    h('label', { class: 'field' }, profitLabel, profitInput),
    autoPanel,
  );
  const playOneBtn = h('button', { id: 'mines-play-one', type: 'button', class: 'btn-play-one', hidden: true }, '▶ Odigraj 1 krug');
  const betBtn = h('button', { id: 'mines-bet-btn', type: 'button', class: 'btn-primary' }, 'POKRENI IGRU');
  panels.left.actions.append(playOneBtn, betBtn);
  const playOneHandlers = [];
  playOneBtn.addEventListener('click', () => { for (const fn of playOneHandlers) fn(); });

  // --- Srednja sekcija: mreža ---
  const cells = Array.from({ length: FIELDS }, (_, i) => {
    const c = h('button', { type: 'button', class: 'mine-field', dataset: { index: String(i) } }, h('span', { class: 'gem' }));
    c.addEventListener('click', () => { for (const fn of fieldHandlers) fn(i); });
    return c;
  });
  const grid = h('div', { id: 'mines-grid', class: 'mines-grid' }, ...cells);
  panels.center.render.append(h('div', { class: 'mines-render' }, grid));

  function render(skip) {
    if (skip !== betInput) betInput.value = String(params.betAmount);
    minesSelect.value = String(params.minesCount);
    const mult = roundActive ? multiplier(params.minesCount, revealed) : 1;
    const next = nextMultiplier(params.minesCount, roundActive ? revealed : 0);
    // A7: pri obeležavanju polja (Auto), prikaži multiplikator za izabran broj polja
    const showSel = !roundActive && mode === 'auto' && potentialCount > 0;
    const selMult = showSel ? multiplier(params.minesCount, Math.min(potentialCount, FIELDS - params.minesCount)) : 0;
    if (roundActive) profitLabel.textContent = `Ukupni profit (${fmt(mult, 2)}×) · sledeći ${fmt(next, 2)}×`;
    else if (showSel) profitLabel.textContent = `Za ${potentialCount} polja → ${fmt(selMult, 2)}× (moguća isplata ${fmt(params.betAmount * selMult, 2)}$)`;
    else profitLabel.textContent = `Ukupni profit (${fmt(next, 2)}×)`;
    profitInput.value = fmt(roundActive ? r8(params.betAmount * mult - params.betAmount)
      : showSel ? r8(params.betAmount * selMult - params.betAmount)
        : r8(params.betAmount * next - params.betAmount), 8);
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
  minesSelect.addEventListener('change', () => { params.minesCount = Number(minesSelect.value); render(); });
  tabManual.addEventListener('click', () => api.setMode('manual'));
  tabAuto.addEventListener('click', () => api.setMode('auto'));
  betBtn.addEventListener('click', () => { for (const fn of betHandlers) fn(); });

  const api = {
    el: { betInput, halfBtn, doubleBtn, minesSelect, profitInput, betBtn, playOneBtn, grid, cells, autoPanel, tabManual, tabAuto },
    getParams() { return { betAmount: params.betAmount, minesCount: params.minesCount }; },
    setParams(p = {}) {
      if (p.betAmount != null) { const n = Number(p.betAmount); params.betAmount = n >= 0 ? r8(n) : 0; }
      if (p.minesCount != null) params.minesCount = Math.min(MAX_MINES, Math.max(MIN_MINES, Math.floor(Number(p.minesCount) || 3)));
      render();
    },
    getMode() { return mode; },
    setMode(m) {
      mode = m === 'auto' ? 'auto' : 'manual';
      tabManual.classList.toggle('active', mode === 'manual');
      tabAuto.classList.toggle('active', mode === 'auto');
      autoPanel.hidden = mode !== 'auto';
      playOneBtn.hidden = mode !== 'auto' || roundActive;
      grid.classList.toggle('auto-pick', mode === 'auto');
      if (!roundActive) betBtn.textContent = mode === 'auto' ? 'POKRENI AUTO IGRU' : 'POKRENI IGRU';
      render();
    },
    onBet(fn) { betHandlers.push(fn); },
    onPlayOne(fn) { playOneHandlers.push(fn); },
    onField(fn) { fieldHandlers.push(fn); },
    // A7: prikaži mogući multiplikator za broj izabranih polja (Auto)
    setPotential(n) { potentialCount = Math.max(0, Number(n) || 0); render(); },
    // Stanje polja: 'hidden' | 'diamond' | 'mine' (eksplozija) | 'mine-dim' (otkrivena ostala mina) | 'selected' | 'dim'
    setField(i, st) {
      const c = cells[i];
      c.classList.remove(...FIELD_CLASSES);
      if (st === 'diamond') c.classList.add('field-diamond');
      else if (st === 'mine') c.classList.add('field-exploded');
      else if (st === 'mine-dim') c.classList.add('field-revealed');
      else if (st === 'selected') c.classList.add('field-selected');
      else if (st === 'dim') c.classList.add('field-dim');
    },
    fieldState(i) {
      const c = cells[i];
      if (c.classList.contains('field-diamond')) return 'diamond';
      if (c.classList.contains('field-exploded')) return 'mine';
      if (c.classList.contains('field-revealed')) return 'mine-dim';
      if (c.classList.contains('field-selected')) return 'selected';
      return 'hidden';
    },
    resetGrid(keepSelected = false) {
      cells.forEach((c, i) => { if (!(keepSelected && c.classList.contains('field-selected'))) api.setField(i, 'hidden'); });
    },
    setGridEnabled(on) { grid.classList.toggle('active', !!on); for (const c of cells) c.disabled = !on; },
    // Runda: prati broj otkrivenih radi prikaza profita; dugme prelazi u KESIRAJ.
    setRound(active, revealedCount = 0) {
      roundActive = !!active;
      revealed = revealedCount;
      betBtn.classList.toggle('cashout', roundActive);
      playOneBtn.hidden = mode !== 'auto' || roundActive;
      if (roundActive) {
        const mult = multiplier(params.minesCount, revealed);
        betBtn.textContent = revealed > 0 ? `KESIRAJ (${fmt(params.betAmount * mult, 2)}$)` : 'KESIRAJ / CASH OUT';
      } else {
        betBtn.textContent = mode === 'auto' ? 'POKRENI AUTO IGRU' : 'POKRENI IGRU';
      }
      render();
    },
    isRoundActive: () => roundActive,
    setBusy(b) { betBtn.disabled = !!b; },
    setInputsLocked(locked) {
      for (const el of [betInput, halfBtn, doubleBtn, minesSelect, tabManual, tabAuto]) el.disabled = !!locked;
    },
  };

  api.setGridEnabled(false);
  render();
  return api;
}
