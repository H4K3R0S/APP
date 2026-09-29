// Dice matematika: house edge 1% → multiplier = 99 / chance; over target = 100 − chance; under target = chance.
import { test } from 'node:test';
import assert from 'node:assert';
import {
  multiplierFromChance, chanceFromMultiplier, targetFromChance, chanceFromTarget,
  clampChance, profitOnWin, MIN_CHANCE, MAX_CHANCE, MIN_BET,
} from '../shared/dice_math.js';

test('konstante', () => {
  assert.strictEqual(MIN_CHANCE, 2);
  assert.strictEqual(MAX_CHANCE, 98);
  assert.strictEqual(MIN_BET, 0.001);
});

test('multiplierFromChance(49.5) === 2 i obrnuto', () => {
  assert.strictEqual(multiplierFromChance(49.5), 2);
  assert.strictEqual(chanceFromMultiplier(2), 49.5);
  assert.strictEqual(multiplierFromChance(2), 49.5);
});

test('target: over = 100 − chance, under = chance', () => {
  assert.strictEqual(targetFromChance(49.5, 'over'), 50.5);
  assert.strictEqual(targetFromChance(49.5, 'under'), 49.5);
  assert.strictEqual(chanceFromTarget(50.5, 'over'), 49.5);
  assert.strictEqual(chanceFromTarget(49.5, 'under'), 49.5);
});

test('clampChance drži opseg [2, 98] na 2 decimale', () => {
  assert.strictEqual(clampChance(1), 2);
  assert.strictEqual(clampChance(99), 98);
  assert.strictEqual(clampChance(33.333), 33.33);
  assert.strictEqual(clampChance(NaN), 2);
});

test('profitOnWin(1, 49.5) === 1', () => {
  assert.strictEqual(profitOnWin(1, 49.5), 1);
  // isplata koristi multiplikator zaokružen na 4 decimale (kao što ga UI prikazuje)
  assert.strictEqual(profitOnWin(2, 98), Math.round((2 * multiplierFromChance(98) - 2) * 1e8) / 1e8);
  assert.strictEqual(multiplierFromChance(98), 1.0102);
});
