// Napredni uslovi strategije (Stake-stil „Advanced Bet"): lista uslova koji posle svakog kruga menjaju ulog ili zaustavljaju petlju.
// Model uslova: { kind, on, count, outcome, do, value }
//   kind:    'bet' (po ishodu opklada) | 'profit' (po kumulativnom profitu sesije)
//   on(bet): 'every' | 'everyStreak' | 'firstStreak' | 'streakGreater' | 'streakLower'
//   on(profit): 'profitAbove' | 'profitBelow'  (count = prag u $)
//   count:   broj (N krugova/niz ili prag profita)
//   outcome: 'wins' | 'losses' | 'bets'  (samo za kind 'bet')
//   do (ulog):  'increase' | 'decrease' | 'add' | 'subtract' | 'set' | 'reset' | 'stop'
//   do (Dice):  'setChance' (value = šansa %) | 'increaseChance'/'decreaseChance' (value = ± procentnih poena) | 'resetChance' (na baznu šansu) | 'switchDir' (Over⇄Under)
//   value:   % (increase/decrease uloga) ili apsolutni iznos (add/subtract/set) ili šansa % (setChance) ili procentni poeni šanse (increase/decreaseChance); ignoriše se za reset/stop/resetChance/switchDir
// Dice akcije menjaju šansu/smer i deluju SAMO u živoj Auto petlji (loop.js prosleđuje ctx.chance/ctx.condition/ctx.baseChance);
// Monte Carlo simulator ih ignoriše (radi sa fiksnom winChance iz targetValue) — v. deriveSimpleRules.
import { MIN_BET, clampChance, MIN_CHANCE, MAX_CHANCE } from './dice_math.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

export const BET_ON = ['every', 'everyStreak', 'firstStreak', 'streakGreater', 'streakLower'];
export const PROFIT_ON = ['profitAbove', 'profitBelow'];
export const OUTCOMES = ['wins', 'losses', 'bets'];
export const BET_DO_ACTIONS = ['increase', 'decrease', 'add', 'subtract', 'set', 'reset', 'stop'];
export const DICE_DO_ACTIONS = ['setChance', 'increaseChance', 'decreaseChance', 'resetChance', 'switchDir'];
export const DO_ACTIONS = [...BET_DO_ACTIONS, ...DICE_DO_ACTIONS];
// Akcije bez „value" polja (u editoru se sakriva unos).
export const NO_VALUE_ACTIONS = ['reset', 'stop', 'resetChance', 'switchDir'];

export function defaultCondition() {
  return { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 };
}

function normalizeOne(c = {}) {
  const kind = c.kind === 'profit' ? 'profit' : 'bet';
  const doAct = DO_ACTIONS.includes(c.do) ? c.do : 'increase';
  const value = Math.max(0, Number(c.value) || 0);
  if (kind === 'profit') {
    return {
      kind, on: PROFIT_ON.includes(c.on) ? c.on : 'profitBelow',
      count: Math.max(0, Number(c.count) || 0), outcome: 'bets', do: doAct, value,
    };
  }
  return {
    kind, on: BET_ON.includes(c.on) ? c.on : 'every',
    count: Math.max(1, Math.floor(Number(c.count) || 1)),
    outcome: OUTCOMES.includes(c.outcome) ? c.outcome : 'losses', do: doAct, value,
  };
}

export function normalizeConditions(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeOne);
}

export function validateConditions(list) {
  const errors = [];
  if (!Array.isArray(list)) return { ok: false, errors: ['conditions mora biti niz'] };
  list.forEach((c, i) => {
    const n = i + 1;
    if (c.kind !== 'bet' && c.kind !== 'profit') errors.push(`uslov ${n}: kind mora biti bet/profit`);
    if (!DO_ACTIONS.includes(c.do)) errors.push(`uslov ${n}: nepoznata akcija`);
    if (Number(c.value) < 0) errors.push(`uslov ${n}: value mora biti ≥ 0`);
    if (c.do === 'setChance' && !(Number(c.value) >= MIN_CHANCE && Number(c.value) <= MAX_CHANCE)) errors.push(`uslov ${n}: šansa mora biti ${MIN_CHANCE}–${MAX_CHANCE}`);
    if (c.kind === 'profit') {
      if (!PROFIT_ON.includes(c.on)) errors.push(`uslov ${n}: on mora biti profitAbove/profitBelow`);
      if (!(Number(c.count) > 0)) errors.push(`uslov ${n}: prag profita mora biti > 0`);
    } else {
      if (!BET_ON.includes(c.on)) errors.push(`uslov ${n}: nepoznat okidač`);
      if (!OUTCOMES.includes(c.outcome)) errors.push(`uslov ${n}: outcome mora biti wins/losses/bets`);
      if (!(Number(c.count) >= 1)) errors.push(`uslov ${n}: count mora biti ≥ 1`);
    }
  });
  return { ok: errors.length === 0, errors };
}

