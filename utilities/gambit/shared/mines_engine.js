// Mines engine (čisto): tabla, runda (reveal/cashout), validacija. Tabla ostaje u Main-u/worker-u.
import { multiplier, nextMultiplier, FIELDS, MIN_MINES, MAX_MINES } from './mines_math.js';
import { MIN_BET, validBet } from './dice_math.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

// Uniforman M-podskup od 0..24 uzorkovanjem različitih indeksa preko rng.int (odbacivanje duplikata daje
// uniformnu raspodelu nad podskupovima, kao i Fisher-Yates, ali sa ~M umesto 24 poziva). Za M > 12 uzorkuje
// se komplement (dijamanti). Ne otvara nov krug — pozivalac odlučuje o nonce-u.
export function generateBoard(minesCount, rng) {
  const M = Number(minesCount);
  if (!Number.isInteger(M) || M < MIN_MINES || M > MAX_MINES) throw new Error(`Nevalidan broj mina: ${minesCount}`);
  const pickCount = M <= FIELDS / 2 ? M : FIELDS - M;
  const picked = new Set();
  while (picked.size < pickCount) picked.add(rng.int(FIELDS));
  if (M <= FIELDS / 2) return picked;
  const mines = new Set();
  for (let i = 0; i < FIELDS; i++) if (!picked.has(i)) mines.add(i);
  return mines;
}

export function createRound({ betAmount, minesCount, mines }) {
  return { betAmount: Number(betAmount), minesCount: Number(minesCount), mines, revealed: new Set(), active: true, k: 0 };
}

function finish(round, status, extra = {}) {
  round.active = false;
  return { status, mines: [...round.mines], revealed: round.k, ...extra };
}

export function reveal(round, index) {
  if (!round || !round.active) return { error: 'Runda nije aktivna' };
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i >= FIELDS) return { error: 'Nepostojeće polje' };
  if (round.revealed.has(i)) return { error: 'Polje je već otvoreno' };
  if (round.mines.has(i)) return finish(round, 'lose', { index: i, profit: -round.betAmount, multiplier: 0 });
  round.revealed.add(i);
  round.k += 1;
  const mult = multiplier(round.minesCount, round.k);
  if (round.k >= FIELDS - round.minesCount) {
    return finish(round, 'win', { index: i, multiplier: mult, profit: r8(round.betAmount * mult - round.betAmount) });
  }
  return { status: 'diamond', index: i, revealed: round.k, multiplier: mult, nextMultiplier: nextMultiplier(round.minesCount, round.k) };
}

export function cashout(round) {
  if (!round || !round.active) return { error: 'Runda nije aktivna' };
  if (round.k < 1) return { error: 'Otvori bar jedno polje pre isplate' };
  const mult = multiplier(round.minesCount, round.k);
  return finish(round, 'win', { multiplier: mult, profit: r8(round.betAmount * mult - round.betAmount) });
}

export function validateStart({ betAmount, minesCount, balance }) {
  const bet = Number(betAmount);
  const M = Number(minesCount);
  if (!validBet(bet)) return { ok: false, error: `Ulog mora biti 0 ili najmanje ${MIN_BET}` };
  if (balance != null && bet > Number(balance)) return { ok: false, error: 'Ulog je veći od balansa' };
  if (!Number.isInteger(M) || M < MIN_MINES || M > MAX_MINES) return { ok: false, error: `Broj mina mora biti ceo broj ${MIN_MINES}–${MAX_MINES}` };
  return { ok: true };
}
