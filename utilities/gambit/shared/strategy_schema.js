// Šema strategije (spec §3.5): zajednička polja + specifična po igri; defaults i validacija.
import { chanceFromTarget } from './dice_math.js';
import { validateHybrid } from './hybrid_schema.js';
import { RISKS, FILL_MODES as KENO_FILL_MODES, MAX_PICKS, BOARD } from './keno_paytables.js';
import { normalizeConditions, deriveSimpleRules, validateConditions } from './conditions.js';

export const GAMES = ['dice', 'mines', 'keno'];
const ACTIONS = ['reset', 'increase'];

function rule(r, def = { action: 'reset', value: 0 }) {
  if (!r || typeof r !== 'object') return { ...def };
  return { action: ACTIONS.includes(r.action) ? r.action : def.action, value: Number(r.value) || 0 };
}

function common(game, p = {}) {
  // Napredni uslovi (pop-up „Napredna opklada"): ako postoje, oni su izvor istine za živu Auto petlju,
  // a prosti onLoss/onWin/stopConditions se izvode iz njih za Monte Carlo simulator.
  const conditions = normalizeConditions(p.conditions);
  const derived = conditions.length ? deriveSimpleRules(conditions) : null;
  return {
    game,
    strategyName: String(p.strategyName ?? ''),
    type: p.type === 'multi' ? 'multi' : 'solo',
    createdAt: p.createdAt || new Date().toISOString(),
    baseBet: Number(p.baseBet) || 0,
    startBalance: Math.max(0, Number(p.startBalance) || 0),
    maxBets: Math.max(0, Math.floor(Number(p.maxBets) || 0)),
    conditions,
    onLoss: rule(derived ? derived.onLoss : p.onLoss),
    onWin: rule(derived ? derived.onWin : p.onWin),
    stopConditions: derived ? { ...derived.stopConditions } : {
      takeProfit: Number(p.stopConditions?.takeProfit) || 0,
      stopLoss: Number(p.stopConditions?.stopLoss) || 0,
    },
  };
}

export function diceStrategy(p = {}) {
  const condition = p.condition === 'under' ? 'under' : 'over';
  const targetValue = Number(p.targetValue ?? 50.5);
  return {
    ...common('dice', p),
    targetValue,
    condition,
    winChance: chanceFromTarget(targetValue, condition),
  };
}

const SHIFT_MODES = ['stay', 'now', 'after'];
const SHIFT_ALGOS = ['mirror', 'invert', 'random'];

function shiftRule(r) {
  const mode = r && SHIFT_MODES.includes(r.mode) ? r.mode : 'stay';
  // count važi samo za 'after' i tada je ≥ 1 (isto kao u mines_shift.js); inače 0
  return { mode, count: mode === 'after' ? Math.max(1, Math.floor(Number(r?.count) || 1)) : 0 };
}

export function minesStrategy(p = {}) {
  const fields = Array.isArray(p.selectedFields) ? p.selectedFields.map((x) => Number(x)) : [];
  return {
    ...common('mines', p),
    minesCount: Math.floor(Number(p.minesCount) || 3),
    selectedFields: fields,
    shift: {
      onWin: shiftRule(p.shift?.onWin),
      onLoss: shiftRule(p.shift?.onLoss),
      algo: SHIFT_ALGOS.includes(p.shift?.algo) ? p.shift.algo : 'random',
    },
  };
}

const KENO_RISKS = RISKS; // jedini izvor istine: keno_paytables.js
const FILL_MODES = KENO_FILL_MODES;

export function kenoStrategy(p = {}) {
  const nums = Array.isArray(p.selectedNumbers) ? p.selectedNumbers.map((x) => Number(x)) : [];
  return {
    ...common('keno', p),
    riskLevel: KENO_RISKS.includes(p.riskLevel) ? p.riskLevel : 'classic',
    selectedNumbers: nums,
    anchor: {
      enabled: !!p.anchor?.enabled,
      fillMode: FILL_MODES.includes(p.anchor?.fillMode) ? p.anchor.fillMode : 'random',
    },
  };
}

