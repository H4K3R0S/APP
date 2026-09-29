// Keno Auto (minimalistički panel): sidro strategija (3 najučestalija + 7 popune random/cold) ili ručni brojevi; strategija (pop-up uslovi); petlja.
import { h } from '../../ui/dom.js';
import { state } from '../../state.js';
import { toast } from '../../ui/toast.js';
import { createAutoLoop } from '../../auto/loop.js';
import { buildAutoPanel } from '../auto_panel.js';
import { playKenoRound } from './manual.js';
import { STOP_REASON_TEXT } from '../../../../shared/bet_rules.js';
import { buildTicket } from '../../../../shared/keno_freq.js';
import { kenoStrategy } from '../../../../shared/strategy_schema.js';

const localRng = { int: (n) => Math.floor(Math.random() * n) };

export function mountKenoAuto(ui, freqApi) {
  const anchorEnabled = h('input', { id: 'keno-anchor-enabled', type: 'checkbox' });
  const fillMode = h('select', { id: 'keno-fill-mode' },
    h('option', { value: 'random' }, 'Random Fill — nasumičnih 7'),
    h('option', { value: 'cold' }, 'Cold Numbers — 7 najređih'));
  const anchorBox = h('div', { id: 'sub-panel-anchor', class: 'anchor-box' },
    h('label', { class: 'anchor-toggle' }, anchorEnabled, h('span', {}, 'Aktiviraj Sidro Strategiju (top 3 fiksno + 7 dinamički)')),
    h('label', { class: 'field' }, h('span', {}, 'Popuna preostalih mesta'), fillMode));

  const panel = buildAutoPanel({
    prefix: 'keno', game: 'keno',
    buildStrategy: ({ strategyName, conditions }) => {
      const p = ui.getParams();
      return kenoStrategy({ strategyName, baseBet: p.betAmount, startBalance: state.stats.initialBalance, riskLevel: p.riskLevel, selectedNumbers: p.selectedNumbers, anchor: api.getAnchor(), conditions, maxBets: panel.getRules().maxBets });
    },
    applyStrategy: (s) => { ui.setMode('auto'); ui.setParams({ betAmount: s.baseBet, riskLevel: s.riskLevel, selectedNumbers: s.selectedNumbers }); api.setAnchor(s.anchor); },
  });
  ui.el.autoPanel.replaceChildren(anchorBox, ...panel.elements);
  ui.el.autoPanel.classList.add('auto-panel');

  let stepDelay = 0;

  function paintAnchors() {
    ui.setAnchors(anchorEnabled.checked ? freqApi.getAnchors() : []);
  }
  anchorEnabled.addEventListener('change', paintAnchors);

  const lockable = () => [...panel.inputs, anchorEnabled, fillMode];
  function setLocked(locked) { for (const el of lockable()) el.disabled = locked; ui.setLocked(locked); }

  async function playRound(bet) {
    const anchor = api.getAnchor();
    const ticket = buildTicket(freqApi.freq, { anchor, manualNumbers: ui.getParams().selectedNumbers, rng: localRng });
    const res = await playKenoRound(ui, { betAmount: bet, numbers: ticket, stepMs: stepDelay });
    if (!res) return null;
    paintAnchors();
    return { isWin: res.isWin, profit: res.profit };
  }

  const loop = createAutoLoop({
    playRound,
    getBalance: () => state.stats.balance,
    onRound: (_res, next) => { ui.el.betInput.value = String(next); },
    onStop: ({ reason }) => {
      setLocked(false);
      ui.el.betBtn.classList.remove('danger');
      ui.setMode('auto');
      toast(STOP_REASON_TEXT[reason] || reason, reason === 'bankrupt' || reason === 'error' ? 'error' : 'ok');
    },
  });

  function preflight() {
    const p = ui.getParams();
    if (!anchorEnabled.checked && p.selectedNumbers.length === 0) { toast('Izaberi brojeve na tabli ili uključi Sidro strategiju', 'error'); return null; }
    if (p.betAmount < 0) { toast('Ulog ne može biti negativan', 'error'); return null; }
    if (p.betAmount > state.stats.balance) { toast('Ulog je veći od balansa', 'error'); return null; }
    return p;
  }

  const api = {
    loop,
    fields: panel,
    strategy: panel,
    getAutoRules: () => panel.getRules(),
    setAutoRules: (r) => panel.setRules(r),
    getConditions: () => panel.getConditions(),
    setConditions: (c) => panel.setConditions(c),
    getAnchor: () => ({ enabled: anchorEnabled.checked, fillMode: fillMode.value }),
    setAnchor(a = {}) {
      anchorEnabled.checked = !!a.enabled;
      if (a.fillMode === 'random' || a.fillMode === 'cold') fillMode.value = a.fillMode;
      paintAnchors();
    },
    isRunning: () => loop.isRunning(),
    // Odigraj tačno 1 keno krug (dugme „▶ Odigraj 1 krug")
    async playOne() {
      if (loop.isRunning()) return null;
      if (!preflight()) return null;
      stepDelay = panel.getSpeed().stepMs;
      const r = await playRound(ui.getParams().betAmount);
      ui.el.betInput.value = String(ui.getParams().betAmount);
      return r;
    },
    start({ delayMs, stepMs } = {}) {
      const p = preflight();
      if (!p) return Promise.resolve(null);
      const err = panel.validate();
      if (err) { toast(err, 'error'); return Promise.resolve(null); }
      const rules = panel.getRules();
      const sp = panel.getSpeed();
      const delay = delayMs != null ? delayMs : sp.delayMs;
      stepDelay = stepMs != null ? stepMs : sp.stepMs;
      setLocked(true);
      ui.el.betBtn.textContent = 'ZAUSTAVI AUTO IGRU';
      ui.el.betBtn.classList.add('danger');
      const baseBet = p.betAmount;
      const manual = p.selectedNumbers;
      return loop.start({ baseBet, rules, conditions: rules.conditions, maxBets: rules.maxBets, stopConditions: rules.stopConditions, delayMs: delay })
        .then((summary) => { ui.setParams({ betAmount: baseBet }); ui.el.betInput.value = String(baseBet); if (!anchorEnabled.checked) ui.setSelected(manual); return summary; });
    },
    stop() { loop.stop(); },
    el: { anchorEnabled, fillMode },
  };
  return api;
}
