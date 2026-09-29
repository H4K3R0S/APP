// Worker pool: deli sesije (budžet × index) round-robin na N radnika, prati progres, agregira izveštaj, podržava otkazivanje.
import { Worker } from 'node:worker_threads';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { randomSeedHex } from '../../shared/rng.js';
import { BUDGETS, SESSIONS_PER_BUDGET, MAX_ROUNDS_PER_SESSION, TIERS } from '../../shared/sim_constants.js';
import { aggregate, partialFromCounters } from './analysis.js';

const r2 = (x) => Math.round(x * 100) / 100;
export const PROGRESS_MIN_MS = 150;

// Radnik = zaseban proces (podrazumevano) ili worker nit. Mereno 2026-09-27: Electron-ov Node u 14 worker niti
// daje ~0.4–0.96M krugova/s, a zasebni procesi ~2.9M/s (sistemski Node niti: 3.1M/s). Procesi koriste isti
// Electron binarni fajl sa ELECTRON_RUN_AS_NODE=1 (pod čistim Node-om execPath je node).
export const DEFAULT_WORKER_MODE = 'processes';
const WORKER_URL = new URL('./worker.js', import.meta.url);

function startWorker(workerData, handlers, mode) {
  if (mode === 'threads') {
    const w = new Worker(WORKER_URL, { workerData });
    w.on('message', handlers.message);
    w.on('error', handlers.error);
    w.on('exit', (code) => handlers.exit(code, null));
    return { terminate: () => w.terminate(), kill: () => w.terminate() };
  }
  const child = fork(fileURLToPath(WORKER_URL), [], {
    execPath: process.execPath,
    execArgv: [], // ne nasleđuj --inspect/--input-type i sl. iz roditelja
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    serialization: 'advanced',
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  child.on('message', handlers.message);
  child.on('error', handlers.error);
  // 'close' (ne 'exit'): IPC kanal je ispražnjen, pa je 'done' poruka sigurno već obrađena — bez lažnog „pad radnika“
  child.on('close', (code, signal) => handlers.exit(code, signal));
  child.send({ type: 'init', workerData });
  const kill = () => { try { child.kill('SIGKILL'); } catch { /* već ugašen */ } };
  return { terminate: kill, kill };
}

function mergeCounters(perWorker, budgets) {
  const merged = {};
  for (const b of budgets) merged[b] = { sessions: 0, tierHits: TIERS.map(() => 0), bankrupt: 0 };
  for (const w of perWorker) {
    for (const [b, c] of Object.entries(w.counters || {})) {
      const m = merged[b];
      if (!m) continue;
      m.sessions += c.sessions;
      m.bankrupt += c.bankrupt;
      c.tierHits.forEach((h, i) => { m.tierHits[i] += h; });
    }
  }
  return merged;
}

export function runSimulation({
  game, strategy, threads = 1, budgets = BUDGETS, sessionsPerBudget = SESSIONS_PER_BUDGET,
  maxRoundsPerSession = MAX_ROUNDS_PER_SESSION, progressEvery = 50, onProgress, seed, hybridConfig = null,
  workerMode = DEFAULT_WORKER_MODE, _testKillFirstWorkerOnProgress = false,
}, signal) {
  return new Promise((resolve, reject) => {
    const jobSeed = seed || randomSeedHex(16);
    const tasks = [];
    for (const b of budgets) for (let i = 0; i < sessionsPerBudget; i++) tasks.push({ budget: b, index: i, seed: `${jobSeed}:${b}:${i}` });
    const n = Math.max(1, Math.min(Number(threads) || 1, tasks.length));
    const buckets = Array.from({ length: n }, () => []);
    tasks.forEach((t, i) => buckets[i % n].push(t));
    const keepSeriesFor = { budget: budgets.includes(100) ? 100 : budgets[0], index: 0 };

    const start = performance.now();
    const workers = [];
    const perWorker = buckets.map(() => ({ done: 0, rounds: 0, counters: {}, finished: false }));
    const results = [];
    let finished = 0;
    let settled = false;

    const cleanup = () => { clearInterval(lagTimer); for (const w of workers) w.kill(); };
    const fail = (err) => { if (settled) return; settled = true; cleanup(); reject(err); };

    // Stabilnost: kašnjenje event-loop-a Main procesa tokom rada (tajmer na 50 ms; kašnjenje > 100 ms = „propušten frejm“).
    // Meri da li glavni proces (i UI koji zavisi od njega) ostaje odzivan dok radnici melju.
    const TICK_MS = 50;
    const LAG_LIMIT_MS = 100;
    let ticks = 0;
    let dropped = 0;
    let lastTick = performance.now();
    const lagTimer = setInterval(() => {
      const now = performance.now();
      const lag = now - lastTick - TICK_MS;
      lastTick = now;
      ticks += 1;
      if (lag > LAG_LIMIT_MS) dropped += 1;
    }, TICK_MS);
    const stability = () => {
      clearInterval(lagTimer);
      if (ticks < 2) return { pct: null, label: 'n/a', gaps: 0, intervals: ticks };
      const pct = r2(100 * (1 - dropped / ticks));
      return { pct, label: pct >= 95 ? 'Stabilno' : 'Seckanje', gaps: dropped, intervals: ticks, tickMs: TICK_MS };
    };

    let lastEmit = 0;
    const emit = (force = false) => {
      if (!onProgress) return;
      const now = performance.now();
      if (!force && now - lastEmit < PROGRESS_MIN_MS) return;
      lastEmit = now;
      const done = perWorker.reduce((a, w) => a + w.done, 0);
      const rounds = perWorker.reduce((a, w) => a + w.rounds, 0);
      const elapsed = (now - start) / 1000;
      const partial = partialFromCounters(mergeCounters(perWorker, budgets), budgets);
      onProgress({
        pct: r2((done / tasks.length) * 100),
        sessionsDone: done,
        sessionsTotal: tasks.length,
        rounds,
        elapsedSec: r2(elapsed),
        etaSec: done ? Math.round((elapsed * (tasks.length - done)) / done) : null,
        tiers: partial.tiers,
        budgets: partial.budgets,
      });
    };

    if (signal) {
      if (signal.aborted) return fail({ cancelled: true, message: 'otkazano' });
      signal.addEventListener('abort', () => fail({ cancelled: true, message: 'otkazano' }), { once: true });
    }

    buckets.forEach((bucket, wi) => {
      const workerData = { game, strategy, tasks: bucket, maxRounds: maxRoundsPerSession, progressEvery, keepSeriesFor, hybridConfig };
      const w = startWorker(workerData, {
        message: (m) => {
          if (settled) return;
          if (m.type === 'progress') {
            perWorker[wi] = { ...perWorker[wi], done: m.done, rounds: m.rounds, counters: m.counters };
            if (_testKillFirstWorkerOnProgress && wi === 0) { workers[0].kill(); return; } // test: simulira pad radnika
            emit();
          } else if (m.type === 'done') {
            perWorker[wi] = { done: bucket.length, rounds: m.rounds, counters: m.counters, finished: true };
            for (const r of m.results) results.push(r); // bez spread-a (RangeError na >100k rezultata)
            finished += 1;
            if (finished === buckets.length) {
              settled = true;
              const durationMs = r2(performance.now() - start);
              emit(true);
              cleanup();
              resolve(aggregate({
                game, strategy, results, budgets, sessionsTotal: tasks.length,
                baseStrategy: hybridConfig?.base?.strategyName || strategy.strategyName,
                benchmark: { durationMs, threads: n, workerMode, seed: jobSeed, stability: stability() },
              }));
            }
          }
        },
        error: (e) => fail(e),
        // Izlaz bez 'done' poruke (signal, OOM, pad) = greška; posle settled je to naš cleanup.
        exit: (code, sig) => {
          if (settled || perWorker[wi].finished) return;
          fail(new Error(`radnik ${wi} izašao pre kraja (code=${code} signal=${sig || '-'})`));
        },
      }, workerMode);
      workers.push(w);
    });
  });
}
