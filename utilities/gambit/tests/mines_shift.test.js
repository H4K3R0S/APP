// Rotacija matrice polja (Mines): mirror / invert / random + okidači (stay / now / after N).
import { test } from 'node:test';
import assert from 'node:assert';
import { mirror, invert, random, applyShift, createShiftState } from '../shared/mines_shift.js';
import { createRng } from '../shared/rng.js';

const rng = () => { const r = createRng({ serverSeed: 'd'.repeat(64), clientSeed: 's', nonce: 0 }); r.beginRound(); return r; };
const uniqueInRange = (arr) => new Set(arr).size === arr.length && arr.every((i) => Number.isInteger(i) && i >= 0 && i <= 24);

test('mirror: horizontalno ogledalo r*5+(4−c); involucija', () => {
  assert.deepStrictEqual(mirror([0, 4, 20, 24]), [4, 0, 24, 20]);
  assert.deepStrictEqual(mirror([12]), [12]);
  assert.deepStrictEqual(mirror([1, 2, 3]), [3, 2, 1]);
  assert.deepStrictEqual(mirror(mirror([7, 13, 19])), [7, 13, 19]);
});

test('random: isti broj polja, jedinstvena, u opsegu, različita od ulaza; deterministički po rng-u', () => {
  const out = random([0, 1, 2, 3], rng());
  assert.strictEqual(out.length, 4);
  assert.ok(uniqueInRange(out));
  assert.notDeepStrictEqual([...out].sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.deepStrictEqual(random([0, 1, 2, 3], rng()), out);
});

test('invert: komplement kad ima dovoljno slobodnih; inače random', () => {
  const inv = invert([0, 1, 2], rng());
  assert.strictEqual(inv.length, 3);
  assert.ok(uniqueInRange(inv));
  assert.ok(inv.every((i) => ![0, 1, 2].includes(i)), 'nijedno staro polje');
  const big = Array.from({ length: 22 }, (_, i) => i); // komplement ima samo 3 polja < 22
  const out = invert(big, rng());
  assert.strictEqual(out.length, 22);
  assert.ok(uniqueInRange(out));
});

test('applyShift bira algoritam; nepoznat → null; mirror koji ne menja skup pada na vertikalno ogledalo, pa random', () => {
  assert.deepStrictEqual(applyShift([0, 1], 'mirror', rng()), [4, 3]);
  assert.strictEqual(applyShift([0, 4], 'random', rng()).length, 2);
  assert.strictEqual(applyShift([0, 4], 'teleport', rng()), null);
  // [0,4] je horizontalno simetričan → vertikalno ogledalo (4−r)*5+c → [20,24]
  assert.deepStrictEqual([...applyShift([0, 4], 'mirror', rng())].sort((a, b) => a - b), [20, 24]);
  // uglovi su simetrični u oba pravca → random (različit skup)
  const corners = applyShift([0, 4, 20, 24], 'mirror', rng());
  assert.strictEqual(corners.length, 4);
  assert.notDeepStrictEqual([...corners].sort((a, b) => a - b), [0, 4, 20, 24]);
  // svih 25 polja: nijedna rotacija ne menja skup → null
  assert.strictEqual(applyShift(Array.from({ length: 25 }, (_, i) => i), 'random', rng()), null);
});

test('applyShift mirror ne troši rng kad ogledalo već menja skup (lenj lanac)', () => {
  let calls = 0;
  const counting = { int: (n) => { calls += 1; return rng().int(n); } };
  assert.deepStrictEqual(applyShift([0, 1, 2], 'mirror', counting), [4, 3, 2]);
  assert.strictEqual(calls, 0);
});

test('createShiftState: stay nikad; now odmah; after N tek na N-tom uzastopnom; brojači se resetuju', () => {
  const st = createShiftState({ onWin: { mode: 'stay', count: 0 }, onLoss: { mode: 'after', count: 2 }, algo: 'mirror' });
  assert.strictEqual(st.onWin([0, 1], rng()), null);
  assert.strictEqual(st.onLoss([0, 1], rng()), null, '1. gubitak');
  assert.deepStrictEqual(st.onLoss([0, 1], rng()), [4, 3], '2. gubitak → rotacija');
  assert.strictEqual(st.onLoss([4, 3], rng()), null, 'brojač resetovan');
  st.onWin([4, 3], rng());
  assert.strictEqual(st.onLoss([4, 3], rng()), null, 'pobeda resetuje niz gubitaka');
  const now = createShiftState({ onWin: { mode: 'now' }, onLoss: { mode: 'stay' }, algo: 'mirror' });
  assert.deepStrictEqual(now.onWin([1], rng()), [3]);
  now.reset();
  assert.deepStrictEqual(now.onWin([1], rng()), [3]);
});
