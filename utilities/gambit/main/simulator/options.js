// Normalizacija i validacija ulaza simulatora (IPC iz renderera je nepouzdan: NaN, ogromni brojevi, loši budžeti).
import { validateStrategy, GAMES } from '../../shared/strategy_schema.js';
import { BUDGETS, SESSIONS_PER_BUDGET, MAX_ROUNDS_PER_SESSION } from '../../shared/sim_constants.js';

export const MAX_SESSIONS_PER_BUDGET = 100000;
export const MAX_ROUNDS_CAP = 2000000;

export function normalizeSimOptions(opts = {}, { maxThreads = 1 } = {}) {
  const game = opts.game;
  if (!GAMES.includes(game)) return { ok: false, error: `Nepoznata igra: ${game}` };
  const strategy = opts.strategy;
  if (!strategy || typeof strategy !== 'object') return { ok: false, error: 'Strategija nedostaje' };
  const v = validateStrategy({ ...strategy, game });
  if (!v.ok) return { ok: false, error: `Nevalidna strategija: ${v.errors.join('; ')}` };

  const rawBudgets = Array.isArray(opts.budgets) && opts.budgets.length ? opts.budgets : BUDGETS;
  const budgets = [...new Set(rawBudgets.map(Number).filter((b) => Number.isFinite(b) && b > 0))].sort((a, b) => a - b);
  if (!budgets.length) return { ok: false, error: 'Nijedan validan budžet' };

  const spb = Math.floor(Number(opts.sessionsPerBudget));
  const sessionsPerBudget = Number.isFinite(spb) && spb > 0 ? Math.min(spb, MAX_SESSIONS_PER_BUDGET) : SESSIONS_PER_BUDGET;
  const mr = Math.floor(Number(opts.maxRoundsPerSession));
  const maxRoundsPerSession = Number.isFinite(mr) && mr > 0 ? Math.min(mr, MAX_ROUNDS_CAP) : MAX_ROUNDS_PER_SESSION;
  const t = Math.floor(Number(opts.threads));
  const threads = Number.isFinite(t) && t > 0 ? Math.min(t, maxThreads) : maxThreads;

  return { ok: true, game, strategy: { ...strategy, game }, budgets, sessionsPerBudget, maxRoundsPerSession, threads };
}
