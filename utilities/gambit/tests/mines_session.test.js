// Mines sesija Main procesa: jedna aktivna runda, abort, start dok je aktivna → error, minesCount zaključan po rundi.
import { test } from 'node:test';
import assert from 'node:assert';
import { createMinesSession } from '../main/mines_session.js';
import { createSeedStore } from '../main/seeds.js';

const session = () => createMinesSession(createSeedStore({ serverSeed: 'a'.repeat(64) }));

test('start dok je runda aktivna → error; abort oslobađa; posle abort-a reveal/cashout → error', () => {
  const s = session();
  assert.strictEqual(s.start({ betAmount: 1, minesCount: 3, balance: 100 }).ok, true);
  assert.ok(s.isActive());
  assert.ok(s.start({ betAmount: 1, minesCount: 3, balance: 100 }).error, 'druga runda dok prva traje');
  assert.deepStrictEqual(s.abort(), { ok: true, aborted: true });
  assert.strictEqual(s.isActive(), false);
  assert.ok(s.reveal(0).error);
  assert.ok(s.cashout().error);
  assert.deepStrictEqual(s.abort(), { ok: true, aborted: false }, 'abort bez runde je bezopasan');
  assert.strictEqual(s.start({ betAmount: 1, minesCount: 3, balance: 100 }).ok, true, 'nova runda posle abort-a');
});

test('runda pamti svoj minesCount: tabla ima tačno M mina bez obzira na kasnije argumente', () => {
  const s = session();
  s.start({ betAmount: 1, minesCount: 5, balance: 100 });
  let mines = null;
  for (let i = 0; i < 25 && !mines; i++) {
    const r = s.reveal(i);
    if (r.status === 'lose' || r.status === 'win') mines = r.mines;
  }
  assert.strictEqual(mines.length, 5);
});

test('state() izlaže samo javno stanje (bez pozicija mina)', () => {
  const s = session();
  assert.deepStrictEqual(s.state(), { active: false });
  s.start({ betAmount: 2, minesCount: 3, balance: 100 });
  const st = s.state();
  assert.strictEqual(st.active, true);
  assert.strictEqual(st.betAmount, 2);
  assert.strictEqual(st.minesCount, 3);
  assert.strictEqual(st.revealed, 0);
  assert.strictEqual(st.mines, undefined);
});
