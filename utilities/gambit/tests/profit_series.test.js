// Decimacija serije live grafikona (čisto): x ostaje pravi redni broj kruga, najnovija tačka se uvek čuva.
import { test } from 'node:test';
import assert from 'node:assert';
import { createSeries } from '../shared/profit_series.js';

test('bez decimacije ispod limita; x = redni krug', () => {
  const s = createSeries(10);
  for (let i = 1; i <= 5; i++) s.push(i * 2);
  assert.deepStrictEqual(s.xs, [0, 1, 2, 3, 4, 5]);
  assert.deepStrictEqual(s.ys, [0, 2, 4, 6, 8, 10]);
  assert.strictEqual(s.size(), 6);
  assert.strictEqual(s.rounds(), 5);
});

test('preko limita: proredi na pola, zadrži prvu i najnoviju tačku, x ostaje tačan krug', () => {
  const s = createSeries(10);
  for (let i = 1; i <= 25; i++) s.push(i);
  assert.ok(s.size() <= 10, `size ${s.size()}`);
  assert.strictEqual(s.xs[0], 0);
  assert.strictEqual(s.xs[s.xs.length - 1], 25, 'najnovija tačka = krug 25');
  assert.strictEqual(s.ys[s.ys.length - 1], 25);
  for (let i = 0; i < s.xs.length; i++) assert.strictEqual(s.ys[i], s.xs[i], 'y == x za svaki zadržani krug');
  for (let i = 1; i < s.xs.length; i++) assert.ok(s.xs[i] > s.xs[i - 1], 'x strogo raste');
  assert.strictEqual(s.rounds(), 25);
});

test('reset briše sve i vraća nultu tačku', () => {
  const s = createSeries(10);
  for (let i = 1; i <= 8; i++) s.push(i);
  s.reset();
  assert.deepStrictEqual(s.xs, [0]);
  assert.deepStrictEqual(s.ys, [0]);
  assert.strictEqual(s.rounds(), 0);
});
