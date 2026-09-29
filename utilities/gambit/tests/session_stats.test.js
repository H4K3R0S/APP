// Statistika sesije (čista): balans, brojači, nizovi promašaja, istorija (10), milestone-i 50/100/200/500 %.
import { test } from 'node:test';
import assert from 'node:assert';
import { createStats, applyResult, winRate, profitPct, milestonesHit, resetStats } from '../shared/session_stats.js';

const L = { isWin: false, betAmount: 1, profit: -1 };
const W = { isWin: true, betAmount: 1, profit: 1 };

test('createStats: početni balans 1000, sve nula', () => {
  const s = createStats();
  assert.strictEqual(s.balance, 1000);
  assert.strictEqual(s.initialBalance, 1000);
  assert.deepStrictEqual([s.bets, s.wins, s.losses, s.lossStreak, s.maxLossStreak, s.cumulativeProfit], [0, 0, 0, 0, 0, 0]);
  assert.deepStrictEqual(s.history, []);
});

test('applyResult L,L,W: streak 0, max streak 2, bets 3, balans 999', () => {
  let s = createStats();
  s = applyResult(s, L); s = applyResult(s, L); s = applyResult(s, W);
  assert.strictEqual(s.bets, 3);
  assert.strictEqual(s.wins, 1);
  assert.strictEqual(s.losses, 2);
  assert.strictEqual(s.lossStreak, 0);
  assert.strictEqual(s.maxLossStreak, 2);
  assert.strictEqual(s.balance, 999);
  assert.strictEqual(s.cumulativeProfit, -1);
  assert.deepStrictEqual(s.history, ['L', 'L', 'W']);
  assert.strictEqual(winRate(s), 33.33);
  assert.strictEqual(profitPct(s), -0.1);
});

test('maxWin: prati najveći pojedinačni dobitak u sesiji (porazi ga ne menjaju)', () => {
  let s = createStats(1000);
  assert.strictEqual(s.maxWin, 0);
  s = applyResult(s, { isWin: true, betAmount: 10, profit: 20 });
  assert.strictEqual(s.maxWin, 20);
  s = applyResult(s, { isWin: false, betAmount: 10, profit: -10 });
  assert.strictEqual(s.maxWin, 20, 'poraz ne smanjuje maxWin');
  s = applyResult(s, { isWin: true, betAmount: 10, profit: 55.5 });
  assert.strictEqual(s.maxWin, 55.5);
  s = applyResult(s, { isWin: true, betAmount: 10, profit: 5 });
  assert.strictEqual(s.maxWin, 55.5, 'manji dobitak ne smanjuje maxWin');
});

test('applyResult ne menja ulazni objekat (imutabilno)', () => {
  const s0 = createStats();
  applyResult(s0, L);
  assert.strictEqual(s0.bets, 0);
});

test('history čuva samo zadnjih 10', () => {
  let s = createStats();
  for (let i = 0; i < 12; i++) s = applyResult(s, i % 2 ? W : L);
  assert.strictEqual(s.history.length, 10);
});

test('milestonesHit: 50% pređen u tačnom krugu, trajno; 100% nije', () => {
  let s = createStats(1000);
  s = applyResult(s, { isWin: true, betAmount: 100, profit: 300 }); // +30%
  assert.deepStrictEqual(milestonesHit(s), { 50: null, 100: null, 200: null, 500: null });
  s = applyResult(s, { isWin: true, betAmount: 100, profit: 300 }); // +60% u krugu 2
  assert.strictEqual(milestonesHit(s)[50], 2);
  s = applyResult(s, { isWin: false, betAmount: 500, profit: -500 }); // pad na +10%
  assert.strictEqual(milestonesHit(s)[50], 2, 'ostaje trajno');
  assert.strictEqual(milestonesHit(s)[100], null);
});

test('resetStats: trenutni balans postaje novi početni, brojači na nulu', () => {
  let s = createStats(1000);
  s = applyResult(s, { isWin: true, betAmount: 10, profit: 50 });
  const r = resetStats(s);
  assert.strictEqual(r.initialBalance, 1050);
  assert.strictEqual(r.balance, 1050);
  assert.strictEqual(r.bets, 0);
  assert.deepStrictEqual(milestonesHit(r), { 50: null, 100: null, 200: null, 500: null });
});
