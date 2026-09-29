// Jedna Monte Carlo sesija (čisto, bez Electrona): igra se do bankrota, 1000× cilja ili gornje granice krugova.
// Engine po igri daje playRound(strategy, rng, bet) → {isWin, profit}. Pravila uloga: shared/bet_rules.js.
import { resolveRoll } from '../../shared/dice_engine.js';
import { nextBet } from '../../shared/bet_rules.js';
import { TIERS, MAX_ROUNDS_PER_SESSION, TARGET_MULTIPLE, SERIES_MAX_POINTS } from '../../shared/sim_constants.js';
import { minesEngine } from './engines/mines.js';
import { kenoEngine } from './engines/keno.js';
import { executeStateHandover } from './hybrid.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

// Engine interfejs: init(strategy) → stanje sesije (ili null); playRound(strategy, rng, bet, st) → {isWin, profit}.
// Simulacija troši kontinuirani HMAC-SHA256 tok (rng.next()/rng.int(): 8 ishoda po digestu) umesto roll()
// (1 ishod po digestu): isti kvalitet, ~7× manje heševanja. Sesija otvara jedan krug (nonce) na početku.
const ENGINES = {
  dice: {
    init: () => null,
    playRound(strategy, rng, bet) {
      const value = rng.next();
      return resolveRoll({ betAmount: bet, targetValue: strategy.targetValue, condition: strategy.condition }, value);
    },
  },
  mines: minesEngine,
  keno: kenoEngine,
};

export function registerEngine(game, engine) {
  ENGINES[game] = engine;
}

// Decimirana serija profita: kad pređe SERIES_MAX_POINTS, proredi na pola i dupliraj korak.
function makeSeries() {
  const s = { points: [{ x: 0, y: 0 }], stride: 1 };
  s.push = (x, y) => {
    if (x % s.stride !== 0) return;
    s.points.push({ x, y });
    if (s.points.length > SERIES_MAX_POINTS) {
      s.points = s.points.filter((_, i) => i % 2 === 0);
      s.stride *= 2;
    }
  };
  s.finish = (x, y) => { const last = s.points[s.points.length - 1]; if (last.x !== x) s.points.push({ x, y }); return s.points; };
  return s;
}

export function playSession({ game, strategy, budget, rng, maxRounds = MAX_ROUNDS_PER_SESSION, keepSeries = false, hybrid = null }) {
  const engine = ENGINES[game];
  if (!engine) throw new Error(`Nepoznata igra za simulaciju: ${game}`);
  rng.beginRound();
  const target = budget * TARGET_MULTIPLE;
  let active = strategy;
  let balance = Number(budget);
  let bet = r8(Number(active.baseBet));
  // Zaštita: nefinitan/nepozitivan ulog ili budžet → bankrot u krugu 0 (inače bi NaN prošao sve poređenja do cap-a).
  if (!Number.isFinite(bet) || bet <= 0 || !Number.isFinite(balance) || balance <= 0) {
    return { budget, outcome: 'bankrupt', rounds: 0, maxMultiple: 1, maxLossStreak: 0, finalBalance: Number.isFinite(balance) ? balance : 0, tiers: TIERS.map(() => false), series: keepSeries ? [{ x: 0, y: 0 }] : undefined, handovers: [] };
  }
  let rounds = 0;
  let lossStreak = 0;
  let maxLossStreak = 0;
  let maxMultiple = 1;
  let outcome = 'cap';
  const series = keepSeries ? makeSeries() : null;
  const handovers = [];
  let st = engine.init ? engine.init(active) : null;

  while (rounds < maxRounds) {
    if (balance <= 0 || bet > balance) { outcome = 'bankrupt'; break; }
    const res = engine.playRound(active, rng, bet, st);
    rounds += 1;
    balance = r8(balance + res.profit);
    if (res.isWin) lossStreak = 0;
    else { lossStreak += 1; if (lossStreak > maxLossStreak) maxLossStreak = lossStreak; }
    const mult = balance / budget;
    if (mult > maxMultiple) maxMultiple = mult;
    if (series) series.push(rounds, r8(balance - budget));
    if (balance >= target) { outcome = 'target'; break; }
    // Hibridni okidači (korak 24): hybrid.check(ctx) → nova strategija ili null; balans i ulog ostaju, niz gubitaka se resetuje.
    // Na krugu prelaska se NE primenjuje pravilo uloga: nasleđeni (npr. Martingale uvećani) ulog ulazi u sledeći krug netaknut,
    // a bankrot važi po postojećem pravilu (bet > balance) — bez tihog reseta na bazu nove strategije.
    let handedOver = false;
    if (hybrid) {
      const next = hybrid.check({ round: rounds, lossStreak, balance, budget, active, bet });
      if (next) {
        const why = hybrid.last?.trigger;
        handovers.push({ round: rounds, from: active.strategyName, to: next.strategyName, balance, bet, nextBet: bet, lossStreak, when: why?.when, value: why?.value });
        ({ active, lossStreak } = executeStateHandover({ active, lossStreak }, next));
        const actions = hybrid.last?.actions || {};
        if (engine.onHandover) st = engine.onHandover(st, active, rng, actions);
        else if (engine.init) st = engine.init(active);
        handedOver = true;
      }
    }
    if (!handedOver) bet = nextBet(bet, active.baseBet, res.isWin, active);
  }

  return {
    budget,
    outcome,
    rounds,
    maxMultiple: r8(maxMultiple),
    maxLossStreak,
    finalBalance: balance,
    tiers: TIERS.map((t) => maxMultiple >= t),
    series: series ? series.finish(rounds, r8(balance - budget)) : undefined,
    handovers,
  };
}
