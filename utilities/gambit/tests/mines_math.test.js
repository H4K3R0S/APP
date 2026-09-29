// Mines kombinatorika: mult(M,k) = 0.99 · C(25,k) / C(25−M,k), 4 decimale.
import { test } from 'node:test';
import assert from 'node:assert';
import { choose, multiplier, nextMultiplier, MIN_MINES, MAX_MINES, FIELDS } from '../shared/mines_math.js';

test('konstante i binomni koeficijent', () => {
  assert.strictEqual(FIELDS, 25);
  assert.strictEqual(MIN_MINES, 1);
  assert.strictEqual(MAX_MINES, 24);
  assert.strictEqual(choose(25, 3), 2300);
  assert.strictEqual(choose(20, 3), 1140);
  assert.strictEqual(choose(5, 0), 1);
  assert.strictEqual(choose(5, 6), 0);
});

test('multiplier: poznate Stake vrednosti', () => {
  assert.strictEqual(multiplier(3, 1), 1.125);
  assert.strictEqual(multiplier(1, 24), 24.75);
  assert.strictEqual(multiplier(24, 1), 24.75);
  assert.strictEqual(multiplier(3, 0), 1);
  assert.strictEqual(multiplier(5, 3), 1.9974);
  assert.strictEqual(nextMultiplier(3, 0), 1.125);
  assert.strictEqual(nextMultiplier(3, 1), multiplier(3, 2));
});

test('multiplier raste sa k i sa M', () => {
  assert.ok(multiplier(3, 2) > multiplier(3, 1));
  assert.ok(multiplier(10, 1) > multiplier(3, 1));
  assert.strictEqual(multiplier(3, 23), 0, 'više od 22 dijamanta sa 3 mine nije moguće');
});
