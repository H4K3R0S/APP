// Mines kombinatorika (Stake model, house edge 1%): mult(M,k) = 0.99 · C(25,k) / C(25−M,k).
export const FIELDS = 25;
export const MIN_MINES = 1;
export const MAX_MINES = 24;
export const HOUSE_EDGE = 0.01;

const r4 = (x) => Math.round(x * 10000) / 10000;

export function choose(n, r) {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let num = 1;
  for (let i = 1; i <= r; i++) num = (num * (n - r + i)) / i;
  return Math.round(num);
}

// M mina, k otvorenih dijamanata → multiplikator isplate (0 ako je k nemoguće).
export function multiplier(minesCount, revealed) {
  const M = Number(minesCount);
  const k = Number(revealed);
  if (!Number.isInteger(M) || M < MIN_MINES || M > MAX_MINES) return 0;
  if (k <= 0) return 1;
  if (k > FIELDS - M) return 0;
  return r4((1 - HOUSE_EDGE) * (choose(FIELDS, k) / choose(FIELDS - M, k)));
}

export function nextMultiplier(minesCount, revealed) {
  return multiplier(minesCount, Number(revealed) + 1);
}
