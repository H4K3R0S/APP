// Balans igre: setBalance u statistici; strategija pamti početni balans (startBalance) uz ulog; Hub opis.
import { test } from 'node:test';
import assert from 'node:assert';
import { createStats, applyResult, setBalance } from '../shared/session_stats.js';
import { diceStrategy, minesStrategy, kenoStrategy, validateStrategy } from '../shared/strategy_schema.js';
import { describeRules } from '../shared/describe.js';

const L = { isWin: false, betAmount: 1, profit: -1 };
const text = (rows) => rows.map((r) => `${r.label}: ${r.value}`).join(' | ');

test('setBalance: novi početni balans briše brojače; nevalidan iznos se odbija', () => {
  let s = createStats();
  s = applyResult(s, L);
  const n = setBalance(s, 250);
  assert.strictEqual(n.balance, 250);
  assert.strictEqual(n.initialBalance, 250);
  assert.strictEqual(n.bets, 0);
  assert.strictEqual(setBalance(s, 0), s, 'nula → nepromenjeno');
  assert.strictEqual(setBalance(s, -5), s);
  assert.strictEqual(setBalance(s, 'abc'), s);
  assert.strictEqual(setBalance(s, '12.345678999').balance, 12.345679);
});

test('startBalance: čuva se uz baseBet (sve igre), default 0, negativno → 0, validacija ≥ 0', () => {
  assert.strictEqual(diceStrategy({ baseBet: 1, startBalance: 500 }).startBalance, 500);
  assert.strictEqual(minesStrategy({ baseBet: 1, selectedFields: [0], startBalance: '250.5' }).startBalance, 250.5);
  assert.strictEqual(kenoStrategy({ baseBet: 1, selectedNumbers: [1], startBalance: 80 }).startBalance, 80);
  assert.strictEqual(diceStrategy({ baseBet: 1 }).startBalance, 0);
  assert.strictEqual(diceStrategy({ baseBet: 1, startBalance: -3 }).startBalance, 0);
  assert.strictEqual(validateStrategy(diceStrategy({ baseBet: 1, startBalance: 500 })).ok, true);
  const bad = validateStrategy({ ...diceStrategy({ baseBet: 1 }), startBalance: -1 });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.some((e) => /startBalance/.test(e)));
});

test('describeRules: početni balans se opisuje kad je zadat, ne pominje se kad je 0', () => {
  assert.match(text(describeRules(diceStrategy({ baseBet: 0.5, startBalance: 500 }))), /Početni balans: 500\.00\$/);
  assert.doesNotMatch(text(describeRules(diceStrategy({ baseBet: 0.5 }))), /Početni balans/);
});
