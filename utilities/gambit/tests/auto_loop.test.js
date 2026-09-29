// Auto-petlja: stop() tokom kašnjenja NE sme odigrati još jedan krug; stopAndWait čeka kraj.
import { test } from 'node:test';
import assert from 'node:assert';
import { createAutoLoop } from '../src/js/auto/loop.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RULES = { onLoss: { action: 'increase', value: 100 }, onWin: { action: 'reset', value: 0 } };

function makeLoop(calls) {
  return createAutoLoop({
    playRound: async (bet) => { calls.push(bet); await sleep(1); return { isWin: false, profit: -bet }; },
    getBalance: () => 1000,
  });
}

test('stop() pozvan tokom delayMs → petlja staje bez dodatnog kruga', async () => {
  const calls = [];
  const loop = makeLoop(calls);
  const done = loop.start({ baseBet: 1, rules: RULES, maxBets: 0, stopConditions: {}, delayMs: 60 });
  await sleep(95); // 2 kruga odigrana (≈1 ms + 60 ms delay + 1 ms), sada smo usred 2. kašnjenja
  const before = calls.length;
  loop.stop();
  const summary = await done;
  assert.strictEqual(summary.reason, 'stopped');
  assert.strictEqual(calls.length, before, 'posle stop() nema novog kruga');
  assert.strictEqual(summary.betsPlayed, before);
});

test('gameState: Dice uslovi (switchDir/setChance) menjaju stanje koje stiže u onRound', async () => {
  const conditions = [
    { kind: 'bet', on: 'every', count: 1, outcome: 'bets', do: 'switchDir', value: 0 },
    { kind: 'bet', on: 'every', count: 1, outcome: 'losses', do: 'setChance', value: 25 },
  ];
  const seen = [];
  const loop = createAutoLoop({
    playRound: async () => ({ isWin: false, profit: -1 }),
    getBalance: () => 1000,
    onRound: (_res, _next, _bp, _sp, gs) => { seen.push({ chance: gs.chance, condition: gs.condition }); },
  });
  loop.start({ baseBet: 1, conditions, maxBets: 3, stopConditions: {}, delayMs: 0, gameState: { chance: 49.5, condition: 'over', baseChance: 49.5 } });
  await sleep(60);
  assert.deepStrictEqual(seen[0], { chance: 25, condition: 'under' });
  assert.deepStrictEqual(seen[1], { chance: 25, condition: 'over' });
  assert.deepStrictEqual(seen[2], { chance: 25, condition: 'under' });
});

test('stopAndWait() vraća sažetak; isRunning false posle; bez pokrenute petlje vraća null', async () => {
  const calls = [];
  const loop = makeLoop(calls);
  assert.strictEqual(await loop.stopAndWait(), null);
  loop.start({ baseBet: 1, rules: RULES, maxBets: 0, stopConditions: {}, delayMs: 30 });
  await sleep(10);
  const s = await loop.stopAndWait();
  assert.strictEqual(s.reason, 'stopped');
  assert.strictEqual(loop.isRunning(), false);
});
