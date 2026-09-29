// Statistika sesije (čista, imutabilna): balans, brojači, nizovi promašaja, istorija (10), milestone-i.
export const MILESTONES = [50, 100, 200, 500];
export const HISTORY_LEN = 10;

const r2 = (x) => Math.round(x * 100) / 100;
const r8 = (x) => Math.round(x * 1e8) / 1e8;

export function createStats(initialBalance = 1000) {
  return {
    initialBalance,
    balance: initialBalance,
    bets: 0,
    wins: 0,
    losses: 0,
    lossStreak: 0,
    maxLossStreak: 0,
    cumulativeProfit: 0,
    maxWin: 0, // najveći pojedinačni dobitak (profit) u sesiji
    history: [],
    milestones: Object.fromEntries(MILESTONES.map((m) => [m, null])),
  };
}

export function profitPct(s) {
  return s.initialBalance ? r2((s.cumulativeProfit / s.initialBalance) * 100) : 0;
}

export function winRate(s) {
  return s.bets ? r2((s.wins / s.bets) * 100) : 0;
}

export function applyResult(s, { isWin, profit }) {
  const p = r8(Number(profit) || 0);
  const n = {
    ...s,
    bets: s.bets + 1,
    wins: s.wins + (isWin ? 1 : 0),
    losses: s.losses + (isWin ? 0 : 1),
    lossStreak: isWin ? 0 : s.lossStreak + 1,
    balance: r8(s.balance + p),
    cumulativeProfit: r8(s.cumulativeProfit + p),
    history: [...s.history, isWin ? 'W' : 'L'].slice(-HISTORY_LEN),
    milestones: { ...s.milestones },
  };
  n.maxLossStreak = Math.max(s.maxLossStreak, n.lossStreak);
  n.maxWin = Math.max(s.maxWin || 0, p > 0 ? p : 0);
  const pct = profitPct(n);
  for (const m of MILESTONES) {
    if (n.milestones[m] == null && pct >= m) n.milestones[m] = n.bets;
  }
  return n;
}

export function milestonesHit(s) {
  return { ...s.milestones };
}

// Korisnik ručno postavlja balans za igru → to je novi početni balans, brojači/istorija/milestone-i se brišu.
// Nevalidan iznos (≤ 0 ili nije broj) vraća isto stanje netaknuto.
export function setBalance(s, amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return s;
  return createStats(r8(n));
}

// Trenutni balans postaje novi početni; brojači, istorija i milestone-i se brišu.
export function resetStats(s) {
  // balans 0 → zadrži prethodni početni (inače profitPct/milestone-i zauvek 0)
  return createStats(s.balance > 0 ? s.balance : s.initialBalance);
}
