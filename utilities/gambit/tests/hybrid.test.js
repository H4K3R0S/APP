// Hibridni menadžer stanja (korak 24): okidači, redosled, jednom po sesiji, handover čuva balans i ulog.
import { test } from 'node:test';
import assert from 'node:assert';
import { createHybrid, executeStateHandover } from '../main/simulator/hybrid.js';
import { playSession } from '../main/simulator/session.js';
import { createRng } from '../shared/rng.js';
import { diceStrategy } from '../shared/strategy_schema.js';

const A = diceStrategy({ strategyName: 'A', baseBet: 1, targetValue: 50.5, condition: 'over', onLoss: { action: 'increase', value: 100 } });
const B = diceStrategy({ strategyName: 'B', baseBet: 0.5, targetValue: 75, condition: 'under' });
const C = diceStrategy({ strategyName: 'C', baseBet: 2 });
const byName = { A, B, C };
const ctx = (o) => ({ round: 10, lossStreak: 0, balance: 100, budget: 100, active: A, bet: 1, ...o });

test('lossStreak okidač: null ispod praga, strategija B na pragu; okida najviše jednom po sesiji; reset vraća', () => {
  const h = createHybrid({ base: A, byName, triggers: [{ when: 'lossStreak', value: 3, switchTo: 'B', actions: {} }] });
  assert.strictEqual(h.check(ctx({ lossStreak: 2 })), null);
  assert.strictEqual(h.check(ctx({ lossStreak: 3 })), B);
  assert.strictEqual(h.check(ctx({ lossStreak: 5, active: B })), null, 'isti okidač ne okida ponovo');
  h.reset();
  assert.strictEqual(h.check(ctx({ lossStreak: 3 })), B);
});

test('balanceDrop okidač: balans < value% budžeta', () => {
  const h = createHybrid({ base: A, byName, triggers: [{ when: 'balanceDrop', value: 50, switchTo: 'C', actions: {} }] });
  assert.strictEqual(h.check(ctx({ balance: 50 })), null, '50% nije ispod');
  assert.strictEqual(h.check(ctx({ balance: 49.99 })), C);
});

test('više okidača ispunjenih u istom krugu → prvi po redu; sledeći može kasnije', () => {
  const h = createHybrid({ base: A, byName, triggers: [
    { when: 'lossStreak', value: 3, switchTo: 'B', actions: {} },
    { when: 'balanceDrop', value: 50, switchTo: 'C', actions: {} },
  ] });
  assert.strictEqual(h.check(ctx({ lossStreak: 3, balance: 10 })), B);
  assert.strictEqual(h.check(ctx({ lossStreak: 0, balance: 10, active: B })), C);
  assert.strictEqual(h.check(ctx({ lossStreak: 9, balance: 1, active: C })), null);
});

test('executeStateHandover čuva balans i ulog, menja aktivnu, resetuje niz gubitaka', () => {
  const s = { active: A, balance: 87.45, bet: 0.8, lossStreak: 5, rounds: 42 };
  const out = executeStateHandover(s, B);
  assert.strictEqual(out.active, B);
  assert.strictEqual(out.balance, 87.45);
  assert.strictEqual(out.bet, 0.8);
  assert.strictEqual(out.lossStreak, 0);
  assert.strictEqual(out.rounds, 42);
});

test('sesija sa hibridom: posle prelaska važe pravila nove strategije; handovers zabeleženi', () => {
  const rng = createRng({ serverSeed: 'h'.repeat(64), clientSeed: 'hy', nonce: 0 });
  const hybrid = createHybrid({ base: A, byName, triggers: [{ when: 'lossStreak', value: 2, switchTo: 'B', actions: {} }] });
  const r = playSession({ game: 'dice', strategy: A, budget: 100, rng, maxRounds: 500, hybrid });
  assert.ok(r.handovers.length >= 1, 'bar jedan prelazak u 500 krugova');
  const h0 = r.handovers[0];
  assert.strictEqual(h0.from, 'A');
  assert.strictEqual(h0.to, 'B');
  assert.strictEqual(h0.lossStreak, 2);
  assert.ok(h0.bet >= 2, 'ulog je Martingale narastao pre prelaska (1→2→4)');
  assert.ok(Number.isFinite(h0.balance));
  assert.strictEqual(r.handovers.length, 1, 'okidač jednom po sesiji');
  // nasleđeni ulog se IGRA u sledećem krugu (pravilo nove strategije se ne primenjuje na krug prelaska)
  assert.strictEqual(h0.nextBet, h0.bet, 'B ima onLoss reset, ali ulog 4 mora ući u sledeći krug netaknut');
});

test('handover: nasleđeni ulog veći od balansa nove faze → bankrot po postojećem pravilu (nema tihog reseta)', () => {
  const rng = createRng({ serverSeed: 'k'.repeat(64), clientSeed: 'hy2', nonce: 0 });
  const hybrid = createHybrid({ base: A, byName, triggers: [{ when: 'lossStreak', value: 3, switchTo: 'B', actions: {} }] });
  const r = playSession({ game: 'dice', strategy: A, budget: 10, rng, maxRounds: 5000, hybrid });
  if (r.handovers.length) {
    const h0 = r.handovers[0];
    assert.strictEqual(h0.nextBet, h0.bet);
    if (h0.bet > h0.balance) assert.strictEqual(r.outcome, 'bankrupt');
  }
  assert.ok(r.rounds <= 5000);
});
