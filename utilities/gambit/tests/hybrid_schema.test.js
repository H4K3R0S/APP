// Hibridna (Multi-Strategy) konfiguracija: oblik + validacija (okidači, ista igra, postojeće strategije).
import { test } from 'node:test';
import assert from 'node:assert';
import { hybridStrategy, validateHybrid, TRIGGER_KINDS } from '../shared/hybrid_schema.js';

const gameOf = (name) => ({ A: 'dice', B: 'dice', C: 'dice', M1: 'mines' }[name] || null);

test('hybridStrategy: defaults i normalizacija okidača', () => {
  const h = hybridStrategy({ game: 'dice', strategyName: 'Hibrid_1', baseStrategy: 'A', triggers: [{ when: 'lossStreak', value: '5', switchTo: 'B' }] });
  assert.strictEqual(h.type, 'multi');
  assert.strictEqual(h.game, 'dice');
  assert.strictEqual(h.baseStrategy, 'A');
  assert.deepStrictEqual(h.triggers, [{ when: 'lossStreak', value: 5, switchTo: 'B', actions: { minesShift: false, kenoSwapAnchors: false, diceRaiseMultiplier: false } }]);
  assert.match(h.createdAt, /^\d{4}-/);
  assert.deepStrictEqual(TRIGGER_KINDS, ['lossStreak', 'balanceDrop']);
  assert.deepStrictEqual(hybridStrategy({ game: 'dice', baseStrategy: 'A' }).triggers, []);
});

test('validateHybrid: prazan triggers je OK; loš when / value 0 / balanceDrop 150 / nepostojeća ili tuđa igra → greške', () => {
  const ok = hybridStrategy({ game: 'dice', strategyName: 'H', baseStrategy: 'A', triggers: [] });
  assert.strictEqual(validateHybrid(ok, { gameOf }).ok, true);
  const bad = (t) => validateHybrid(hybridStrategy({ game: 'dice', strategyName: 'H', baseStrategy: 'A', triggers: [t] }), { gameOf });
  assert.strictEqual(bad({ when: 'moon', value: 1, switchTo: 'B' }).ok, false);
  assert.strictEqual(bad({ when: 'lossStreak', value: 0, switchTo: 'B' }).ok, false);
  assert.strictEqual(bad({ when: 'balanceDrop', value: 150, switchTo: 'B' }).ok, false);
  assert.strictEqual(bad({ when: 'balanceDrop', value: 70, switchTo: 'B' }).ok, true);
  assert.strictEqual(bad({ when: 'lossStreak', value: 3, switchTo: 'NEMA' }).ok, false, 'nepostojeća');
  assert.strictEqual(bad({ when: 'lossStreak', value: 3, switchTo: 'M1' }).ok, false, 'druga igra');
  assert.strictEqual(validateHybrid(hybridStrategy({ game: 'dice', baseStrategy: 'NEMA', triggers: [] }), { gameOf }).ok, false, 'bazna ne postoji');
  assert.strictEqual(validateHybrid(hybridStrategy({ game: 'dice', baseStrategy: 'M1', triggers: [] }), { gameOf }).ok, false, 'bazna iz druge igre');
  assert.ok(validateHybrid(hybridStrategy({ game: 'dice', baseStrategy: 'A', triggers: [{ when: 'lossStreak', value: 3, switchTo: 'A' }] }), { gameOf }).ok, 'prebacivanje na baznu je dozvoljeno (ponovno učitavanje)');
});
