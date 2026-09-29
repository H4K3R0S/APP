// Pravila uloga za auto igru: nextBet (reset / increase %) i shouldStop (maxBets, takeProfit, stopLoss, bankrot).
import { test } from 'node:test';
import assert from 'node:assert';
import { nextBet, shouldStop } from '../shared/bet_rules.js';

const MART = { onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } };

test('nextBet: gubitak + increase 100% duplira; dobitak + reset vraća bazu', () => {
  assert.strictEqual(nextBet(1, 1, false, MART), 2);
  assert.strictEqual(nextBet(2, 1, false, MART), 4);
  assert.strictEqual(nextBet(4, 1, true, MART), 1);
});

test('nextBet: increase na dobitak; reset na gubitak; 8 decimala', () => {
  const rules = { onLoss: { action: 'reset', value: 0 }, onWin: { action: 'increase', value: 50 } };
  assert.strictEqual(nextBet(2, 1, true, rules), 3);
  assert.strictEqual(nextBet(3, 1, false, rules), 1);
  assert.strictEqual(nextBet(0.001, 0.001, false, { onLoss: { action: 'increase', value: 33.3333 }, onWin: { action: 'reset' } }), 0.00133333);
});

test('shouldStop: maxBets dostignut', () => {
  assert.deepStrictEqual(shouldStop({ betsPlayed: 10, maxBets: 10, sessionProfit: 0, stopConditions: {}, balance: 100, nextBet: 1 }), { stop: true, reason: 'maxBets' });
  assert.deepStrictEqual(shouldStop({ betsPlayed: 9, maxBets: 10, sessionProfit: 0, stopConditions: {}, balance: 100, nextBet: 1 }), { stop: false, reason: null });
  assert.strictEqual(shouldStop({ betsPlayed: 999, maxBets: 0, sessionProfit: 0, stopConditions: {}, balance: 100, nextBet: 1 }).stop, false, '0 = beskonačno');
});

test('shouldStop: takeProfit i stopLoss (0 = isključeno)', () => {
  assert.strictEqual(shouldStop({ betsPlayed: 1, maxBets: 0, sessionProfit: 60, stopConditions: { takeProfit: 50 }, balance: 100, nextBet: 1 }).reason, 'takeProfit');
  assert.strictEqual(shouldStop({ betsPlayed: 1, maxBets: 0, sessionProfit: -25, stopConditions: { stopLoss: 20 }, balance: 100, nextBet: 1 }).reason, 'stopLoss');
  assert.strictEqual(shouldStop({ betsPlayed: 1, maxBets: 0, sessionProfit: 1e9, stopConditions: { takeProfit: 0, stopLoss: 0 }, balance: 100, nextBet: 1 }).stop, false);
});

test('shouldStop: bankrot kad sledeći ulog premaši balans (pre nego što se odigra)', () => {
  assert.strictEqual(shouldStop({ betsPlayed: 1, maxBets: 0, sessionProfit: 0, stopConditions: {}, balance: 2, nextBet: 2.5 }).reason, 'bankrupt');
  assert.strictEqual(shouldStop({ betsPlayed: 1, maxBets: 0, sessionProfit: 0, stopConditions: {}, balance: 2, nextBet: 2 }).stop, false);
});
