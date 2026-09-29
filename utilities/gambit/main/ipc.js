// Registracija svih IPC kanala Main procesa. Handleri su tanki omotači nad modulima.
import os from 'node:os';
import { createSeedStore } from './seeds.js';
import { resolveRoll, validateBet } from '../shared/dice_engine.js';
import { validateStrategy, GAMES } from '../shared/strategy_schema.js';
import { createMinesSession } from './mines_session.js';
import { draw as kenoDraw, resolvePlay as kenoResolve, validatePlay as kenoValidate } from '../shared/keno_engine.js';
import * as storage from './storage.js';
import { runSimulation } from './simulator/runner.js';
import { normalizeSimOptions } from './simulator/options.js';
import { resolveHybrid } from './simulator/hybrid_resolve.js';
import { appendBenchmark, readBenchmarks } from './benchmark_log.js';

const WORKER_MODES = ['processes', 'threads'];

export const MAX_THREADS_ALLOWED = 14;
export const maxThreads = () => Math.min(MAX_THREADS_ALLOWED, Math.max(1, os.cpus().length - 2));

const guard = (fn) => async (...args) => {
  try { return await fn(...args); } catch (e) { return { error: e.message }; }
};

export function registerIpc(ipcMain, ctx) {
  ctx.seeds = ctx.seeds || createSeedStore();

  // --- Kontrole prozora (frameless window-chrome): ─ ▢ ✕ ---
  ipcMain.handle('win:minimize', () => { const w = ctx.getWindow(); if (w) w.minimize(); });
  ipcMain.handle('win:maxToggle', () => {
    const w = ctx.getWindow();
    if (!w) return;
    if (w.isMaximized()) w.unmaximize(); else w.maximize();
  });
  ipcMain.handle('win:close', () => { const w = ctx.getWindow(); if (w) w.close(); });

  // --- Mines: runda sa skrivenom tablom ---
  const mines = createMinesSession(ctx.seeds);
  ctx.mines = mines;
  ipcMain.handle('mines:start', guard((_e, args) => mines.start(args || {})));
  ipcMain.handle('mines:reveal', guard((_e, index) => mines.reveal(index)));
  ipcMain.handle('mines:cashout', guard(() => mines.cashout()));
  ipcMain.handle('mines:abort', guard(() => mines.abort()));
  ipcMain.handle('mines:state', guard(() => mines.state()));

  // --- Keno: jedan tiket (izvlačenje 10 od 40) ---
  ipcMain.handle('keno:play', guard((_e, args) => {
    const a = args || {};
    const v = kenoValidate(a);
    if (!v.ok) return { error: v.error };
    const rng = ctx.seeds.get('keno');
    rng.beginRound();
    const drawn = kenoDraw(rng);
    return { ...kenoResolve(a, drawn), nonce: rng.nonce, serverSeedHash: ctx.seeds.serverSeedHash };
  }));

  // --- Strategije (data/<game>/) ---
  ipcMain.handle('strategy:list', guard((_e, game) => storage.listStrategies(ctx.dataDir, game)));
  ipcMain.handle('strategy:list-all', guard(() => storage.listAllStrategies(ctx.dataDir)));
  ipcMain.handle('strategy:save', guard((_e, game, obj) => {
    const v = validateStrategy({ ...obj, game });
    if (!v.ok) return { error: v.errors.join('; ') };
    return storage.saveStrategy(ctx.dataDir, game, obj);
  }));
  ipcMain.handle('strategy:load', guard((_e, game, name) => storage.loadStrategy(ctx.dataDir, game, name)));
  ipcMain.handle('strategy:delete', guard((_e, game, name) => storage.deleteStrategy(ctx.dataDir, game, name)));
  ipcMain.handle('analysis:load', guard((_e, game, name) => storage.loadAnalysis(ctx.dataDir, game, name)));

  // --- Simulator (worker pool): run → {jobId}; push simulator:progress / simulator:done ---
  ctx.jobs = new Map();
  let jobSeq = 0;
  const send = (ch, payload) => { const w = ctx.getWindow(); if (w && !w.isDestroyed()) w.webContents.send(ch, payload); };

  ipcMain.handle('simulator:run', guard(async (_e, opts = {}) => {
    const { game, strategyName, hybridConfig } = opts;
    if (ctx.jobs.size > 0) return { error: 'Simulacija već radi — sačekaj ili prekini tekuću' };
    if (!GAMES.includes(game)) return { error: `Nepoznata igra: ${game}` };
    // Hibrid (Multi-Strategy): Main učitava i validira sve strategije; radnici dobijaju rešene objekte.
    let resolvedHybrid = null;
    let loaded = null;
    if (hybridConfig) {
      const r = await resolveHybrid(ctx.dataDir, game, hybridConfig);
      if (!r.ok) return { error: r.error };
      resolvedHybrid = r.hybrid;
      // validira se kao solo (bazna pravila); type:'multi' se dodaje posle normalizacije radi izveštaja
      loaded = { ...r.hybrid.base, strategyName: r.config.strategyName || `Hibrid_${r.hybrid.base.strategyName}` };
    } else {
      loaded = await storage.loadStrategy(ctx.dataDir, game, strategyName);
    }
    if (!loaded) return { error: `Strategija „${strategyName}“ nije nađena` };
    const n = normalizeSimOptions({ ...opts, strategy: loaded }, { maxThreads: maxThreads() });
    if (!n.ok) return { error: n.error };
    const strategy = resolvedHybrid ? { ...n.strategy, type: 'multi' } : n.strategy;
    const t = n.threads;
    const jobId = `job-${++jobSeq}`;
    const ac = new AbortController();
    ctx.jobs.set(jobId, ac);
    if (ctx.sysmon) ctx.sysmon.setFast(true);
    const workerMode = WORKER_MODES.includes(opts.workerMode) ? opts.workerMode : 'processes';
    runSimulation({
      game, strategy, threads: t, hybridConfig: resolvedHybrid, workerMode,
      budgets: n.budgets, sessionsPerBudget: n.sessionsPerBudget, maxRoundsPerSession: n.maxRoundsPerSession,
      onProgress: (p) => send('simulator:progress', { jobId, ...p }),
    }, ac.signal)
      .then(async (report) => {
        const { file } = await storage.saveAnalysis(ctx.dataDir, game, strategy.strategyName, report);
        await appendBenchmark(ctx.dataDir, {
          ts: report.finishedAt, game, strategy: strategy.strategyName, type: strategy.type || 'solo',
          threads: report.benchmark.threads, workerMode: report.benchmark.workerMode, durationMs: report.benchmark.durationMs,
          rounds: report.totalRounds, sessions: report.sessionsTotal, roundsPerSec: report.benchmark.roundsPerSec,
          stability: report.benchmark.stability?.label || 'n/a', cpuThreads: os.cpus().length,
        }).catch(() => {});
        send('simulator:done', { jobId, analysisFile: file, report });
      })
      .catch((e) => send('simulator:done', e && e.cancelled ? { jobId, cancelled: true } : { jobId, error: e?.message || String(e) }))
      .finally(() => { ctx.jobs.delete(jobId); if (ctx.sysmon) ctx.sysmon.setFast(false); });
    return { jobId, threads: t };
  }));

  ipcMain.handle('simulator:cancel', (_e, jobId) => {
    const ac = ctx.jobs.get(jobId);
    if (!ac) return false;
    ac.abort();
    return true;
  });

  // --- Dice: jedan krug ---
  ipcMain.handle('dice:roll', (_e, bet) => {
    const v = validateBet(bet || {});
    if (!v.ok) return { error: v.error };
    const { value, nonce } = ctx.seeds.get('dice').roll();
    return { ...resolveRoll(bet, value), nonce, serverSeedHash: ctx.seeds.serverSeedHash };
  });

  ipcMain.handle('sys:ping', () => {
    const res = { pong: true, ts: Date.now(), smoke: ctx.smoke.active, screen: ctx.smoke.screen || null };
    ctx.smoke.report('ping', res);
    return res;
  });

  ipcMain.on('sys:smoke-report', (_e, report) => ctx.smoke.report('report', report));

  ipcMain.handle('sys:hardware', () => ({ threads: os.cpus().length, maxAllowed: maxThreads(), recommended: maxThreads(), reserved: os.cpus().length - maxThreads() }));
  ipcMain.handle('benchmark:history', guard((_e, limit) => readBenchmarks(ctx.dataDir, Math.min(100, Math.max(1, Math.floor(Number(limit)) || 20)))));

  ipcMain.handle('sys:monfast', (_e, fast) => {
    if (ctx.sysmon) ctx.sysmon.setFast(!!fast);
    return true;
  });
}
