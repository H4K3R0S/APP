// Keno frekvencije (sesija): mapa učestalosti, Top 3 sidro (tie-break svežiji pa manji), hladni brojevi, heat, tiket.
import { test } from 'node:test';
import assert from 'node:assert';
import { createFreq, record, topAnchors, coldNumbers, heat, resetFreq, buildTicket } from '../shared/keno_freq.js';
import { createRng } from '../shared/rng.js';

const rng = () => { const r = createRng({ serverSeed: 'f'.repeat(64), clientSeed: 'kf', nonce: 0 }); r.beginRound(); return r; };
const drawWith = (must, start = 20) => {
  const out = [...must];
  for (let n = start; out.length < 10; n++) if (!out.includes(n)) out.push(n);
  return out;
};

test('topAnchors: brojevi izvučeni u sva 3 kruga su sidra; prazna mapa → [1,2,3]', () => {
  const f = createFreq();
  assert.deepStrictEqual(topAnchors(f), [1, 2, 3]);
  record(f, drawWith([12, 24, 37], 20));
  record(f, drawWith([12, 24, 37], 26));
  record(f, drawWith([12, 24, 37], 30));
  assert.deepStrictEqual([...topAnchors(f)].sort((a, b) => a - b), [12, 24, 37]);
  assert.strictEqual(f.history.length, 3);
  assert.strictEqual(f.map[12], 3);
});

test('tie-break: ista učestalost → svežije izvučen ispred; pa manji broj', () => {
  const f = createFreq();
  record(f, drawWith([5], 20));   // 5 i 20..28 po 1
  record(f, drawWith([9], 30));   // 9 i 30..38 po 1 — sve po 1, 9 svežiji od 5
  const top = topAnchors(f, 3);
  assert.strictEqual(top[0], 9, 'svežiji krug ispred');
  assert.ok(top.slice(1).every((n) => n >= 30), 'iz svežijeg kruga, pa manji broj');
  assert.strictEqual(top[1], 30);
});

test('coldNumbers: najređi, bez isključenih, jedinstveni; na početku sve po 0 → najmanji brojevi', () => {
  const f = createFreq();
  const c = coldNumbers(f, 7, [1, 2, 3]);
  assert.deepStrictEqual(c, [4, 5, 6, 7, 8, 9, 10]);
  record(f, drawWith([4, 5], 20));
  const c2 = coldNumbers(f, 7, [1, 2, 3]);
  assert.ok(!c2.includes(4) && !c2.includes(5));
  assert.strictEqual(new Set(c2).size, 7);
});

test('record bez istorije (simulator): history prazna, count raste, mapa je Uint32 (bez prelivanja)', () => {
  const f = createFreq();
  record(f, drawWith([12], 20), { keepHistory: false });
  record(f, drawWith([12], 30), { keepHistory: false });
  assert.strictEqual(f.history.length, 0);
  assert.strictEqual(f.count, 2);
  assert.strictEqual(f.map[12], 2);
  assert.ok(f.map instanceof Uint32Array);
  assert.deepStrictEqual(topAnchors(f, 1), [12]);
  const g = createFreq();
  record(g, drawWith([12], 20));
  assert.strictEqual(g.history.length, 1);
  assert.strictEqual(g.count, 1);
});

test('heat: freq/max, 0 kad je prazno; resetFreq briše', () => {
  const f = createFreq();
  assert.strictEqual(heat(f)[12], 0);
  record(f, drawWith([12], 20)); record(f, drawWith([12], 30));
  const h = heat(f);
  assert.strictEqual(h[12], 1);
  assert.ok(h[20] > 0 && h[20] < 1);
  resetFreq(f);
  assert.strictEqual(f.history.length, 0);
  assert.strictEqual(f.map[12], 0);
});

test('buildTicket: sidro random/cold → 10 jedinstvenih sa sidrima; bez sidra → ručni brojevi', () => {
  const f = createFreq();
  record(f, drawWith([12, 24, 37], 20));
  const anchors = topAnchors(f, 3);
  const tr = buildTicket(f, { anchor: { enabled: true, fillMode: 'random' }, manualNumbers: [1, 2], rng: rng() });
  assert.strictEqual(tr.length, 10);
  assert.strictEqual(new Set(tr).size, 10);
  assert.ok(anchors.every((a) => tr.includes(a)));
  const tc = buildTicket(f, { anchor: { enabled: true, fillMode: 'cold' }, manualNumbers: [], rng: rng() });
  assert.strictEqual(tc.length, 10);
  assert.strictEqual(new Set(tc).size, 10);
  assert.ok(anchors.every((a) => tc.includes(a)));
  assert.deepStrictEqual(buildTicket(f, { anchor: { enabled: false }, manualNumbers: [3, 9, 27], rng: rng() }), [3, 9, 27]);
});
