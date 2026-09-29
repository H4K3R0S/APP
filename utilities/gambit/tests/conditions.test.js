// Napredni uslovi strategije (pop-up „Napredna opklada"): model, validacija, evaluacija, izvođenje prostih pravila.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  defaultCondition, normalizeConditions, validateConditions,
  nextBetFromConditions, deriveSimpleRules, describeCondition,
} from '../shared/conditions.js';

const ctx = (o = {}) => ({
  currentBet: 1, baseBet: 1, isWin: false,
  winStreak: 0, lossStreak: 0, wins: 0, losses: 0, betsPlayed: 0, sessionProfit: 0, ...o,
});

test('defaultCondition: bet / every 1 loss → increase 100%', () => {
  assert.deepStrictEqual(defaultCondition(), { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 });
});

test('normalizeConditions: čisti nevalidne vrednosti na dozvoljene', () => {
  const [c] = normalizeConditions([{ kind: 'x', on: 'y', count: -3, outcome: 'z', do: 'q', value: 'abc' }]);
  assert.strictEqual(c.kind, 'bet');
  assert.strictEqual(c.on, 'every');
  assert.strictEqual(c.count, 1);
  assert.strictEqual(c.outcome, 'losses');
  assert.strictEqual(c.do, 'increase');
  assert.strictEqual(c.value, 0);
  assert.deepStrictEqual(normalizeConditions('nije niz'), []);
});

test('validateConditions: prihvata ispravne, odbija loše', () => {
  assert.strictEqual(validateConditions([defaultCondition()]).ok, true);
  assert.strictEqual(validateConditions([{ ...defaultCondition(), do: 'increase', value: -5 }]).ok, false);
  assert.strictEqual(validateConditions([{ ...defaultCondition(), kind: 'profit', on: 'profitAbove', count: 0 }]).ok, false);
});

test('Martingale: increase 100% na svaki gubitak, reset na svaku pobedu', () => {
  const conds = [
    { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 },
    { kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'reset', value: 0 },
  ];
  // gubitak: 1 → 2
  let r = nextBetFromConditions(conds, ctx({ currentBet: 1, isWin: false, lossStreak: 1, losses: 1 }));
  assert.strictEqual(r.bet, 2);
  assert.strictEqual(r.stop, false);
  // opet gubitak: 2 → 4
  r = nextBetFromConditions(conds, ctx({ currentBet: 2, isWin: false, lossStreak: 2, losses: 2 }));
  assert.strictEqual(r.bet, 4);
  // pobeda: 4 → reset na baseBet 1
  r = nextBetFromConditions(conds, ctx({ currentBet: 4, isWin: true, winStreak: 1, wins: 1 }));
  assert.strictEqual(r.bet, 1);
});

test('firstStreak / streakGreater / everyStreak: okidanje po nizu', () => {
  const first = [{ kind: 'bet', on: 'firstStreak', count: 3, outcome: 'losses', do: 'set', value: 10 }];
  assert.strictEqual(nextBetFromConditions(first, ctx({ isWin: false, lossStreak: 2 })).bet, 1, 'niz 2 ne okida');
  assert.strictEqual(nextBetFromConditions(first, ctx({ isWin: false, lossStreak: 3 })).bet, 10, 'niz 3 okida');
  assert.strictEqual(nextBetFromConditions(first, ctx({ isWin: false, lossStreak: 4 })).bet, 1, 'niz 4 ne okida (samo prvi put)');
  const gt = [{ kind: 'bet', on: 'streakGreater', count: 3, outcome: 'losses', do: 'set', value: 10 }];
  assert.strictEqual(nextBetFromConditions(gt, ctx({ isWin: false, lossStreak: 4 })).bet, 10);
  assert.strictEqual(nextBetFromConditions(gt, ctx({ isWin: false, lossStreak: 3 })).bet, 1);
});

test('do:stop i profit uslov zaustavljaju petlju', () => {
  const stopLoss = [{ kind: 'profit', on: 'profitBelow', count: 50, do: 'stop', value: 0 }];
  assert.strictEqual(nextBetFromConditions(stopLoss, ctx({ sessionProfit: -50 })).stop, true);
  assert.strictEqual(nextBetFromConditions(stopLoss, ctx({ sessionProfit: -10 })).stop, false);
  const stopWin = [{ kind: 'profit', on: 'profitAbove', count: 100, do: 'stop', value: 0 }];
  assert.strictEqual(nextBetFromConditions(stopWin, ctx({ sessionProfit: 120 })).stop, true);
});

