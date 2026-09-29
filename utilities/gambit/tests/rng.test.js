// Provably-fair RNG: HMAC-SHA256(serverSeed, clientSeed:nonce:cursor) → float 0.00–99.99; deterministički.
import { test } from 'node:test';
import assert from 'node:assert';
import { createRng, hashSeed, randomSeedHex } from '../shared/rng.js';

const SEEDS = { serverSeed: 'a'.repeat(64), clientSeed: 'gambit_seed', nonce: 0 };

test('determinizam: isti seed-ovi → isti niz', () => {
  const a = createRng({ ...SEEDS });
  const b = createRng({ ...SEEDS });
  const sa = [1, 2, 3, 4, 5].map(() => a.roll().value);
  const sb = [1, 2, 3, 4, 5].map(() => b.roll().value);
  assert.deepStrictEqual(sa, sb);
  assert.notStrictEqual(new Set(sa).size, 1);
});

test('opseg [0, 99.99] sa 2 decimale, srednja vrednost ≈ 50 na 10.000 rolova', () => {
  const rng = createRng({ ...SEEDS });
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    const v = rng.roll().value;
    assert.ok(v >= 0 && v <= 99.99, `van opsega ${v}`);
    assert.strictEqual(Math.round(v * 100) / 100, v, `više od 2 decimale ${v}`);
    sum += v;
  }
  const mean = sum / 10000;
  assert.ok(mean > 48.5 && mean < 51.5, `mean=${mean}`);
});

test('roll() uvećava nonce; drugi seed daje drugi niz', () => {
  const rng = createRng({ ...SEEDS });
  assert.strictEqual(rng.roll().nonce, 1);
  assert.strictEqual(rng.roll().nonce, 2);
  assert.strictEqual(rng.nonce, 2);
  const other = createRng({ ...SEEDS, serverSeed: 'b'.repeat(64) });
  assert.notStrictEqual(other.roll().value, createRng({ ...SEEDS }).roll().value);
});

test('shuffle(1..80) je permutacija, deterministička po nonce-u', () => {
  const rng = createRng({ ...SEEDS });
  const arr = Array.from({ length: 80 }, (_, i) => i + 1);
  const s1 = rng.shuffle([...arr]);
  assert.strictEqual(s1.length, 80);
  assert.deepStrictEqual([...s1].sort((a, b) => a - b), arr);
  assert.notDeepStrictEqual(s1, arr);
  const s2 = createRng({ ...SEEDS }).shuffle([...arr]);
  assert.deepStrictEqual(s1, s2);
});

test('hashSeed daje sha256 hex; randomSeedHex(32) daje 64 hex karaktera', () => {
  assert.match(hashSeed('abc'), /^[0-9a-f]{64}$/);
  assert.strictEqual(hashSeed('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.match(randomSeedHex(32), /^[0-9a-f]{64}$/);
  assert.notStrictEqual(randomSeedHex(32), randomSeedHex(32));
});
