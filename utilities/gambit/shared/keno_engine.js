// Keno engine (čisto): izvlačenje DRAW_COUNT (10) od BOARD (40) (parcijalni Fisher-Yates preko rng.int), ishod tiketa, validacija.
import { RISKS, MAX_PICKS, DRAW_COUNT, BOARD, payout } from './keno_paytables.js';
import { MIN_BET, validBet } from './dice_math.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

export function draw(rng) {
  const pool = Array.from({ length: BOARD }, (_, i) => i + 1);
  for (let i = 0; i < DRAW_COUNT; i++) {
    const j = i + rng.int(BOARD - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DRAW_COUNT);
}

export function resolvePlay({ betAmount, selectedNumbers, riskLevel }, drawn) {
  const bet = Number(betAmount);
  const picks = [...selectedNumbers].map(Number).sort((a, b) => a - b);
  const drawnSet = new Set(drawn);
  const hitNumbers = picks.filter((n) => drawnSet.has(n));
  const hits = hitNumbers.length;
  const multiplier = payout(riskLevel, picks.length, hits);
  const profit = r8(bet * multiplier - bet);
  return { drawnNumbers: [...drawn], hitNumbers, hits, multiplier, profit, isWin: multiplier >= 1, picks: picks.length };
}

export function validatePlay({ betAmount, selectedNumbers, riskLevel, balance }) {
  const bet = Number(betAmount);
  if (!validBet(bet)) return { ok: false, error: `Ulog mora biti 0 ili najmanje ${MIN_BET}` };
  if (balance != null && bet > Number(balance)) return { ok: false, error: 'Ulog je veći od balansa' };
  if (!RISKS.includes(riskLevel)) return { ok: false, error: 'Nepoznat nivo rizika' };
  if (!Array.isArray(selectedNumbers) || selectedNumbers.length < 1) return { ok: false, error: 'Izaberi bar jedan broj' };
  if (selectedNumbers.length > MAX_PICKS) return { ok: false, error: `Najviše ${MAX_PICKS} brojeva` };
  const nums = selectedNumbers.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 1 || n > BOARD)) return { ok: false, error: `Brojevi moraju biti 1–${BOARD}` };
  if (new Set(nums).size !== nums.length) return { ok: false, error: 'Brojevi se ponavljaju' };
  return { ok: true };
}
