// Dice matematika (Stake model, house edge 1%): multiplier = 99 / chance.
// Deli je renderer (UI preview), Main (engine), worker-i i testovi.
export const HOUSE_EDGE = 0.01;
export const PAYOUT_BASE = 100 * (1 - HOUSE_EDGE); // 99
export const MIN_CHANCE = 2;
export const MAX_CHANCE = 98;
export const MIN_BET = 0.001;

const r2 = (x) => Math.round(x * 100) / 100;
const r4 = (x) => Math.round(x * 10000) / 10000;
const r8 = (x) => Math.round(x * 1e8) / 1e8;

// Ulog je validan ako je tačno 0 (bez opklade) ili ≥ MIN_BET; „prašinski" opseg (0, MIN_BET) se odbija.
export function validBet(x) {
  const b = Number(x);
  return Number.isFinite(b) && (b === 0 || b >= MIN_BET);
}

export function clampChance(c) {
  const n = Number(c);
  if (!Number.isFinite(n)) return MIN_CHANCE;
  return r2(Math.min(MAX_CHANCE, Math.max(MIN_CHANCE, n)));
}

export function multiplierFromChance(chance) {
  return r4(PAYOUT_BASE / clampChance(chance));
}

export function chanceFromMultiplier(multiplier) {
  const m = Number(multiplier);
  if (!Number.isFinite(m) || m <= 0) return MIN_CHANCE;
  return clampChance(PAYOUT_BASE / m);
}

// 'over': igrač pobeđuje ako je roll > target → target = 100 − chance; 'under': roll < target → target = chance.
export function targetFromChance(chance, condition) {
  const c = clampChance(chance);
  return r2(condition === 'under' ? c : 100 - c);
}

export function chanceFromTarget(target, condition) {
  const t = Number(target);
  return clampChance(condition === 'under' ? t : 100 - t);
}

export function profitOnWin(betAmount, chance) {
  const bet = Number(betAmount) || 0;
  return r8(bet * multiplierFromChance(chance) - bet);
}
