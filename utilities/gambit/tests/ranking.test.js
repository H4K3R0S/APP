// Rangiranje strategija (korak 27): sažetak analize, prag 70% Tier 3, grupe preporučene/ostale/netestirane.
import { test } from 'node:test';
import assert from 'node:assert';
import { summarizeAnalysis, rankStrategies, scoreOf, RECOMMEND_THRESHOLD } from '../shared/ranking.js';

const entry = (name, tier3Avg, extra = {}) => ({ name, game: 'dice', type: 'solo', hasAnalysis: tier3Avg != null, summary: tier3Avg == null ? null : { tier3Avg, tier5Avg: 0, maxLossStreak: 9, recommendedBalance: 511, bankruptAvg: 50, finishedAt: '2026-09-27' }, ...extra });

test('summarizeAnalysis: iz izveštaja izvlači ključne brojke; bez overall → null', () => {
  const s = summarizeAnalysis({ overall: { tier3Avg: 84.2, tier5Avg: 1.5, maxLossStreak: 12, recommendedBalance: 4095, bankruptAvg: 15.8 }, finishedAt: 'x', totalRounds: 5 });
  assert.deepStrictEqual(s, { tier3Avg: 84.2, tier5Avg: 1.5, maxLossStreak: 12, recommendedBalance: 4095, bankruptAvg: 15.8, finishedAt: 'x', totalRounds: 5 });
  assert.strictEqual(summarizeAnalysis({}), null);
  assert.strictEqual(summarizeAnalysis(null), null);
  assert.strictEqual(summarizeAnalysis({ overall: { tier3Avg: 'abc' } }), null);
});

test('rankStrategies: >70 preporučene (opadajuće), ostale opadajuće, netestirane na dnu po imenu; prag tačno 70 nije preporučeno', () => {
  const r = rankStrategies([entry('b_net', null), entry('A42', 42), entry('C88', 88), entry('D70', 70), entry('E95', 95), entry('a_net', null)]);
  assert.deepStrictEqual(r.preporucene.map((e) => e.name), ['E95', 'C88']);
  assert.deepStrictEqual(r.ostale.map((e) => e.name), ['D70', 'A42']);
  assert.deepStrictEqual(r.netestirane.map((e) => e.name), ['a_net', 'b_net']);
  assert.deepStrictEqual(r.ordered.map((e) => e.name), ['E95', 'C88', 'D70', 'A42', 'a_net', 'b_net']);
  assert.strictEqual(RECOMMEND_THRESHOLD, 70);
  assert.strictEqual(scoreOf(entry('x', null)), 0);
  assert.strictEqual(scoreOf(entry('x', 12.5)), 12.5);
});
