// Dice Auto panel (minimalistički): broj krugova + strategija (pop-up uslovi) + petlja nad rollDice.
import { state } from '../../state.js';
import { toast } from '../../ui/toast.js';
import { createAutoLoop } from '../../auto/loop.js';
import { buildAutoPanel } from '../auto_panel.js';
import { playManualRound } from './manual.js';
import { STOP_REASON_TEXT } from '../../../../shared/bet_rules.js';
import { diceStrategy } from '../../../../shared/strategy_schema.js';
import { DICE_DO_ACTIONS } from '../../../../shared/conditions.js';

const DICE_ACTS = new Set(DICE_DO_ACTIONS);

export function mountDiceAuto(ui) {
  const panel = buildAutoPanel({
    prefix: 'dice', game: 'dice',
    buildStrategy: ({ strategyName, conditions }) => {
      const p = ui.getParams();
      return diceStrategy({ strategyName, baseBet: p.betAmount, startBalance: state.stats.initialBalance, targetValue: p.targetValue, condition: p.condition, conditions, maxBets: panel.getRules().maxBets });
    },
    applyStrategy: (s) => { ui.setMode('auto'); ui.setParams({ betAmount: s.baseBet, targetValue: s.targetValue, condition: s.condition }); },
  });
  ui.el.autoPanel.replaceChildren(...panel.elements);
  ui.el.autoPanel.classList.add('auto-panel');

  const lockable = () => [...panel.inputs,
    ui.el.betInput, ui.el.halfBtn, ui.el.doubleBtn, ui.el.multInput, ui.el.targetInput, ui.el.chanceInput, ui.el.condBtn, ui.el.tabManual, ui.el.tabAuto];

  function setLocked(locked) {
    for (const el of lockable()) el.disabled = locked;
    ui.el.slider.classList.toggle('locked', locked);
  }

  const loop = createAutoLoop({
    playRound: (bet) => playManualRound(ui, bet),
    getBalance: () => state.stats.balance,
    onRound: (_res, next, _bp, _sp, gs) => {
      // Dice uslovi mogu menjati šansu/smer → primeni na UI da sledeći krug igra novom šansom (playManualRound čita ui.getParams()).
      // gs postoji samo kad strategija koristi dice akcije (setChance/switchDir); setParams re-renderuje pa ulog postavljamo posle.
      if (gs) ui.setParams({ chance: gs.chance, condition: gs.condition });
      ui.el.betInput.value = String(next);
    },
    onStop: ({ reason }) => {
      setLocked(false);
      ui.el.betBtn.classList.remove('danger');
      ui.setMode('auto');
      toast(STOP_REASON_TEXT[reason] || reason, reason === 'bankrupt' || reason === 'error' ? 'error' : 'ok');
    },
  });

  const api = {
    loop,
    strategy: panel,
    getAutoRules: () => panel.getRules(),
    setAutoRules: (r) => panel.setRules(r),
    getConditions: () => panel.getConditions(),
    setConditions: (c) => panel.setConditions(c),
    isRunning: () => loop.isRunning(),
    async playOne() {
      if (loop.isRunning()) return null;
      return playManualRound(ui, ui.getParams().betAmount);
    },
    start({ delayMs } = {}) {
      const p = ui.getParams();
      const rules = panel.getRules();
      const err = panel.validate();
      if (p.betAmount < 0) { toast('Ulog ne može biti negativan', 'error'); return Promise.resolve(null); }
      if (err) { toast(err, 'error'); return Promise.resolve(null); }
      if (p.betAmount > state.stats.balance) { toast('Ulog je veći od balansa', 'error'); return Promise.resolve(null); }
      setLocked(true);
      ui.el.betBtn.textContent = 'ZAUSTAVI AUTO IGRU';
      ui.el.betBtn.classList.add('danger');
      const baseBet = p.betAmount;
      const baseChance = p.chance;
      const baseCondition = p.condition;
      const delay = delayMs != null ? delayMs : panel.getSpeed().delayMs;
      // Prosledi dice stanje (šansa/smer) samo ako strategija zaista koristi dice akcije — inače nema per-krug re-rendera.
      const usesDiceActions = (rules.conditions || []).some((c) => DICE_ACTS.has(c.do));
      const gameState = usesDiceActions ? { chance: baseChance, condition: baseCondition, baseChance } : null;
      return loop.start({ baseBet, rules, conditions: rules.conditions, maxBets: rules.maxBets, stopConditions: rules.stopConditions, delayMs: delay, gameState })
        .then((summary) => { ui.setParams({ betAmount: baseBet, chance: baseChance, condition: baseCondition }); ui.el.betInput.value = String(baseBet); return summary; });
    },
    stop() { loop.stop(); },
    fields: panel,
  };
  return api;
}
