// Normalizacija ulaza simulatora (IPC): ograničenja, filtriranje budžeta, validacija strategije.
import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeSimOptions, MAX_SESSIONS_PER_BUDGET } from '../main/simulator/options.js';
import { diceStrategy } from '../shared/strategy_schema.js';
import { BUDGETS, SESSIONS_PER_BUDGET, MAX_ROUNDS_PER_SESSION } from '../shared/sim_constants.js';

const OK = diceStrategy({ strategyName: 'S', baseBet: 1 });

test('defaults kad ništa nije zadato', () => {
  const n = normalizeSimOptions({ game: 'dice', strategy: OK }, { maxThreads: 14 });
  assert.strictEqual(n.ok, true);
  assert.deepStrictEqual(n.budgets, BUDGETS);
  assert.strictEqual(n.sessionsPerBudget, SESSIONS_PER_BUDGET);
  assert.strictEqual(n.maxRoundsPerSession, MAX_ROUNDS_PER_SESSION);
  assert.strictEqual(n.threads, 14);
});

test('sessionsPerBudget se ograničava, budžeti se filtriraju/dedupliraju/sortiraju, niti u [1,max]', () => {
  const n = normalizeSimOptions({ game: 'dice', strategy: OK, sessionsPerBudget: 1e8, budgets: ['x', 100, 10, 100, -5, 0], threads: 99, maxRoundsPerSession: -1 }, { maxThreads: 14 });
  assert.strictEqual(n.ok, true);
  assert.strictEqual(n.sessionsPerBudget, MAX_SESSIONS_PER_BUDGET);
  assert.deepStrictEqual(n.budgets, [10, 100]);
  assert.strictEqual(n.threads, 14);
  assert.strictEqual(n.maxRoundsPerSession, MAX_ROUNDS_PER_SESSION);
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: OK, threads: 0 }, { maxThreads: 14 }).threads, 14);
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: OK, threads: 3 }, { maxThreads: 14 }).threads, 3);
});

test('nevalidna strategija ili igra → {ok:false, error}', () => {
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: { ...OK, baseBet: 0.0005 } }, { maxThreads: 14 }).ok, false, 'prašinski baseBet se odbija');
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: { ...OK, baseBet: -1 } }, { maxThreads: 14 }).ok, false);
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: { ...OK, baseBet: 'abc' } }, { maxThreads: 14 }).ok, false);
  assert.strictEqual(normalizeSimOptions({ game: 'poker', strategy: OK }, { maxThreads: 14 }).ok, false);
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: null }, { maxThreads: 14 }).ok, false);
  assert.strictEqual(normalizeSimOptions({ game: 'dice', strategy: OK, budgets: ['x'] }, { maxThreads: 14 }).ok, false, 'nijedan validan budžet');
});
