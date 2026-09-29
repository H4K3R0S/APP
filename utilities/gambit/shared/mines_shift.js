// Rotacija matrice polja (Mines auto): mirror / invert / random + okidači (stay | now | after N uzastopnih).
// Čisto: koristi rng.int (kontinuirani tok), deli ga renderer petlja i simulator.
// applyShift vraća NOVA polja ili null kad nijedna rotacija ne menja skup (npr. svih 25 polja) — nikad „lažnu“ rotaciju.
import { FIELDS } from './mines_math.js';

export const SHIFT_ALGOS = ['mirror', 'invert', 'random'];
export const SHIFT_MODES = ['stay', 'now', 'after'];

const all = () => Array.from({ length: FIELDS }, (_, i) => i);
const sorted = (a) => [...a].sort((x, y) => x - y);
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = sorted(a);
  const sb = sorted(b);
  return sa.every((v, i) => v === sb[i]);
}

// Horizontalno ogledalo: red ostaje, kolona c → 4−c.
export function mirror(fields) {
  return fields.map((i) => Math.floor(i / 5) * 5 + (4 - (i % 5)));
}

// Vertikalno ogledalo: kolona ostaje, red r → 4−r (rezerva kad je izbor horizontalno simetričan).
export function mirrorVertical(fields) {
  return fields.map((i) => (4 - Math.floor(i / 5)) * 5 + (i % 5));
}

// Isti broj polja, potpuno nove nasumične pozicije (parcijalni Fisher-Yates: n koraka); null ako nije moguće (0 ili 25).
export function random(fields, rng) {
  const n = fields.length;
  if (n <= 0 || n >= FIELDS) return null;
  let out = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const pool = all();
    for (let i = 0; i < n; i++) {
      const j = i + rng.int(FIELDS - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    out = sorted(pool.slice(0, n));
    if (!sameSet(out, fields)) return out;
  }
  return sameSet(out, fields) ? null : out;
}

// Suprotna, slobodna polja: prvih n iz komplementa; ako komplement nema dovoljno → random.
export function invert(fields, rng) {
  const set = new Set(fields);
  const free = all().filter((i) => !set.has(i));
  if (free.length >= fields.length && fields.length > 0) return free.slice(0, fields.length);
  return random(fields, rng);
}

// Lenj lanac: mirror → (ako skup ostaje isti) vertikalno ogledalo → random; rng se troši samo kad zatreba.
export function applyShift(fields, algo, rng) {
  if (!SHIFT_ALGOS.includes(algo)) return null;
  const chain = algo === 'mirror' ? [mirror, mirrorVertical, random]
    : algo === 'invert' ? [invert]
      : [random];
  for (const fn of chain) {
    const c = fn(fields, rng);
    if (c && !sameSet(c, fields)) return c;
  }
  return null;
}

// Stanje okidača: brojači uzastopnih pobeda/gubitaka; vraća nova polja ili null.
export function createShiftState(shift = {}) {
  const rule = (r) => ({ mode: SHIFT_MODES.includes(r?.mode) ? r.mode : 'stay', count: Math.max(1, Math.floor(Number(r?.count) || 1)) });
  const onWin = rule(shift.onWin);
  const onLoss = rule(shift.onLoss);
  const algo = SHIFT_ALGOS.includes(shift.algo) ? shift.algo : 'random';
  let wins = 0;
  let losses = 0;

  function fire(r, counter, fields, rng) {
    if (r.mode === 'now' || (r.mode === 'after' && counter >= r.count)) return applyShift(fields, algo, rng);
    return null;
  }

  return {
    onWin(fields, rng) {
      wins += 1; losses = 0;
      const out = fire(onWin, wins, fields, rng);
      if (onWin.mode === 'after' && wins >= onWin.count) wins = 0;
      return out;
    },
    onLoss(fields, rng) {
      losses += 1; wins = 0;
      const out = fire(onLoss, losses, fields, rng);
      if (onLoss.mode === 'after' && losses >= onLoss.count) losses = 0;
      return out;
    },
    reset() { wins = 0; losses = 0; },
    get counters() { return { wins, losses }; },
  };
}
