// Agregacija izveštaja i AI preporuka balansa.
import { test } from 'node:test';
import assert from 'node:assert';
import { aggregate, recommendedBalance } from '../main/simulator/analysis.js';

test('recommendedBalance: increase 100%, L=3 → 1+2+4+8 = 15; reset → L+1 = 4; baseBet skalira', () => {
  assert.strictEqual(recommendedBalance(3, { action: 'increase', value: 100 }), 15);
  assert.strictEqual(recommendedBalance(3, { action: 'reset', value: 0 }), 4);
  assert.strictEqual(recommendedBalance(3, { action: 'increase', value: 100 }, 0.001), 0.015);
  assert.strictEqual(recommendedBalance(0, { action: 'increase', value: 100 }), 1);
});

test('aggregate: procenti po budžetu, ukupno, tier3Avg, reprezentativna sesija', () => {
  const results = [
    { budget: 10, outcome: 'bankrupt', rounds: 50, maxMultiple: 1.6, maxLossStreak: 5, tiers: [true, false, false, false, false], finalBalance: 0 },
    { budget: 10, outcome: 'bankrupt', rounds: 150, maxMultiple: 2.1, maxLossStreak: 7, tiers: [true, true, false, false, false], finalBalance: 0 },
    { budget: 100, outcome: 'target', rounds: 900, maxMultiple: 1000, maxLossStreak: 9, tiers: [true, true, true, true, true], finalBalance: 100000, series: [{ x: 0, y: 0 }, { x: 900, y: 99900 }], handovers: [] },
    { budget: 100, outcome: 'cap', rounds: 1000, maxMultiple: 6, maxLossStreak: 4, tiers: [true, true, true, false, false], finalBalance: 300 },
  ];
  const strategy = { strategyName: 'T', game: 'dice', baseBet: 1, onLoss: { action: 'increase', value: 100 } };
  const rep = aggregate({ game: 'dice', strategy, results, budgets: [10, 100], benchmark: { durationMs: 1000, threads: 2 } });
  assert.strictEqual(rep.game, 'dice');
  assert.strictEqual(rep.strategyName, 'T');
  assert.strictEqual(rep.budgets.length, 2);
  const b10 = rep.budgets[0];
  assert.strictEqual(b10.budget, 10);
  assert.strictEqual(b10.sessions, 2);
  assert.deepStrictEqual(b10.tierPct, [100, 50, 0, 0, 0]);
  assert.strictEqual(b10.bankruptPct, 100);
  assert.strictEqual(b10.avgRounds, 100);
  assert.strictEqual(b10.maxLossStreak, 7);
  const b100 = rep.budgets[1];
  assert.deepStrictEqual(b100.tierPct, [100, 100, 100, 50, 50]);
  assert.strictEqual(b100.bankruptPct, 0);
  assert.strictEqual(rep.overall.maxLossStreak, 9);
  assert.strictEqual(rep.overall.tier3Avg, 50);
  assert.strictEqual(rep.overall.tier5Avg, 25);
  assert.strictEqual(rep.overall.bankruptAvg, 50);
  assert.strictEqual(rep.overall.recommendedBalance, recommendedBalance(9, strategy.onLoss, 1));
  assert.strictEqual(rep.totalRounds, 2100);
  assert.strictEqual(rep.benchmark.roundsPerSec, 2100);
  assert.strictEqual(rep.representativeSession.budget, 100);
  assert.strictEqual(rep.representativeSession.series.length, 2);
  assert.match(rep.finishedAt, /^\d{4}-/);
});
