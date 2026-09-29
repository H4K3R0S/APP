// Keno engine (čisto): izvlačenje 10 od 40, ishod tiketa, validacija.
import { test } from 'node:test';
import assert from 'node:assert';
import { draw, resolvePlay, validatePlay } from '../shared/keno_engine.js';
import { payout } from '../shared/keno_paytables.js';
import { createRng } from '../shared/rng.js';

const rng = () => { const r = createRng({ serverSeed: 'e'.repeat(64), clientSeed: 'keno', nonce: 0 }); r.beginRound(); return r; };

test('draw: 10 jedinstvenih brojeva 1–40, deterministički', () => {
  const d = draw(rng());
  assert.strictEqual(d.length, 10);
  assert.strictEqual(new Set(d).size, 10);
  assert.ok(d.every((n) => Number.isInteger(n) && n >= 1 && n <= 40));
  assert.deepStrictEqual(draw(rng()), d);
});

test('resolvePlay: pogoci = presek, multiplikator iz tablice, profit', () => {
  const drawn = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const r = resolvePlay({ betAmount: 2, selectedNumbers: [1, 2, 3], riskLevel: 'classic' }, drawn);
  assert.deepStrictEqual(r.hitNumbers, [1, 3]);
  assert.strictEqual(r.hits, 2);
  assert.strictEqual(r.multiplier, payout('classic', 3, 2));
  assert.strictEqual(r.profit, Math.round((2 * payout('classic', 3, 2) - 2) * 1e8) / 1e8);
  assert.deepStrictEqual(r.drawnNumbers, drawn);
  const lose = resolvePlay({ betAmount: 2, selectedNumbers: [2, 4, 6], riskLevel: 'high' }, drawn);
  assert.strictEqual(lose.hits, 0);
  assert.strictEqual(lose.profit, -2);
  assert.strictEqual(lose.isWin, false);
});

test('validatePlay: odbija 0 i 11 brojeva, duplikate, 41, loš risk, bet > balance, bet < 0.001', () => {
  const ok = { betAmount: 1, selectedNumbers: [5, 12, 23], riskLevel: 'classic', balance: 10 };
  assert.strictEqual(validatePlay(ok).ok, true);
  assert.strictEqual(validatePlay({ ...ok, selectedNumbers: [] }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, selectedNumbers: Array.from({ length: 11 }, (_, i) => i + 1) }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, selectedNumbers: [5, 5] }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, selectedNumbers: [41] }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, selectedNumbers: [0] }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, riskLevel: 'insane' }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, betAmount: 11 }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, betAmount: 0 }).ok, true, 'ulog 0 je dozvoljen');
  assert.strictEqual(validatePlay({ ...ok, betAmount: 0.0001 }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, betAmount: -1 }).ok, false);
  assert.strictEqual(validatePlay({ ...ok, selectedNumbers: 'abc' }).ok, false);
});
