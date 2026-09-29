// Dice UI: leva sekcija (tabovi, ulog, profit, dugme) + srednja (slider + 3 vezana polja).
import { h, qs, fmt } from '../../ui/dom.js';
import {
  clampChance, multiplierFromChance, chanceFromMultiplier, targetFromChance, chanceFromTarget,
  profitOnWin,
} from '../../../../shared/dice_math.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

export function mountDiceUI(panels) {
  const params = { betAmount: 1, chance: 49.5, condition: 'over' };
  let mode = 'manual';
  const betHandlers = [];

  // --- Leva sekcija ---
  const tabManual = h('button', { id: 'dice-tab-manual', class: 'tab active', type: 'button' }, 'Manual');
  const tabAuto = h('button', { id: 'dice-tab-auto', class: 'tab', type: 'button' }, 'Auto');
  panels.left.tabs.append(h('div', { class: 'mode-tabs' }, tabManual, tabAuto));

  const betInput = h('input', { id: 'dice-bet', type: 'number', step: '0.001', min: '0', value: '1' });
  const halfBtn = h('button', { id: 'dice-half', type: 'button', class: 'quick' }, '½');
  const doubleBtn = h('button', { id: 'dice-double', type: 'button', class: 'quick' }, '2×');
  const profitInput = h('input', { id: 'dice-profit', type: 'text', disabled: true });
  const autoPanel = h('div', { id: 'dice-auto-panel', hidden: true });
  panels.left.inputs.append(
    h('label', { class: 'field' }, h('span', {}, 'Ulog (Bet Amount)'),
      h('div', { class: 'bet-row' }, betInput, halfBtn, doubleBtn)),
    h('label', { class: 'field' }, h('span', {}, 'Dobitak na pobedu (Profit on Win)'), profitInput),
    autoPanel,
  );

  const playOneBtn = h('button', { id: 'dice-play-one', type: 'button', class: 'btn-play-one', hidden: true }, '▶ Odigraj 1 krug');
  const betBtn = h('button', { id: 'dice-bet-btn', type: 'button', class: 'btn-primary' }, 'BET');
  panels.left.actions.append(playOneBtn, betBtn);
  const playOneHandlers = [];
  playOneBtn.addEventListener('click', () => { for (const fn of playOneHandlers) fn(); });

  // --- Srednja sekcija: slider + parametri ---
  const trackLose = h('div', { class: 'dice-track lose' });
  const trackWin = h('div', { class: 'dice-track win' });
  const handle = h('div', { class: 'dice-handle' });
  const flash = h('div', { id: 'dice-roll-flash', class: 'dice-roll-flash' });
  const slider = h('div', { id: 'dice-slider', class: 'dice-slider' }, trackLose, trackWin, handle, flash);
  const scale = h('div', { class: 'dice-scale' }, ...[0, 25, 50, 75, 100].map((n) => h('span', {}, n)));

  const multInput = h('input', { id: 'dice-multiplier', type: 'number', step: '0.0001', min: '1.0102' });
  const condBtn = h('button', { id: 'dice-condition', type: 'button', class: 'cond' }, 'Roll Over');
  const targetInput = h('input', { id: 'dice-target', type: 'number', step: '0.01' });
  const chanceInput = h('input', { id: 'dice-chance', type: 'number', step: '0.01', min: '2', max: '98' });
  const paramsRow = h('div', { class: 'dice-params' },
    h('label', { class: 'field' }, h('span', {}, 'Multiplikator'), multInput),
    h('label', { class: 'field' }, condBtn, targetInput),
    h('label', { class: 'field' }, h('span', {}, 'Šansa za dobitak %'), chanceInput),
  );
  panels.center.render.append(h('div', { class: 'dice-render' }, scale, slider, paramsRow));

  // --- Render ---
  function render(skip) {
    const target = targetFromChance(params.chance, params.condition);
    if (skip !== multInput) multInput.value = fmt(multiplierFromChance(params.chance), 4);
    if (skip !== targetInput) targetInput.value = fmt(target, 2);
    if (skip !== chanceInput) chanceInput.value = fmt(params.chance, 2);
    if (skip !== betInput) betInput.value = String(params.betAmount);
    profitInput.value = fmt(profitOnWin(params.betAmount, params.chance), 8);
    condBtn.textContent = params.condition === 'over' ? 'Roll Over' : 'Roll Under';
    slider.classList.toggle('under', params.condition === 'under');
    handle.style.left = `${target}%`;
    if (params.condition === 'over') {
      trackLose.style.left = '0'; trackLose.style.width = `${target}%`;
      trackWin.style.left = `${target}%`; trackWin.style.width = `${100 - target}%`;
    } else {
      trackWin.style.left = '0'; trackWin.style.width = `${target}%`;
      trackLose.style.left = `${target}%`; trackLose.style.width = `${100 - target}%`;
    }
  }

  function setBet(v) {
    const n = Number(v);
    params.betAmount = Number.isFinite(n) && n >= 0 ? r8(n) : 0;
    render();
  }

  // --- Događaji ---
  betInput.addEventListener('change', () => setBet(betInput.value));
  betInput.addEventListener('input', () => { const n = Number(betInput.value); if (n >= 0) { params.betAmount = r8(n); render(betInput); } });
  halfBtn.addEventListener('click', () => setBet(params.betAmount / 2));
  doubleBtn.addEventListener('click', () => setBet(params.betAmount * 2));

  chanceInput.addEventListener('input', () => { params.chance = clampChance(chanceInput.value); render(chanceInput); });
  chanceInput.addEventListener('change', () => render());
  multInput.addEventListener('input', () => { if (multInput.value === '') return; params.chance = chanceFromMultiplier(multInput.value); render(multInput); });
  multInput.addEventListener('change', () => render());
  targetInput.addEventListener('input', () => { params.chance = chanceFromTarget(targetInput.value, params.condition); render(targetInput); });
  targetInput.addEventListener('change', () => render());
  condBtn.addEventListener('click', () => { params.condition = params.condition === 'over' ? 'under' : 'over'; render(); });

  // Slider: klik/prevlačenje → target po x poziciji
  const setFromPointer = (ev) => {
    const rect = slider.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((ev.clientX - rect.left) / rect.width) * 100));
    params.chance = chanceFromTarget(pct, params.condition);
    render();
  };
  slider.addEventListener('pointerdown', (ev) => {
    slider.setPointerCapture(ev.pointerId);
    setFromPointer(ev);
    const move = (e) => setFromPointer(e);
    const up = () => { slider.removeEventListener('pointermove', move); slider.removeEventListener('pointerup', up); };
    slider.addEventListener('pointermove', move);
    slider.addEventListener('pointerup', up);
  });

  tabManual.addEventListener('click', () => api.setMode('manual'));
  tabAuto.addEventListener('click', () => api.setMode('auto'));
  betBtn.addEventListener('click', () => { for (const fn of betHandlers) fn(); });

  const api = {
    el: { betInput, halfBtn, doubleBtn, profitInput, betBtn, playOneBtn, slider, handle, flash, multInput, targetInput, chanceInput, condBtn, autoPanel, tabManual, tabAuto },
    onPlayOne(fn) { playOneHandlers.push(fn); },
    getParams() {
      return {
        betAmount: params.betAmount,
        chance: params.chance,
        condition: params.condition,
        targetValue: targetFromChance(params.chance, params.condition),
        multiplier: multiplierFromChance(params.chance),
      };
    },
    setParams(p = {}) {
      if (p.condition === 'over' || p.condition === 'under') params.condition = p.condition;
      if (p.chance != null) params.chance = clampChance(p.chance);
      else if (p.targetValue != null) params.chance = chanceFromTarget(p.targetValue, params.condition);
      else if (p.multiplier != null) params.chance = chanceFromMultiplier(p.multiplier);
      if (p.betAmount != null) { const n = Number(p.betAmount); params.betAmount = n >= 0 ? r8(n) : 0; }
      render();
    },
    getMode() { return mode; },
    setMode(m) {
      mode = m === 'auto' ? 'auto' : 'manual';
      tabManual.classList.toggle('active', mode === 'manual');
      tabAuto.classList.toggle('active', mode === 'auto');
      autoPanel.hidden = mode !== 'auto';
      playOneBtn.hidden = mode !== 'auto';
      betBtn.textContent = mode === 'auto' ? 'POKRENI AUTO IGRU' : 'BET';
    },
    onBet(fn) { betHandlers.push(fn); },
    // Bljesak izvučenog broja na slideru (Task 4)
    flashRoll(value, isWin) {
      flash.textContent = fmt(value, 2);
      flash.style.left = `${Math.min(100, Math.max(0, value))}%`;
      flash.classList.remove('win', 'lose', 'show');
      void flash.offsetWidth;
      flash.classList.add(isWin ? 'win' : 'lose', 'show');
    },
    setBusy(busy) { betBtn.disabled = !!busy; },
  };

  render();
  return api;
}

export { qs };
