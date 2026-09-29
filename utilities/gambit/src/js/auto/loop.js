// Generička asinhrona auto-petlja (renderer): igre daju samo playRound(bet) → {isWin, profit} | null.
// Pravila uloga i stop uslovi su u shared/bet_rules.js. stop() prekida ODMAH posle tekućeg kruga:
// proverava se na vrhu petlje, posle kruga i prekida kašnjenje (nema „još jednog“ kruga).
import { nextBet, shouldStop } from '../../../shared/bet_rules.js';
import { nextBetFromConditions } from '../../../shared/conditions.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

export function createAutoLoop({ playRound, getBalance, onRound, onStop }) {
  let running = false;
  let stopRequested = false;
  let wake = null;
  let current = null;

  const sleep = (ms) => new Promise((resolve) => {
    const t = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(t); wake = null; resolve(); };
  });

  async function run({ baseBet, rules, conditions = null, maxBets = 0, stopConditions = {}, delayMs = 40, gameState = null }) {
    const useConds = Array.isArray(conditions) && conditions.length > 0;
    // gameState: opciono stanje specifično za igru koje uslovi mogu menjati (Dice: {chance, condition, baseChance}).
    const gs = gameState ? { ...gameState } : null;
    let currentBet = r8(baseBet);
    let betsPlayed = 0;
    let sessionProfit = 0;
    let wins = 0;
    let losses = 0;
    let winStreak = 0;
    let lossStreak = 0;
    let reason = 'stopped';
    while (running) {
      if (stopRequested) { reason = 'stopped'; break; }
      const pre = shouldStop({ betsPlayed, maxBets, sessionProfit, stopConditions, balance: getBalance(), nextBet: currentBet });
      if (pre.stop) { reason = pre.reason; break; }
      const res = await playRound(currentBet);
      if (!res) { reason = 'error'; break; }
      betsPlayed += 1;
      sessionProfit = r8(sessionProfit + res.profit);
      if (res.isWin) { wins += 1; winStreak += 1; lossStreak = 0; } else { losses += 1; lossStreak += 1; winStreak = 0; }
      let condStop = false;
      if (useConds) {
        const c = nextBetFromConditions(conditions, { currentBet, baseBet, isWin: res.isWin, winStreak, lossStreak, wins, losses, betsPlayed, sessionProfit, ...(gs || {}) });
        currentBet = c.bet;
        condStop = c.stop;
        if (gs) { if (c.chance !== undefined) gs.chance = c.chance; if (c.condition !== undefined) gs.condition = c.condition; }
      } else {
        currentBet = nextBet(currentBet, baseBet, res.isWin, rules);
      }
      if (onRound) onRound(res, currentBet, betsPlayed, sessionProfit, gs);
      if (condStop) { reason = 'conditionStop'; break; }
      if (stopRequested) { reason = 'stopped'; break; }
      const post = shouldStop({ betsPlayed, maxBets, sessionProfit, stopConditions: useConds ? {} : stopConditions, balance: getBalance(), nextBet: currentBet });
      if (post.stop) { reason = post.reason; break; }
      if (delayMs > 0) await sleep(delayMs);
    }
    running = false;
    stopRequested = false;
    current = null;
    const summary = { reason, betsPlayed, sessionProfit };
    if (onStop) onStop(summary);
    return summary;
  }

  return {
    // Vraća Promise koji se razrešava kad petlja stane (sa {reason, betsPlayed, sessionProfit}).
    start(config) {
      if (running) return Promise.resolve({ reason: 'alreadyRunning', betsPlayed: 0, sessionProfit: 0 });
      running = true;
      stopRequested = false;
      current = run(config);
      return current;
    },
    stop() {
      if (!running) return;
      stopRequested = true;
      if (wake) wake();
    },
    // stop() + čekanje da petlja stvarno stane; null ako nije radila.
    stopAndWait() {
      if (!running) return Promise.resolve(null);
      const p = current;
      this.stop();
      return p;
    },
    isRunning: () => running,
  };
}
