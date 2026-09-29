// Mines engine (čisto): generisanje table, runda (reveal/cashout), validacija starta.
import { test } from 'node:test';
import assert from 'node:assert';
import { generateBoard, createRound, reveal, cashout, validateStart } from '../shared/mines_engine.js';
import { multiplier } from '../shared/mines_math.js';
import { createRng } from '../shared/rng.js';

const rng = () => createRng({ serverSeed: 'c'.repeat(64), clientSeed: 'mines', nonce: 0 });
const r8 = (x) => Math.round(x * 1e8) / 1e8;

test('generateBoard: tačno M jedinstvenih mina u [0,24], deterministički', () => {
  const b = generateBoard(3, rng());
  assert.strictEqual(b.size, 3);
  for (const i of b) assert.ok(Number.isInteger(i) && i >= 0 && i <= 24);
  assert.deepStrictEqual([...generateBoard(3, rng())].sort(), [...b].sort());
  assert.strictEqual(generateBoard(24, rng()).size, 24);
});

test('runda: reveal dijamant → multiplikator; isto polje dvaput → error; mina → lose sa listom mina', () => {
  const round = createRound({ betAmount: 2, minesCount: 3, mines: new Set([0, 1, 2]) });
  const d = reveal(round, 5);
  assert.strictEqual(d.status, 'diamond');
  assert.strictEqual(d.revealed, 1);
  assert.strictEqual(d.multiplier, multiplier(3, 1));
  assert.strictEqual(d.nextMultiplier, multiplier(3, 2));
  assert.ok(reveal(round, 5).error, 'isto polje dvaput');
  assert.ok(reveal(round, 25).error, 'indeks van opsega');
  const l = reveal(round, 0);
  assert.strictEqual(l.status, 'lose');
  assert.strictEqual(l.profit, -2);
  assert.deepStrictEqual([...l.mines].sort(), [0, 1, 2]);
  assert.strictEqual(round.active, false);
  assert.ok(reveal(round, 7).error, 'runda završena');
});

test('cashout: pre prvog dijamanta → error; posle 2 dijamanta → win profit = bet·mult(3,2) − bet; posle toga sve → error', () => {
  const round = createRound({ betAmount: 1, minesCount: 3, mines: new Set([0, 1, 2]) });
  assert.ok(cashout(round).error);
  reveal(round, 5); reveal(round, 6);
  const w = cashout(round);
  assert.strictEqual(w.status, 'win');
  assert.strictEqual(w.multiplier, multiplier(3, 2));
  assert.strictEqual(w.profit, r8(1 * multiplier(3, 2) - 1));
  assert.deepStrictEqual([...w.mines].sort(), [0, 1, 2]);
  assert.ok(cashout(round).error);
  assert.ok(reveal(round, 8).error);
});

test('otvaranje svih 22 dijamanata automatski završava rundu kao win', () => {
  const round = createRound({ betAmount: 1, minesCount: 3, mines: new Set([0, 1, 2]) });
  let last = null;
  for (let i = 3; i < 25; i++) last = reveal(round, i);
  assert.strictEqual(last.status, 'win');
  assert.strictEqual(last.multiplier, multiplier(3, 22));
  assert.strictEqual(round.active, false);
});

test('validateStart: prihvata ulog 0, odbija „prašinu"/negativ/bet>balance, M<1, M>24, ne-ceo M', () => {
  assert.strictEqual(validateStart({ betAmount: 1, minesCount: 3, balance: 10 }).ok, true);
  assert.strictEqual(validateStart({ betAmount: 0, minesCount: 3, balance: 10 }).ok, true, 'ulog 0 je dozvoljen');
  assert.strictEqual(validateStart({ betAmount: 0.0005, minesCount: 3, balance: 10 }).ok, false, 'prašinski opseg (0, MIN_BET) se odbija');
  assert.strictEqual(validateStart({ betAmount: -1, minesCount: 3, balance: 10 }).ok, false);
  assert.strictEqual(validateStart({ betAmount: 11, minesCount: 3, balance: 10 }).ok, false);
  assert.strictEqual(validateStart({ betAmount: 1, minesCount: 0, balance: 10 }).ok, false);
  assert.strictEqual(validateStart({ betAmount: 1, minesCount: 25, balance: 10 }).ok, false);
  assert.strictEqual(validateStart({ betAmount: 1, minesCount: 2.5, balance: 10 }).ok, false);
});