export function validateStrategy(s) {
  const errors = [];
  if (!s || typeof s !== 'object') return { ok: false, errors: ['strategija nije objekat'] };
  // Multi-Strategy (hibrid): strukturna validacija ovde; postojanje/igra referenciranih strategija proverava resolveHybrid pri pokretanju.
  if (s.type === 'multi') return validateHybrid(s, { gameOf: () => s.game });
  if (!GAMES.includes(s.game)) errors.push(`game mora biti ${GAMES.join('/')}`);
  if (!(Number(s.baseBet) === 0 || Number(s.baseBet) >= 0.001)) errors.push('baseBet mora biti 0 ili ≥ 0.001');
  if (s.startBalance != null && Number(s.startBalance) < 0) errors.push('startBalance mora biti ≥ 0');
  if (s.conditions != null && s.conditions.length) {
    const cv = validateConditions(s.conditions);
    if (!cv.ok) errors.push(...cv.errors);
  }
  for (const k of ['onLoss', 'onWin']) {
    if (!s[k] || !ACTIONS.includes(s[k].action)) errors.push(`${k}.action mora biti reset ili increase`);
    else if (Number(s[k].value) < 0) errors.push(`${k}.value mora biti ≥ 0`);
  }
  if (s.game === 'dice') {
    if (s.condition !== 'over' && s.condition !== 'under') errors.push('condition mora biti over/under');
    const c = chanceFromTarget(s.targetValue, s.condition);
    if (!(c >= 2 && c <= 98)) errors.push('winChance mora biti 2–98');
  }
  if (s.game === 'mines') {
    const M = Number(s.minesCount);
    if (!Number.isInteger(M) || M < 1 || M > 24) errors.push('minesCount mora biti 1–24');
    const f = Array.isArray(s.selectedFields) ? s.selectedFields : null;
    if (!f || f.length < 1) errors.push('selectedFields: bar jedno polje');
    else {
      if (new Set(f).size !== f.length) errors.push('selectedFields: duplikati');
      if (f.some((x) => !Number.isInteger(x) || x < 0 || x > 24)) errors.push('selectedFields: indeksi 0–24');
      if (Number.isInteger(M) && f.length > 25 - M) errors.push(`selectedFields: najviše ${25 - M} polja za ${M} mina`);
    }
    const sh = s.shift || {};
    if (!SHIFT_ALGOS.includes(sh.algo)) errors.push('shift.algo mora biti mirror/invert/random');
    for (const k of ['onWin', 'onLoss']) {
      if (!sh[k] || !SHIFT_MODES.includes(sh[k].mode)) errors.push(`shift.${k}.mode mora biti stay/now/after`);
      else if (sh[k].mode === 'after' && !(Number(sh[k].count) >= 1)) errors.push(`shift.${k}.count mora biti ≥ 1 za 'after'`);
    }
  }
  if (s.game === 'keno') {
    if (!KENO_RISKS.includes(s.riskLevel)) errors.push('riskLevel mora biti classic/low/medium/high');
    const anchorOn = !!s.anchor?.enabled;
    if (s.anchor && !FILL_MODES.includes(s.anchor.fillMode)) errors.push('anchor.fillMode mora biti random/cold');
    const n = Array.isArray(s.selectedNumbers) ? s.selectedNumbers : null;
    if (!n) errors.push('selectedNumbers mora biti niz');
    else {
      if (!anchorOn && n.length < 1) errors.push('selectedNumbers: bar jedan broj (ili uključi sidro)');
      if (n.length > MAX_PICKS) errors.push(`selectedNumbers: najviše ${MAX_PICKS}`);
      if (new Set(n).size !== n.length) errors.push('selectedNumbers: duplikati');
      if (n.some((x) => !Number.isInteger(x) || x < 1 || x > BOARD)) errors.push(`selectedNumbers: brojevi 1–${BOARD}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