// Da li uslov okida u ovom krugu (ctx nosi rezultat upravo odigranog kruga).
function fires(c, ctx) {
  if (c.kind === 'profit') {
    if (c.on === 'profitAbove') return ctx.sessionProfit >= c.count;
    if (c.on === 'profitBelow') return ctx.sessionProfit <= -c.count;
    return false;
  }
  const n = Math.max(1, c.count);
  if (c.outcome === 'bets') {
    if (c.on === 'every') return ctx.betsPlayed > 0 && ctx.betsPlayed % n === 0;
    // streak varijante nemaju smisla za 'bets' → tretiraj kao ukupan broj krugova
    return ctx.betsPlayed >= n;
  }
  const relevant = c.outcome === 'wins' ? ctx.isWin : !ctx.isWin;
  if (!relevant) return false;
  const streak = c.outcome === 'wins' ? ctx.winStreak : ctx.lossStreak;
  const total = c.outcome === 'wins' ? ctx.wins : ctx.losses;
  switch (c.on) {
    case 'every': return total > 0 && total % n === 0;
    case 'everyStreak': return streak > 0 && streak % n === 0;
    case 'firstStreak': return streak === n;
    case 'streakGreater': return streak > n;
    case 'streakLower': return streak > 0 && streak < n;
    default: return false;
  }
}

function applyDo(c, bet, baseBet) {
  const v = Number(c.value) || 0;
  switch (c.do) {
    case 'increase': return bet * (1 + v / 100);
    case 'decrease': return bet * (1 - v / 100);
    case 'add': return bet + v;
    case 'subtract': return bet - v;
    case 'set': return v;
    case 'reset': return baseBet;
    default: return bet; // stop se obrađuje posebno
  }
}

// Primeni sve uslove koji okidaju (redom); vrati sledeći ulog i da li treba stati.
// Za Dice: ctx nosi i chance/condition/baseChance → vraća se izmenjena šansa/smer (za mines/keno su undefined i ostaju netaknuti).
export function nextBetFromConditions(conditions, ctx) {
  let bet = Number(ctx.currentBet);
  let chance = ctx.chance;
  let condition = ctx.condition;
  let stop = false;
  let matched = false;
  for (const c of conditions || []) {
    if (!fires(c, ctx)) continue;
    matched = true;
    switch (c.do) {
      case 'stop': stop = true; break;
      case 'setChance': if (chance !== undefined) chance = clampChance(c.value); break;
      case 'increaseChance': if (chance !== undefined) chance = clampChance(chance + (Number(c.value) || 0)); break;
      case 'decreaseChance': if (chance !== undefined) chance = clampChance(chance - (Number(c.value) || 0)); break;
      case 'resetChance': if (chance !== undefined) chance = clampChance(ctx.baseChance); break;
      case 'switchDir': if (condition !== undefined) condition = condition === 'over' ? 'under' : 'over'; break;
      default: bet = applyDo(c, bet, ctx.baseBet);
    }
  }
  bet = r8(bet);
  bet = bet <= 0 ? 0 : Math.max(MIN_BET, bet); // dozvoljen tačan 0 (bez opklade); inače nikad ispod MIN_BET
  return { bet, stop, matched, chance, condition };
}

// Best-effort izvođenje prostog modela (onLoss/onWin/stopConditions) za Monte Carlo simulator/hibrid.
// Puni model uslova živi u živoj Auto petlji; simulacija koristi ovaj sažetak (napomena u README/spec).
export function deriveSimpleRules(conditions) {
  let onLoss = { action: 'reset', value: 0 };
  let onWin = { action: 'reset', value: 0 };
  let takeProfit = 0;
  let stopLoss = 0;
  for (const c of conditions || []) {
    if (c.kind === 'profit') {
      if (c.do === 'stop' && c.on === 'profitAbove') takeProfit = Number(c.count) || 0;
      if (c.do === 'stop' && c.on === 'profitBelow') stopLoss = Number(c.count) || 0;
      continue;
    }
    const action = c.do === 'increase' ? { action: 'increase', value: Number(c.value) || 0 }
      : c.do === 'reset' ? { action: 'reset', value: 0 } : null;
    if (!action) continue;
    if (c.outcome === 'wins') onWin = action;
    else if (c.outcome === 'losses') onLoss = action;
  }
  return { onLoss, onWin, stopConditions: { takeProfit, stopLoss } };
}

const ON_LABEL = {
  every: 'svaki', everyStreak: 'svaki niz od', firstStreak: 'prvi niz od', streakGreater: 'niz veći od', streakLower: 'niz manji od',
};
const OUTCOME_LABEL = { wins: 'dobitak', losses: 'gubitak', bets: 'krug' };
const DO_LABEL = {
  increase: 'povećaj ulog za', decrease: 'smanji ulog za', add: 'dodaj ulogu', subtract: 'oduzmi od uloga',
  set: 'postavi ulog na', reset: 'resetuj ulog', stop: 'zaustavi auto',
  setChance: 'postavi šansu na', increaseChance: 'povećaj šansu za', decreaseChance: 'smanji šansu za',
  resetChance: 'resetuj šansu', switchDir: 'promeni Over/Under',
};

export function describeCondition(c) {
  const pct = ['increase', 'decrease', 'setChance', 'increaseChance', 'decreaseChance'].includes(c.do);
  const doV = NO_VALUE_ACTIONS.includes(c.do) ? '' : ` ${c.value}${pct ? '%' : '$'}`;
  if (c.kind === 'profit') {
    const cond = c.on === 'profitAbove' ? `AKO profit ≥ ${c.count}$` : `AKO profit ≤ -${c.count}$`;
    return `${cond} ➔ ${DO_LABEL[c.do]}${doV}`;
  }
  const on = c.on === 'every' ? `na svaki ${OUTCOME_LABEL[c.outcome]}` : `${ON_LABEL[c.on]} ${c.count} ${OUTCOME_LABEL[c.outcome]}`;
  return `${on} ➔ ${DO_LABEL[c.do]}${doV}`;
}