test('add / subtract / decrease / set: pozitivno ne pada ispod MIN_BET, ali dozvoljen je tačan 0', () => {
  assert.strictEqual(nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'add', value: 0.5 }], ctx({ isWin: false, losses: 1, currentBet: 1 })).bet, 1.5);
  // subtract ispod nule → tačno 0 (bez opklade), ne MIN_BET
  assert.strictEqual(nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'subtract', value: 100 }], ctx({ isWin: false, losses: 1, currentBet: 1 })).bet, 0, 'ispod nule → 0');
  // decrease koji bi dao „prašinu" (0 < x < MIN_BET) → floor na MIN_BET
  assert.strictEqual(nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'decrease', value: 99.99 }], ctx({ isWin: false, losses: 1, currentBet: 0.001 })).bet, 0.001, 'pozitivno nikad ispod MIN_BET');
});

test('Dice akcije: setChance / resetChance / switchDir menjaju šansu i smer (samo kad ctx nosi dice stanje)', () => {
  const dctx = (o = {}) => ctx({ chance: 49.5, condition: 'over', baseChance: 49.5, ...o });
  let r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'setChance', value: 25 }], dctx({ isWin: false, losses: 1 }));
  assert.strictEqual(r.chance, 25);
  assert.strictEqual(r.condition, 'over');
  r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'resetChance', value: 0 }], dctx({ isWin: true, wins: 1, chance: 25 }));
  assert.strictEqual(r.chance, 49.5);
  r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'bets', do: 'switchDir', value: 0 }], dctx({ betsPlayed: 1 }));
  assert.strictEqual(r.condition, 'under');
  r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'switchDir', value: 0 }], dctx({ isWin: false, losses: 1, condition: 'under' }));
  assert.strictEqual(r.condition, 'over');
});

test('Dice akcije: increaseChance / decreaseChance menjaju šansu za procentne poene (klamp 2–98)', () => {
  const dctx = (o = {}) => ctx({ chance: 49.5, condition: 'over', baseChance: 49.5, ...o });
  // svaki 10. gubitak → +3 poena: 49.5 → 52.5
  let r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 10, outcome: 'losses', do: 'increaseChance', value: 3 }], dctx({ isWin: false, losses: 10 }));
  assert.strictEqual(r.chance, 52.5);
  // ne okida se pre 10. gubitka
  r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 10, outcome: 'losses', do: 'increaseChance', value: 3 }], dctx({ isWin: false, losses: 5 }));
  assert.strictEqual(r.chance, 49.5);
  // decreaseChance klampuje na MIN_CHANCE (2)
  r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'decreaseChance', value: 100 }], dctx({ isWin: false, losses: 1, chance: 10 }));
  assert.strictEqual(r.chance, 2);
  // increaseChance klampuje na MAX_CHANCE (98)
  r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'increaseChance', value: 100 }], dctx({ isWin: true, wins: 1, chance: 90 }));
  assert.strictEqual(r.chance, 98);
});

test('Dice akcije: mines/keno kontekst (bez chance/condition) ostaje netaknut', () => {
  const r = nextBetFromConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'setChance', value: 25 }], ctx({ isWin: false, losses: 1 }));
  assert.strictEqual(r.chance, undefined);
  assert.strictEqual(r.condition, undefined);
});

test('validateConditions: setChance van opsega 2–98 se odbija', () => {
  assert.strictEqual(validateConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'setChance', value: 50 }]).ok, true);
  assert.strictEqual(validateConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'setChance', value: 1 }]).ok, false);
  assert.strictEqual(validateConditions([{ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'setChance', value: 99 }]).ok, false);
});

test('deriveSimpleRules: izvodi onLoss/onWin/stop za simulator', () => {
  const conds = [
    { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 150 },
    { kind: 'bet', on: 'every', count: 1, outcome: 'wins', do: 'reset', value: 0 },
    { kind: 'profit', on: 'profitBelow', count: 40, do: 'stop', value: 0 },
    { kind: 'profit', on: 'profitAbove', count: 90, do: 'stop', value: 0 },
  ];
  const r = deriveSimpleRules(conds);
  assert.deepStrictEqual(r.onLoss, { action: 'increase', value: 150 });
  assert.deepStrictEqual(r.onWin, { action: 'reset', value: 0 });
  assert.strictEqual(r.stopConditions.stopLoss, 40);
  assert.strictEqual(r.stopConditions.takeProfit, 90);
});

test('describeCondition: čitljiv opis (za čipove i Hub)', () => {
  assert.match(describeCondition({ kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'increase', value: 100 }), /gubitak.*povećaj.*100/i);
  assert.match(describeCondition({ kind: 'profit', on: 'profitBelow', count: 50, do: 'stop', value: 0 }), /profit.*-50|gubitak.*50/i);
});
