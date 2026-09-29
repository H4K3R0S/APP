// Tekstualni opis pravila strategije za Hub panel (čisto): dice / mines / keno / multi.
import { test } from 'node:test';
import assert from 'node:assert';
import { describeRules, describeTrigger } from '../shared/describe.js';
import { diceStrategy, minesStrategy, kenoStrategy } from '../shared/strategy_schema.js';
import { hybridStrategy } from '../shared/hybrid_schema.js';

const text = (rows) => rows.map((r) => `${r.label}: ${r.value}`).join(' | ');

test('dice: ulog, cilj (over/under + šansa + multiplikator), pravila, stop uslovi', () => {
  const s = diceStrategy({ strategyName: 'D', baseBet: 0.05, targetValue: 50.5, condition: 'over', onLoss: { action: 'increase', value: 100 }, stopConditions: { takeProfit: 50, stopLoss: 20 }, maxBets: 1000 });
  const t = text(describeRules(s));
  assert.match(t, /0\.05/);
  assert.match(t, /Roll Over 50\.50/);
  assert.match(t, /49\.50%/);
  assert.match(t, /2\.00×/);
  assert.match(t, /Na gubitak: Povećaj za 100%/);
  assert.match(t, /Na dobitak: Resetuj/);
  assert.match(t, /Take Profit 50/);
  assert.match(t, /Stop Loss 20/);
  assert.match(t, /1000/);
});

test('mines: broj mina, polja, rotacija', () => {
  const s = minesStrategy({ baseBet: 1, minesCount: 3, selectedFields: [0, 4, 20, 24], shift: { onLoss: { mode: 'after', count: 2 }, algo: 'random' } });
  const t = text(describeRules(s));
  assert.match(t, /3 mine/);
  assert.match(t, /0, 4, 20, 24/);
  assert.match(t, /posle 2 uzastopna promašaja/);
  assert.match(t, /Random/);
});

test('keno: rizik, brojevi ili sidro', () => {
  const t1 = text(describeRules(kenoStrategy({ baseBet: 1, riskLevel: 'high', selectedNumbers: [7, 14, 21] })));
  assert.match(t1, /Visoki/);
  assert.match(t1, /7, 14, 21/);
  const t2 = text(describeRules(kenoStrategy({ baseBet: 1, anchor: { enabled: true, fillMode: 'cold' } })));
  assert.match(t2, /Sidro/);
  assert.match(t2, /Cold/);
});

test('multi: bazna + okidači kao rečenice', () => {
  const h = hybridStrategy({ game: 'mines', strategyName: 'H', baseStrategy: 'Uglovi', triggers: [
    { when: 'lossStreak', value: 5, switchTo: 'Defanzivna_02', actions: { minesShift: true } },
    { when: 'balanceDrop', value: 70, switchTo: 'Uglovi' },
  ] });
  const rows = describeRules(h);
  const t = text(rows);
  assert.match(t, /Uglovi/);
  assert.strictEqual(describeTrigger(h.triggers[0]), 'AKO Loss Streak dostigne 5 krugova ➔ aktiviraj rotaciju polja i prebaci na Defanzivna_02');
  assert.strictEqual(describeTrigger(h.triggers[1]), 'AKO balans padne ispod 70% početnog ➔ prebaci na Uglovi');
  assert.ok(rows.some((r) => r.trigger), 'redovi okidača označeni');
});
