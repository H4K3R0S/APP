// Šema strategije: defaults + validacija (spec §3.5).
import { test } from 'node:test';
import assert from 'node:assert';
import { diceStrategy, minesStrategy, kenoStrategy, validateStrategy } from '../shared/strategy_schema.js';

test('kenoStrategy: defaults (classic, prazni brojevi, sidro isključeno/random) i validacija', () => {
  const s = kenoStrategy({ strategyName: 'K', baseBet: 0.5, selectedNumbers: [7, 14, 21] });
  assert.strictEqual(s.game, 'keno');
  assert.strictEqual(s.riskLevel, 'classic');
  assert.deepStrictEqual(s.selectedNumbers, [7, 14, 21]);
  assert.deepStrictEqual(s.anchor, { enabled: false, fillMode: 'random' });
  assert.strictEqual(validateStrategy(s).ok, true);
  assert.strictEqual(validateStrategy(kenoStrategy({ baseBet: 1, selectedNumbers: [] })).ok, false, 'bez sidra mora imati brojeve');
  assert.strictEqual(validateStrategy(kenoStrategy({ baseBet: 1, selectedNumbers: [], anchor: { enabled: true, fillMode: 'cold' } })).ok, true, 'sa sidrom brojevi nisu obavezni');
  assert.strictEqual(validateStrategy(kenoStrategy({ baseBet: 1, selectedNumbers: Array.from({ length: 11 }, (_, i) => i + 1) })).ok, false);
  assert.strictEqual(validateStrategy(kenoStrategy({ baseBet: 1, selectedNumbers: [3, 3] })).ok, false);
  assert.strictEqual(validateStrategy({ ...kenoStrategy({ baseBet: 1, selectedNumbers: [1] }), riskLevel: 'insane' }).ok, false);
  assert.strictEqual(validateStrategy(kenoStrategy({ baseBet: 1, selectedNumbers: [41] })).ok, false, 'tabla je 40 brojeva');
  assert.strictEqual(validateStrategy(kenoStrategy({ baseBet: 1, selectedNumbers: [40] })).ok, true);
  const a = kenoStrategy({ baseBet: 1, riskLevel: 'high', anchor: { enabled: true, fillMode: 'cold' } });
  assert.strictEqual(a.riskLevel, 'high');
  assert.deepStrictEqual(a.anchor, { enabled: true, fillMode: 'cold' });
  assert.strictEqual(kenoStrategy({ anchor: { enabled: true, fillMode: 'hot' } }).anchor.fillMode, 'random');
});

test('minesStrategy: defaults (3 mine, prazna polja, shift stay/stay/random) i validacija broja polja', () => {
  const s = minesStrategy({ strategyName: 'M', baseBet: 0.1, selectedFields: [0, 4, 20, 24] });
  assert.strictEqual(s.game, 'mines');
  assert.strictEqual(s.minesCount, 3);
  assert.deepStrictEqual(s.selectedFields, [0, 4, 20, 24]);
  assert.deepStrictEqual(s.shift, { onWin: { mode: 'stay', count: 0 }, onLoss: { mode: 'stay', count: 0 }, algo: 'random' });
  assert.strictEqual(validateStrategy(s).ok, true);
  assert.strictEqual(validateStrategy(minesStrategy({ baseBet: 1, selectedFields: [] })).ok, false, 'bez polja');
  assert.strictEqual(validateStrategy(minesStrategy({ baseBet: 1, minesCount: 3, selectedFields: Array.from({ length: 23 }, (_, i) => i) })).ok, false, '23 polja > 22');
  assert.strictEqual(validateStrategy(minesStrategy({ baseBet: 1, selectedFields: [1, 1] })).ok, false, 'duplikat');
  assert.strictEqual(validateStrategy(minesStrategy({ baseBet: 1, selectedFields: [25] })).ok, false, 'van opsega');
  assert.strictEqual(validateStrategy(minesStrategy({ baseBet: 1, minesCount: 30, selectedFields: [0] })).ok, false, 'M>24');
  const sh = minesStrategy({ baseBet: 1, selectedFields: [0], shift: { onLoss: { mode: 'after', count: 2 }, algo: 'mirror' } });
  assert.deepStrictEqual(sh.shift.onLoss, { mode: 'after', count: 2 });
  assert.strictEqual(sh.shift.algo, 'mirror');
  assert.strictEqual(validateStrategy({ ...sh, shift: { ...sh.shift, algo: 'teleport' } }).ok, false);
});

test('diceStrategy: popunjava defaults i createdAt', () => {
  const s = diceStrategy({ strategyName: 'X', baseBet: 0.05 });
  assert.strictEqual(s.game, 'dice');
  assert.strictEqual(s.type, 'solo');
  assert.strictEqual(s.strategyName, 'X');
  assert.strictEqual(s.baseBet, 0.05);
  assert.strictEqual(s.targetValue, 50.5);
  assert.strictEqual(s.condition, 'over');
  assert.strictEqual(s.winChance, 49.5);
  assert.strictEqual(s.maxBets, 0);
  assert.deepStrictEqual(s.onLoss, { action: 'reset', value: 0 });
  assert.deepStrictEqual(s.onWin, { action: 'reset', value: 0 });
  assert.deepStrictEqual(s.stopConditions, { takeProfit: 0, stopLoss: 0 });
  assert.match(s.createdAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('diceStrategy: winChance se izvodi iz targetValue/condition', () => {
  const s = diceStrategy({ targetValue: 75, condition: 'under' });
  assert.strictEqual(s.winChance, 75);
});

test('validateStrategy: prihvata baseBet 0, odbija prašinski baseBet, loš game, loš onLoss', () => {
  assert.strictEqual(validateStrategy(diceStrategy({ baseBet: 1 })).ok, true);
  assert.strictEqual(validateStrategy(diceStrategy({ baseBet: 0 })).ok, true, 'baseBet 0 je dozvoljen');
  const bad = validateStrategy({ ...diceStrategy({ baseBet: 1 }), baseBet: 0.0005 });
  assert.strictEqual(bad.ok, false);
  assert.ok(bad.errors.some((e) => /baseBet/.test(e)));
  assert.strictEqual(validateStrategy({ ...diceStrategy({ baseBet: 1 }), game: 'poker' }).ok, false);
  assert.strictEqual(validateStrategy({ ...diceStrategy({ baseBet: 1 }), onLoss: { action: 'explode', value: 1 } }).ok, false);
});
