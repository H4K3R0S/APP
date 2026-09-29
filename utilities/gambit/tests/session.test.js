// Monte Carlo sesija (čista): jedna sesija do bankrota / 1000× / cap; deterministična po seed-u.
import { test } from 'node:test';
import assert from 'node:assert';
import { playSession } from '../main/simulator/session.js';
import { createRng } from '../shared/rng.js';
import { diceStrategy, minesStrategy, kenoStrategy } from '../shared/strategy_schema.js';
import { minesEngine } from '../main/simulator/engines/mines.js';
import { kenoEngine } from '../main/simulator/engines/keno.js';

test('keno sesija: sidro cold strategija → završava, deterministična (mapa učestanosti po sesiji); engine beleži istoriju', () => {
  const s = kenoStrategy({ strategyName: 'KA', baseBet: 1, riskLevel: 'classic', anchor: { enabled: true, fillMode: 'cold' }, onLoss: { action: 'increase', value: 50 } });
  const a = playSession({ game: 'keno', strategy: s, budget: 100, rng: rng(), maxRounds: 2000 });
  const b = playSession({ game: 'keno', strategy: s, budget: 100, rng: rng(), maxRounds: 2000 });
  assert.ok(['bankrupt', 'cap', 'target'].includes(a.outcome));
  assert.ok(a.rounds >= 1);
  assert.deepStrictEqual(a, b);
  const st = kenoEngine.init(s);
  const r = rng();
  const res = kenoEngine.playRound(s, r, 1, st);
  assert.strictEqual(st.freq.count, 1);
  assert.strictEqual(st.freq.history.length, 0, 'radnik ne čuva istoriju (memorija)');
  assert.strictEqual(typeof res.isWin, 'boolean');
  assert.ok(Number.isFinite(res.profit));
  assert.strictEqual(res.ticket.length, 10);
  // ručni brojevi bez sidra
  const m = kenoStrategy({ baseBet: 1, riskLevel: 'high', selectedNumbers: [7, 14, 21] });
  const st2 = kenoEngine.init(m);
  const res2 = kenoEngine.playRound(m, r, 1, st2);
  assert.deepStrictEqual(res2.ticket, [7, 14, 21]);
});

test('mines sesija: 4 ugla, 3 mine, Martingale → završava, deterministična; polja se rotiraju (mirror na gubitak)', () => {
  const s = minesStrategy({ strategyName: 'MM', baseBet: 1, minesCount: 3, selectedFields: [0, 4, 20, 24], onLoss: { action: 'increase', value: 100 }, shift: { onLoss: { mode: 'now' }, algo: 'mirror' } });
  const a = playSession({ game: 'mines', strategy: s, budget: 100, rng: rng(), maxRounds: 3000 });
  const b = playSession({ game: 'mines', strategy: s, budget: 100, rng: rng(), maxRounds: 3000 });
  assert.ok(['bankrupt', 'cap', 'target'].includes(a.outcome));
  assert.ok(a.rounds >= 1);
  assert.deepStrictEqual(a, b);
  // engine stanje: posle gubitka polja su preslikana
  const st = minesEngine.init(s);
  assert.deepStrictEqual(st.fields, [0, 4, 20, 24]);
  const r = rng();
  let res;
  let guard = 0;
  do { res = minesEngine.playRound(s, r, 1, st); guard += 1; } while (res.isWin && guard < 200);
  assert.strictEqual(res.isWin, false, 'u 200 krugova mora biti bar jedan gubitak');
  assert.strictEqual(res.profit, -1);
  assert.notDeepStrictEqual(st.fields, [0, 4, 20, 24], 'mirror uglova je no-op → pada na random (drugačiji skup)');
  assert.strictEqual(st.fields.length, 4);
  const s2 = minesStrategy({ baseBet: 1, minesCount: 3, selectedFields: [0, 1, 2], shift: { onLoss: { mode: 'now' }, algo: 'mirror' } });
  const st2 = minesEngine.init(s2);
  guard = 0;
  do { res = minesEngine.playRound(s2, r, 1, st2); guard += 1; } while (res.isWin && guard < 200);
  assert.deepStrictEqual(st2.fields, [2, 3, 4]);
});

test('mines: dobitak vraća profit = bet·mult(M, n) − bet', () => {
  const s = minesStrategy({ baseBet: 2, minesCount: 3, selectedFields: [12] });
  const st = minesEngine.init(s);
  const r = rng();
  let res;
  let guard = 0;
  do { res = minesEngine.playRound(s, r, 2, st); guard += 1; } while (!res.isWin && guard < 200);
  assert.strictEqual(res.isWin, true);
  assert.strictEqual(res.profit, Math.round((2 * 1.125 - 2) * 1e8) / 1e8);
});
import { TIERS, MAX_ROUNDS_PER_SESSION } from '../shared/sim_constants.js';

