// Keno statistika učestalosti (sesija): mapa 1..BOARD (40), istorija izvlačenja, Top 3 „sidro“, hladni brojevi, heat, tiket.
// Čisto — deli ga renderer (analitika/auto) i simulator (sidro strategija u radniku).
import { BOARD, MAX_PICKS } from './keno_paytables.js';

// map je Uint32 (Uint16 bi se prelio posle ~262k krugova po sesiji); history se čuva samo kad je potrebna (renderer).
export function createFreq() {
  return { map: new Uint32Array(BOARD + 1), lastSeen: new Int32Array(BOARD + 1).fill(-1), history: [], count: 0 };
}

export function resetFreq(f) {
  f.map.fill(0);
  f.lastSeen.fill(-1);
  f.history.length = 0;
  f.count = 0;
}

export function record(f, drawn, { keepHistory = true } = {}) {
  const idx = f.count;
  f.count += 1;
  if (keepHistory) f.history.push([...drawn]);
  for (const n of drawn) { f.map[n] += 1; f.lastSeen[n] = idx; }
}

// Najučestaliji; tie-break: izvučen u svežijem krugu, pa manji broj. Prazna mapa → [1,2,3].
export function topAnchors(f, k = 3) {
  const nums = Array.from({ length: BOARD }, (_, i) => i + 1);
  nums.sort((a, b) => (f.map[b] - f.map[a]) || (f.lastSeen[b] - f.lastSeen[a]) || (a - b));
  return nums.slice(0, k);
}

// Najređe izvlačeni (tie-break manji broj), bez isključenih.
export function coldNumbers(f, k, exclude = []) {
  const ex = new Set(exclude);
  const nums = [];
  for (let n = 1; n <= BOARD; n++) if (!ex.has(n)) nums.push(n);
  nums.sort((a, b) => (f.map[a] - f.map[b]) || (a - b));
  return nums.slice(0, k);
}

export function heat(f) {
  const out = new Float32Array(BOARD + 1);
  let max = 0;
  for (let n = 1; n <= BOARD; n++) if (f.map[n] > max) max = f.map[n];
  if (max > 0) for (let n = 1; n <= BOARD; n++) out[n] = f.map[n] / max;
  return out;
}

// Tiket za auto igru: sidro uključeno → 3 sidra + popuna do 10 (random preko rng.int | cold); inače ručni brojevi.
export function buildTicket(f, { anchor, fillMode = 'random', manualNumbers = [], rng, skipTop = 0 } = {}) {
  if (!anchor || !anchor.enabled) return [...manualNumbers].map(Number).sort((a, b) => a - b);
  const skip = Math.max(0, Math.floor(Number(skipTop) || 0));
  const anchors = topAnchors(f, 3 + skip).slice(skip); // skipTop 3 = „sekundarni par“ sidara (hibridna akcija)
  const need = MAX_PICKS - anchors.length;
  let fill;
  if ((anchor.fillMode || fillMode) === 'cold') {
    fill = coldNumbers(f, need, anchors);
  } else {
    const taken = new Set(anchors);
    const pool = [];
    for (let n = 1; n <= BOARD; n++) if (!taken.has(n)) pool.push(n);
    fill = [];
    while (fill.length < need) { const i = rng.int(pool.length); fill.push(pool.splice(i, 1)[0]); }
  }
  return [...anchors, ...fill];
}
