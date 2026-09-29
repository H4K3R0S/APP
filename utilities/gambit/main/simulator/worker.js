// Radnik simulacije: vrti dodeljene sesije na punoj brzini (bez setTimeout), šalje progres i konačne rezultate.
// Radi u dva režima: kao zaseban PROCES (child_process.fork, podrazumevano — Electron-ov Node slabo skalira
// worker niti) ili kao worker nit (worker_threads) za poređenje.
import { parentPort, workerData as threadData, isMainThread } from 'node:worker_threads';
import { playSession } from './session.js';
import { createRng, hashSeed } from '../../shared/rng.js';
import { TIERS } from '../../shared/sim_constants.js';

const inProcess = isMainThread && typeof process.send === 'function';
if (inProcess) process.on('disconnect', () => process.exit(0)); // roditelj nestao (quit/crash) → ne ostaj siroče
const post = inProcess ? (m, cb) => process.send(m, cb) : (m, cb) => { parentPort.postMessage(m); if (cb) cb(); };
const config = inProcess
  ? await new Promise((resolve) => process.once('message', (m) => resolve(m.workerData)))
  : threadData;

const { game, strategy, tasks, maxRounds, progressEvery = 50, keepSeriesFor = null, hybridConfig = null } = config;

let hybrid = null;
if (hybridConfig) {
  const { createHybrid } = await import('./hybrid.js');
  hybrid = createHybrid(hybridConfig);
}

const counters = {};
function count(r) {
  const c = counters[r.budget] || (counters[r.budget] = { sessions: 0, tierHits: TIERS.map(() => 0), bankrupt: 0 });
  c.sessions += 1;
  r.tiers.forEach((hit, i) => { if (hit) c.tierHits[i] += 1; });
  if (r.outcome === 'bankrupt') c.bankrupt += 1;
}

const results = [];
let done = 0;
let rounds = 0;
for (const t of tasks) {
  const rng = createRng({ serverSeed: hashSeed(t.seed), clientSeed: 'sim', nonce: 0 });
  const keepSeries = !!keepSeriesFor && keepSeriesFor.budget === t.budget && keepSeriesFor.index === t.index;
  if (hybrid) hybrid.reset();
  const r = playSession({ game, strategy, budget: t.budget, rng, maxRounds, keepSeries, hybrid });
  r.index = t.index;
  results.push(r);
  count(r);
  done += 1;
  rounds += r.rounds;
  if (done % progressEvery === 0) post({ type: 'progress', done, rounds, counters });
}
post({ type: 'done', results, rounds, counters }, () => { if (inProcess) process.exit(0); });
