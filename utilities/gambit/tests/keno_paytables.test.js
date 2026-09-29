// Keno isplatne tablice: PAYTABLES[risk][picks][hits]; 10 izabranih classic/high tačno po spec-u.
import { test } from 'node:test';
import assert from 'node:assert';
import { RISKS, PAYTABLES, payout, paytableFor, MAX_PICKS, DRAW_COUNT, BOARD } from '../shared/keno_paytables.js';

test('konstante', () => {
  assert.deepStrictEqual(RISKS, ['classic', 'low', 'medium', 'high']);
  assert.strictEqual(MAX_PICKS, 10);
  assert.strictEqual(DRAW_COUNT, 10);
  assert.strictEqual(BOARD, 40);
});

test('10 izabranih: oblik po spec-u (classic isplaćuje od 4 pogotka, high od 5; 10/10 = 1000×)', () => {
  const c = paytableFor('classic', 10);
  const hi = paytableFor('high', 10);
  assert.deepStrictEqual(c.slice(0, 4), [0, 0, 0, 0]);
  assert.ok(c[4] > 0 && c[10] === 1000);
  assert.deepStrictEqual(hi.slice(0, 5), [0, 0, 0, 0, 0]);
  assert.ok(hi[5] > 0 && hi[10] === 1000);
  assert.strictEqual(payout('classic', 10, 10), 1000);
  assert.strictEqual(payout('high', 10, 4), 0);
});

test('sve tablice: picks 1–10, dužina picks+1, vrednosti ≥ 0, max pogodak > 0', () => {
  for (const risk of RISKS) {
    for (let picks = 1; picks <= MAX_PICKS; picks++) {
      const t = paytableFor(risk, picks);
      assert.strictEqual(t.length, picks + 1, `${risk}/${picks}`);
      assert.ok(t.every((m) => Number.isFinite(m) && m >= 0), `${risk}/${picks} negativno`);
      assert.ok(t[picks] > 0, `${risk}/${picks} maks pogodak mora isplaćivati`);
    }
  }
  assert.strictEqual(PAYTABLES.classic[1][1] > 0, true);
});

// Hipergeometrijski RTP: P(hits=k | picks, 40 brojeva, 10 izvučenih) = C(picks,k)·C(40−picks,10−k)/C(40,10)
function choose(n, r) { if (r < 0 || r > n) return 0; let x = 1; for (let i = 1; i <= r; i++) x = (x * (n - r + i)) / i; return Math.round(x); }
function rtp(risk, picks) {
  const t = paytableFor(risk, picks);
  let ev = 0;
  for (let k = 0; k <= picks; k++) ev += (choose(picks, k) * choose(BOARD - picks, DRAW_COUNT - k) / choose(BOARD, DRAW_COUNT)) * t[k];
  return ev;
}

test('svaka tablica ima RTP u [0.97, 1.0] (house edge ~1%) — uključujući 10 izabranih classic/high', () => {
  for (const risk of RISKS) {
    for (let picks = 1; picks <= MAX_PICKS; picks++) {
      const r = rtp(risk, picks);
      assert.ok(r >= 0.97 && r <= 1.0, `${risk}/${picks}: RTP ${r.toFixed(4)}`);
    }
  }
});

test('payout za nepostojeće kombinacije vraća 0', () => {
  assert.strictEqual(payout('classic', 0, 0), 0);
  assert.strictEqual(payout('classic', 11, 1), 0);
  assert.strictEqual(payout('poker', 3, 3), 0);
  assert.strictEqual(payout('classic', 3, 4), 0);
});
