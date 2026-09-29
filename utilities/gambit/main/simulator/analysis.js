// Agregacija rezultata sesija u izveštaj (spec §3.6) + AI preporuka sigurnosnog balansa.
import { TIERS } from '../../shared/sim_constants.js';

const r2 = (x) => Math.round(x * 100) / 100;
const r8 = (x) => Math.round(x * 1e8) / 1e8;
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

// Kapital potreban da se preživi L uzastopnih gubitaka od uloga baseBet: increase p% → Σ_{i=0..L} b·(1+p/100)^i; reset → b·(L+1).
export function recommendedBalance(maxLossStreak, onLoss, baseBet = 1) {
  const L = Math.max(0, Math.floor(Number(maxLossStreak) || 0));
  const inc = onLoss && onLoss.action === 'increase' ? (Number(onLoss.value) || 0) / 100 : null;
  let total = 0;
  let bet = baseBet;
  for (let i = 0; i <= L; i++) {
    total += bet;
    bet = inc == null ? baseBet : bet * (1 + inc);
  }
  return r8(total);
}

function budgetStats(budget, rs) {
  const n = rs.length;
  const tierPct = TIERS.map((_, i) => (n ? r2((rs.filter((r) => r.tiers[i]).length / n) * 100) : 0));
  return {
    budget,
    sessions: n,
    tierPct,
    bankruptPct: n ? r2((rs.filter((r) => r.outcome === 'bankrupt').length / n) * 100) : 0,
    targetPct: n ? r2((rs.filter((r) => r.outcome === 'target').length / n) * 100) : 0,
    avgRounds: r2(mean(rs.map((r) => r.rounds))),
    maxLossStreak: rs.reduce((m, r) => Math.max(m, r.maxLossStreak), 0),
  };
}

export function aggregate({ game, strategy, results, budgets, benchmark = {}, sessionsTotal, baseStrategy }) {
  const perBudget = budgets.map((b) => budgetStats(b, results.filter((r) => r.budget === b)));
  const totalRounds = results.reduce((a, r) => a + r.rounds, 0);
  const maxLossStreak = perBudget.reduce((m, b) => Math.max(m, b.maxLossStreak), 0);
  const rep = results.find((r) => r.series && r.budget === 100) || results.find((r) => r.series) || null;
  const durationMs = Number(benchmark.durationMs) || 0;
  return {
    game,
    strategyName: strategy.strategyName,
    type: strategy.type || 'solo',
    baseStrategy: baseStrategy || strategy.strategyName,
    finishedAt: new Date().toISOString(),
    sessionsTotal: sessionsTotal ?? results.length,
    totalRounds,
    budgets: perBudget,
    overall: {
      maxLossStreak,
      tier3Avg: r2(mean(perBudget.map((b) => b.tierPct[2]))),
      tier5Avg: r2(mean(perBudget.map((b) => b.tierPct[4]))),
      bankruptAvg: r2(mean(perBudget.map((b) => b.bankruptPct))),
      tierAvg: TIERS.map((_, i) => r2(mean(perBudget.map((b) => b.tierPct[i])))),
      recommendedBalance: recommendedBalance(maxLossStreak, strategy.onLoss, 1),
      baseBet: Number(strategy.baseBet) || 0,
      handoversAvg: r2(mean(results.map((r) => (r.handovers ? r.handovers.length : 0)))),
    },
    benchmark: {
      ...benchmark,
      durationMs,
      roundsTotal: totalRounds,
      roundsPerSec: durationMs > 0 ? Math.round(totalRounds / (durationMs / 1000)) : 0,
      roundsPerSecPerWorker: durationMs > 0 ? Math.round(totalRounds / (durationMs / 1000) / Math.max(1, Number(benchmark.threads) || 1)) : 0,
      stability: benchmark.stability || { pct: null, label: 'n/a', gaps: 0, intervals: 0 },
    },
    representativeSession: rep ? { budget: rep.budget, outcome: rep.outcome, rounds: rep.rounds, series: rep.series, handovers: rep.handovers || [] } : null,
  };
}

// Delimični presek tokom rada (za live tier barove): budgetStats iz worker-progres brojača.
export function partialFromCounters(counters, budgets) {
  const out = budgets.map((b) => {
    const c = counters[b] || { sessions: 0, tierHits: TIERS.map(() => 0), bankrupt: 0 };
    const n = c.sessions;
    return { budget: b, done: n, tierPct: c.tierHits.map((h) => (n ? r2((h / n) * 100) : 0)), bankruptPct: n ? r2((c.bankrupt / n) * 100) : 0 };
  });
  const tiers = TIERS.map((_, i) => r2(mean(out.filter((b) => b.done > 0).map((b) => b.tierPct[i]))));
  return { budgets: out, tiers };
}
