// Worker pool runner: deli sesije na N niti, agregira, javlja progres, podržava otkazivanje.
import { test } from 'node:test';
import assert from 'node:assert';
import { runSimulation } from '../main/simulator/runner.js';
import { diceStrategy } from '../shared/strategy_schema.js';

const MART = diceStrategy({ strategyName: 'M', baseBet: 1, targetValue: 50.5, condition: 'over', onLoss: { action: 'increase', value: 100 } });

test('2 niti, 2 budžeta × 4 sesije → 8 rezultata, progres raste do 100%, izveštaj kompletan', async () => {
  const progress = [];
  const report = await runSimulation({
    game: 'dice', strategy: MART, threads: 2, budgets: [10, 100], sessionsPerBudget: 4, maxRoundsPerSession: 500,
    onProgress: (p) => progress.push(p),
  });
  assert.strictEqual(report.sessionsTotal, 8);
  assert.strictEqual(report.budgets.length, 2);
  assert.strictEqual(report.budgets[0].sessions, 4);
  assert.strictEqual(report.budgets[1].sessions, 4);
  assert.ok(report.totalRounds > 0);
  assert.strictEqual(report.benchmark.threads, 2);
  assert.ok(report.benchmark.durationMs >= 0 && report.benchmark.roundsPerSec > 0);
  assert.ok(progress.length >= 1);
  assert.strictEqual(progress[progress.length - 1].pct, 100);
  for (let i = 1; i < progress.length; i++) assert.ok(progress[i].sessionsDone >= progress[i - 1].sessionsDone);
  assert.ok(report.representativeSession && report.representativeSession.series.length >= 2);
});

test('otkazivanje posle prvog progresa → reject {cancelled:true}, bez izveštaja', async () => {
  const ac = new AbortController();
  let first = true;
  await assert.rejects(
    () => runSimulation({
      game: 'dice', strategy: MART, threads: 2, budgets: [10, 100, 1000], sessionsPerBudget: 300, maxRoundsPerSession: 200000,
      progressEvery: 1,
      onProgress: () => { if (first) { first = false; ac.abort(); } },
    }, ac.signal),
    (e) => e && e.cancelled === true,
  );
});

test('radnik koji umre od signala → simulacija se završava greškom (ne visi)', async () => {
  const { runSimulation: run } = await import('../main/simulator/runner.js');
  await assert.rejects(
    () => run({
      game: 'dice', strategy: MART, threads: 2, budgets: [10, 100, 1000], sessionsPerBudget: 400, maxRoundsPerSession: 200000,
      progressEvery: 1, _testKillFirstWorkerOnProgress: true,
    }),
    (e) => e && /radnik/.test(e.message),
  );
});

test('hibridna simulacija kroz radnike: handovers u reprezentativnoj sesiji, handoversAvg u izveštaju', async () => {
  const B = diceStrategy({ strategyName: 'B', baseBet: 0.5, targetValue: 75, condition: 'under' });
  const report = await runSimulation({
    game: 'dice', strategy: MART, threads: 2, budgets: [100], sessionsPerBudget: 6, maxRoundsPerSession: 500, seed: 'hy',
    hybridConfig: { base: MART, byName: { M: MART, B }, triggers: [{ when: 'lossStreak', value: 2, switchTo: 'B', actions: {} }] },
  });
  assert.ok(Array.isArray(report.representativeSession.handovers));
  assert.ok(report.overall.handoversAvg > 0, `handoversAvg ${report.overall.handoversAvg}`);
  assert.ok(report.overall.handoversAvg <= 1);
  assert.strictEqual(report.representativeSession.handovers[0]?.to, 'B');
});

test('workerMode threads (zaštitni režim) daje isti totalRounds kao procesi za isti seed; benchmark polja', async () => {
  const base = { game: 'dice', strategy: MART, threads: 2, budgets: [50], sessionsPerBudget: 6, maxRoundsPerSession: 300, seed: 'wm' };
  const p = await runSimulation({ ...base, workerMode: 'processes' });
  const t = await runSimulation({ ...base, workerMode: 'threads' });
  assert.strictEqual(p.totalRounds, t.totalRounds);
  assert.strictEqual(p.benchmark.workerMode, 'processes');
  assert.strictEqual(t.benchmark.workerMode, 'threads');
  assert.ok(p.benchmark.roundsPerSecPerWorker > 0);
  assert.ok(['Stabilno', 'Seckanje', 'n/a'].includes(p.benchmark.stability.label), JSON.stringify(p.benchmark.stability));
  // stabilnost = kašnjenje event-loop-a: pct ∈ [0,100] ili null (n/a) kad je posao kraći od 2 tajmer-otkucaja
  const one = await runSimulation({ ...base, threads: 1, progressEvery: 1000 });
  const st = one.benchmark.stability;
  assert.ok((st.pct === null && st.label === 'n/a' && st.intervals < 2) || (st.pct >= 0 && st.pct <= 100 && st.intervals >= 2), JSON.stringify(st));
});

test('rezultati su deterministički za isti seed posla', async () => {
  const opts = { game: 'dice', strategy: MART, threads: 2, budgets: [50], sessionsPerBudget: 6, maxRoundsPerSession: 300, seed: 'fiksni' };
  const a = await runSimulation(opts);
  const b = await runSimulation(opts);
  assert.strictEqual(a.totalRounds, b.totalRounds);
  assert.deepStrictEqual(a.budgets[0].tierPct, b.budgets[0].tierPct);
});
