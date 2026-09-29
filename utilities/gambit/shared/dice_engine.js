// Dice engine: ishod jednog kruga iz roll vrednosti (čisto) + validacija uloga. Deli ga Main, worker i testovi.
import { chanceFromTarget, multiplierFromChance, MIN_BET, MIN_CHANCE, MAX_CHANCE, validBet } from './dice_math.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

export function resolveRoll({ betAmount, targetValue, condition }, roll) {
  const bet = Number(betAmount);
  const target = Number(targetValue);
  const chance = chanceFromTarget(target, condition);
  const multiplier = multiplierFromChance(chance);
  // Ishodi su tačno 0.00–99.99 (10.000): under → roll < chance (chance·100 ishoda); over → roll ≥ 100−chance
  // (takođe chance·100 ishoda). Strogo '>' bi over-u oduzeo jedan ishod (house edge 1.5% na 2%).
  const isWin = condition === 'under' ? roll < target : roll >= target;
  const profit = isWin ? r8(bet * multiplier - bet) : -bet;
  return { roll, isWin, multiplier, chance, profit, targetValue: target, condition };
}

export function validateBet({ betAmount, targetValue, condition, balance }) {
  const bet = Number(betAmount);
  if (!validBet(bet)) return { ok: false, error: `Ulog mora biti 0 ili najmanje ${MIN_BET}` };
  if (balance != null && bet > Number(balance)) return { ok: false, error: 'Ulog je veći od balansa' };
  if (condition !== 'over' && condition !== 'under') return { ok: false, error: 'Uslov mora biti over ili under' };
  const t = Number(targetValue);
  const chance = condition === 'under' ? t : 100 - t;
  if (!Number.isFinite(chance) || chance < MIN_CHANCE - 1e-9 || chance > MAX_CHANCE + 1e-9) {
    return { ok: false, error: `Šansa mora biti između ${MIN_CHANCE}% i ${MAX_CHANCE}%` };
  }
  return { ok: true };
}
