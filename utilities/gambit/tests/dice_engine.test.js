// Dice engine: ishod jednog kruga iz roll vrednosti; validacija uloga.
import { test } from 'node:test';
import assert from 'node:assert';
import { resolveRoll, validateBet } from '../shared/dice_engine.js';

test('over 50.5: roll 50.50 = pobeda (granica uključena) sa profitom bet·(99/49.5)−bet; roll 50.49 = gubitak', () => {
  const win = resolveRoll({ betAmount: 1, targetValue: 50.5, condition: 'over' }, 50.5);
  assert.strictEqual(win.isWin, true);
  assert.strictEqual(win.multiplier, 2);
  assert.strictEqual(win.chance, 49.5);
  assert.strictEqual(win.profit, 1);
  assert.strictEqual(win.roll, 50.5);
  const lose = resolveRoll({ betAmount: 1, targetValue: 50.5, condition: 'over' }, 50.49);
  assert.strictEqual(lose.isWin, false);
  assert.strictEqual(lose.profit, -1);
});

test('over i under imaju IDENTIČAN broj dobitnih ishoda od 10.000 (house edge tačno 1% u oba smera)', () => {
  const countWins = (condition, chance) => {
    const targetValue = condition === 'under' ? chance : Math.round((100 - chance) * 100) / 100;
    let wins = 0;
    for (let i = 0; i < 10000; i++) if (resolveRoll({ betAmount: 1, targetValue, condition }, i / 100).isWin) wins += 1;
    return wins;
  };
  for (const c of [2, 49.5, 98]) {
    assert.strictEqual(countWins('under', c), c * 100, `under ${c}`);
    assert.strictEqual(countWins('over', c), c * 100, `over ${c}`);
  }
});

test('under 49.5: roll 49.49 = pobeda, 49.50 = gubitak', () => {
  assert.strictEqual(resolveRoll({ betAmount: 2, targetValue: 49.5, condition: 'under' }, 49.49).isWin, true);
  assert.strictEqual(resolveRoll({ betAmount: 2, targetValue: 49.5, condition: 'under' }, 49.5).isWin, false);
});

test('validateBet: prihvata ulog 0, odbija prašinski/negativan, bet > balance, loš uslov, chance van opsega', () => {
  assert.strictEqual(validateBet({ betAmount: 1, targetValue: 50.5, condition: 'over', balance: 10 }).ok, true);
  assert.strictEqual(validateBet({ betAmount: 0, targetValue: 50.5, condition: 'over', balance: 10 }).ok, true, 'ulog 0 je dozvoljen');
  assert.strictEqual(validateBet({ betAmount: -1, targetValue: 50.5, condition: 'over', balance: 10 }).ok, false);
  assert.strictEqual(validateBet({ betAmount: 0.0001, targetValue: 50.5, condition: 'over', balance: 10 }).ok, false);
  assert.strictEqual(validateBet({ betAmount: 11, targetValue: 50.5, condition: 'over', balance: 10 }).ok, false);
  assert.strictEqual(validateBet({ betAmount: 1, targetValue: 50.5, condition: 'sideways', balance: 10 }).ok, false);
  assert.strictEqual(validateBet({ betAmount: 1, targetValue: 99.5, condition: 'over', balance: 10 }).ok, false);
  assert.match(validateBet({ betAmount: 11, targetValue: 50.5, condition: 'over', balance: 10 }).error, /balans/i);
});
