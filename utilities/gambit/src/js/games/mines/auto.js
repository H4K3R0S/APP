// Mines Auto (minimalistički panel): izbor polja klikom na mrežu, strategija (pop-up uslovi), petlja (start → reveal izabranih → cashout/eksplozija).
import { state, applyRound } from '../../state.js';
import { toast } from '../../ui/toast.js';
import { createAutoLoop } from '../../auto/loop.js';
import { buildAutoPanel } from '../auto_panel.js';
import { STOP_REASON_TEXT } from '../../../../shared/bet_rules.js';
import { FIELDS } from '../../../../shared/mines_math.js';
import { minesStrategy } from '../../../../shared/strategy_schema.js';
import { createShiftState } from '../../../../shared/mines_shift.js';
import { mountShiftUI } from './shift_ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const localRng = { int: (n) => Math.floor(Math.random() * n) };

export function mountMinesAuto(ui) {
  let selected = [];
  const panel = buildAutoPanel({
    prefix: 'mines', game: 'mines',
    buildStrategy: ({ strategyName, conditions }) => {
      const p = ui.getParams();
      return minesStrategy({ strategyName, baseBet: p.betAmount, startBalance: state.stats.initialBalance, minesCount: p.minesCount, selectedFields: [...selected], shift: shiftUI.getShift(), conditions, maxBets: panel.getRules().maxBets });
    },
    applyStrategy: (s) => { ui.setMode('auto'); ui.setParams({ betAmount: s.baseBet, minesCount: s.minesCount }); api.setSelectedFields(s.selectedFields); if (s.shift) shiftUI.setShift(s.shift); },
  });
  ui.el.autoPanel.replaceChildren(...panel.elements);
  ui.el.autoPanel.classList.add('auto-panel');
  const shiftUI = mountShiftUI(ui.el.autoPanel);

  let stepDelay = 40;
  let shiftState = null;
  let shiftCount = 0;
  const shiftHooks = {
    onWin: (f) => (shiftState ? shiftState.onWin(f, localRng) : null),
    onLoss: (f) => (shiftState ? shiftState.onLoss(f, localRng) : null),
    reset: () => { shiftState = createShiftState(shiftUI.getShift()); shiftCount = 0; },
  };

  function paintSelection() {
    for (let i = 0; i < FIELDS; i++) {
      const st = ui.fieldState(i);
      if (selected.includes(i)) { if (st === 'hidden' || st === 'selected') ui.setField(i, 'selected'); }
      else if (st === 'selected') ui.setField(i, 'hidden');
    }
    ui.setPotential(selected.length); // A7: prikaži mogući multiplikator za broj izabranih polja
  }

  function toggleField(i) {
    if (loop.isRunning() || ui.isRoundActive()) return;
    selected = selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i].sort((a, b) => a - b);
    paintSelection();
  }

  const lockable = () => [...panel.inputs, ...shiftUI.inputs, ui.el.betInput, ui.el.halfBtn, ui.el.doubleBtn, ui.el.minesSelect, ui.el.tabManual, ui.el.tabAuto];
  function setLocked(locked) { for (const el of lockable()) el.disabled = locked; }

  function dimMines(mines, except) { for (const m of mines) if (m !== except) ui.setField(m, 'mine-dim'); }

  // Jedna auto runda: vraća {isWin, profit} ili null (greška).
  async function playRound(bet) {
    const p = ui.getParams();
    const res = await window.gambitAPI.startMines({ betAmount: bet, minesCount: p.minesCount, balance: state.stats.balance });
    if (!res || res.error) { toast(res?.error || 'Greška pri startu', 'error'); return null; }
    ui.resetGrid();
    paintSelection();
    ui.setRound(true, 0);
    let result = null;
    for (const i of selected) {
      const r = await window.gambitAPI.revealMinesField(i);
      if (!r || r.error) {
        toast(r?.error || 'Greška', 'error');
        await window.gambitAPI.abortMines().catch(() => {});
        ui.setRound(false);
        return null;
      }
      if (r.status === 'lose') { ui.setField(i, 'mine'); dimMines(r.mines, i); result = { isWin: false, profit: r.profit }; break; }
      ui.setField(i, 'diamond');
      if (r.status === 'win') { dimMines(r.mines, -1); result = { isWin: true, profit: r.profit, multiplier: r.multiplier }; break; }
      ui.setRound(true, r.revealed);
      if (stepDelay > 0) await sleep(stepDelay);
    }
    if (!result) {
      const c = await window.gambitAPI.cashoutMines();
      if (!c || c.error) { toast(c?.error || 'Greška pri isplati', 'error'); ui.setRound(false); return null; }
      dimMines(c.mines, -1);
      result = { isWin: true, profit: c.profit, multiplier: c.multiplier };
    }
    ui.setRound(false);
    applyRound({ game: 'mines', betAmount: bet, ...result });
    const hook = result.isWin ? shiftHooks.onWin : shiftHooks.onLoss;
    if (hook) {
      const next = hook(selected);
      if (next) { selected = [...next].sort((a, b) => a - b); shiftCount += 1; paintSelection(); }
    }
    return result;
  }

  const loop = createAutoLoop({
    playRound,
    getBalance: () => state.stats.balance,
    onRound: (_res, next) => { ui.el.betInput.value = String(next); },
    onStop: ({ reason }) => {
      setLocked(false);
      ui.setGridEnabled(true);
      ui.el.betBtn.classList.remove('danger');
      ui.setMode('auto');
      toast(STOP_REASON_TEXT[reason] || reason, reason === 'bankrupt' || reason === 'error' ? 'error' : 'ok');
    },
  });

  function preflight() {
    const p = ui.getParams();
    if (selected.length === 0) { toast('Moraš izabrati bar jedno polje na mreži za auto-igranje', 'error'); return null; }
    if (selected.length > FIELDS - p.minesCount) { toast(`Najviše ${FIELDS - p.minesCount} polja za ${p.minesCount} mina`, 'error'); return null; }
    if (p.betAmount < 0) { toast('Ulog ne može biti negativan', 'error'); return null; }
    if (p.betAmount > state.stats.balance) { toast('Ulog je veći od balansa', 'error'); return null; }
    return p;
  }

  const api = {
    loop,
    fields: panel,
    strategy: panel,
    shiftHooks,
    getAutoRules: () => panel.getRules(),
    setAutoRules: (r) => panel.setRules(r),
    getConditions: () => panel.getConditions(),
    setConditions: (c) => panel.setConditions(c),
    getShift: () => shiftUI.getShift(),
    setShift: (s) => shiftUI.setShift(s),
    getShiftCount: () => shiftCount,
    getSelectedFields: () => [...selected],
    setSelectedFields(arr) {
      selected = [...new Set((arr || []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < FIELDS))].sort((a, b) => a - b);
      paintSelection();
    },
    toggleField,
    isRunning: () => loop.isRunning(),
    // Odigraj tačno 1 auto rundu (dugme „▶ Odigraj 1 krug")
    async playOne() {
      if (loop.isRunning() || ui.isRoundActive()) return null;
      if (!preflight()) return null;
      shiftHooks.reset();
      stepDelay = panel.getSpeed().stepMs;
      ui.setInputsLocked(true);
      const r = await playRound(ui.getParams().betAmount);
      ui.setInputsLocked(false);
      ui.setGridEnabled(false);
      ui.el.betInput.value = String(ui.getParams().betAmount);
      return r;
    },
    start({ delayMs } = {}) {
      const p = preflight();
      if (!p) return Promise.resolve(null);
      const err = panel.validate();
      if (err) { toast(err, 'error'); return Promise.resolve(null); }
      const rules = panel.getRules();
      if (shiftHooks.reset) shiftHooks.reset();
      const sp = panel.getSpeed();
      const delay = delayMs != null ? delayMs : sp.delayMs;
      stepDelay = delayMs != null ? delayMs : sp.stepMs; // pacing otkrivanja polja
      setLocked(true);
      ui.setGridEnabled(false);
      ui.el.betBtn.textContent = 'ZAUSTAVI AUTO IGRU';
      ui.el.betBtn.classList.add('danger');
      const baseBet = p.betAmount;
      return loop.start({ baseBet, rules, conditions: rules.conditions, maxBets: rules.maxBets, stopConditions: rules.stopConditions, delayMs: delay })
        .then((summary) => { ui.setParams({ betAmount: baseBet }); ui.el.betInput.value = String(baseBet); return summary; });
    },
    stop() { loop.stop(); },
  };
  return api;
}
