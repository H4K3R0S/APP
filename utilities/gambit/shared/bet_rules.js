// Pravila uloga za auto igru (čisto): sledeći ulog i uslovi zaustavljanja. Dele ih renderer petlja i simulator.
const r8 = (x) => Math.round(x * 1e8) / 1e8;

// rules = { onLoss: {action:'reset'|'increase', value:%}, onWin: {...} }
export function nextBet(currentBet, baseBet, isWin, rules = {}) {
  const rule = isWin ? rules.onWin : rules.onLoss;
  if (rule && rule.action === 'increase') {
    const pct = Number(rule.value) || 0;
    return r8(Number(currentBet) * (1 + pct / 100));
  }
  return r8(Number(baseBet));
}

// maxBets 0 = beskonačno; takeProfit/stopLoss 0 = isključeno; bankrot = sledeći ulog > balans (pre igranja).
export function shouldStop({ betsPlayed, maxBets, sessionProfit, stopConditions = {}, balance, nextBet }) {
  const max = Number(maxBets) || 0;
  if (max > 0 && betsPlayed >= max) return { stop: true, reason: 'maxBets' };
  const tp = Number(stopConditions.takeProfit) || 0;
  if (tp > 0 && sessionProfit >= tp) return { stop: true, reason: 'takeProfit' };
  const sl = Number(stopConditions.stopLoss) || 0;
  if (sl > 0 && sessionProfit <= -sl) return { stop: true, reason: 'stopLoss' };
  if (Number(nextBet) > Number(balance)) return { stop: true, reason: 'bankrupt' };
  return { stop: false, reason: null };
}

export const STOP_REASON_TEXT = {
  maxBets: 'Dostignut broj krugova',
  takeProfit: 'Take Profit dostignut',
  stopLoss: 'Stop Loss dostignut',
  bankrupt: 'Bankrot — sledeći ulog je veći od balansa',
  stopped: 'Auto igra zaustavljena',
  conditionStop: 'Uslov strategije je zaustavio auto igru',
  error: 'Greška u krugu — auto igra prekinuta',
};