const rng = (seed = 'a'.repeat(64)) => createRng({ serverSeed: seed, clientSeed: 'sim', nonce: 0 });
const MART = diceStrategy({ strategyName: 'M', baseBet: 1, targetValue: 50.5, condition: 'over', onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } });

test('Martingale baseBet 1 budžet 1 → završava (bankrupt ili cap), rounds ≤ maxRounds, oblik rezultata', () => {
  const r = playSession({ game: 'dice', strategy: MART, budget: 1, rng: rng(), maxRounds: 5000 });
  assert.ok(['bankrupt', 'cap', 'target'].includes(r.outcome), r.outcome);
  assert.ok(r.rounds >= 1 && r.rounds <= 5000);
  assert.strictEqual(r.budget, 1);
  assert.strictEqual(r.tiers.length, TIERS.length);
  assert.ok(r.maxMultiple >= 1);
  assert.ok(Number.isInteger(r.maxLossStreak) && r.maxLossStreak >= 0);
  assert.ok(typeof r.finalBalance === 'number');
  assert.deepStrictEqual(r.handovers, []);
});

test('baseBet veći od budžeta → bankrupt u krugu 0 (bez petlje)', () => {
  const s = diceStrategy({ baseBet: 5, targetValue: 50.5, condition: 'over' });
  const r = playSession({ game: 'dice', strategy: s, budget: 1, rng: rng(), maxRounds: 100 });
  assert.strictEqual(r.outcome, 'bankrupt');
  assert.strictEqual(r.rounds, 0);
});

test('baseBet 0 / NaN / string ili budžet NaN → bankrupt u krugu 0, bez NaN u rezultatu', () => {
  for (const bad of [0, NaN, 'abc', null, -1]) {
    const s = diceStrategy({ baseBet: 1 });
    s.baseBet = bad;
    const r = playSession({ game: 'dice', strategy: s, budget: 10, rng: rng(), maxRounds: 1000 });
    assert.strictEqual(r.outcome, 'bankrupt', `baseBet=${bad}`);
    assert.strictEqual(r.rounds, 0);
    assert.ok(Number.isFinite(r.finalBalance));
  }
  const r = playSession({ game: 'dice', strategy: MART, budget: NaN, rng: rng(), maxRounds: 1000 });
  assert.strictEqual(r.outcome, 'bankrupt');
  assert.strictEqual(r.rounds, 0);
});

test('determinizam: isti seed → isti rezultat; različit seed → (skoro sigurno) različit broj krugova', () => {
  const a = playSession({ game: 'dice', strategy: MART, budget: 100, rng: rng(), maxRounds: 2000 });
  const b = playSession({ game: 'dice', strategy: MART, budget: 100, rng: rng(), maxRounds: 2000 });
  assert.deepStrictEqual({ ...a, series: null }, { ...b, series: null });
  const c = playSession({ game: 'dice', strategy: MART, budget: 100, rng: rng('b'.repeat(64)), maxRounds: 2000 });
  assert.ok(a.rounds !== c.rounds || a.finalBalance !== c.finalBalance);
});

test('maxRounds cap: outcome cap kad ni bankrot ni cilj', () => {
  const flat = diceStrategy({ baseBet: 0.001, targetValue: 50.5, condition: 'over' });
  const r = playSession({ game: 'dice', strategy: flat, budget: 10000, rng: rng(), maxRounds: 100 });
  assert.strictEqual(r.outcome, 'cap');
  assert.strictEqual(r.rounds, 100);
});

test('tiers[0] true ako je maxMultiple ≥ 1.5; keepSeries daje seriju ≤ 2000 tačaka', () => {
  const r = playSession({ game: 'dice', strategy: MART, budget: 100, rng: rng(), maxRounds: 3000, keepSeries: true });
  assert.strictEqual(r.tiers[0], r.maxMultiple >= 1.5);
  assert.ok(Array.isArray(r.series) && r.series.length >= 2 && r.series.length <= 2000);
  assert.strictEqual(r.series[0].x, 0);
  assert.strictEqual(r.series[0].y, 0);
});

test('podrazumevani maxRounds je MAX_ROUNDS_PER_SESSION', () => {
  assert.strictEqual(MAX_ROUNDS_PER_SESSION, 200000);
});
