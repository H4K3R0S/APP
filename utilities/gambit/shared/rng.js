// Provably-fair RNG (Stake šema): HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${round}`) → 32 bajta
// → 8 × uint32; odbacivanje ≥ 4.294.960.000 radi uniformnosti; float = (u % 10000) / 100 ∈ [0.00, 99.99]
// (tačno 10.000 jednako verovatnih ishoda sa 2 decimale; spec-ova formula % 1e6 / 1e4 daje 4 decimale).
// Jedan roll() = jedan krug (nonce++); unutar kruga next()/int()/shuffle() troše bajtove; kad se potroše, round++.
// Samo Node (Main, worker-i, testovi) — koristi node:crypto.
import { createHmac, createHash, randomBytes } from 'node:crypto';

export const OUTCOMES = 10000; // 0.00 … 99.99
export const REJECT_ABOVE = Math.floor(4294967296 / OUTCOMES) * OUTCOMES; // 4.294.960.000
const TWO_32 = 4294967296;

export function hashSeed(seed) {
  return createHash('sha256').update(String(seed)).digest('hex');
}

export function randomSeedHex(bytes = 32) {
  return randomBytes(bytes).toString('hex');
}

export function createRng({ serverSeed, clientSeed = 'gambit_seed', nonce = 0 } = {}) {
  if (!serverSeed) throw new Error('serverSeed je obavezan');
  const st = { nonce, round: 0, pos: 8, digest: null };

  function refill() {
    st.digest = createHmac('sha256', serverSeed).update(`${clientSeed}:${st.nonce}:${st.round}`).digest();
    st.round += 1;
    st.pos = 0;
  }
  function u32() {
    if (st.pos >= 8) refill();
    const v = st.digest.readUInt32BE(st.pos * 4);
    st.pos += 1;
    return v;
  }
  function nextFloat() {
    let v;
    do { v = u32(); } while (v >= REJECT_ABOVE);
    return (v % OUTCOMES) / 100;
  }
  function beginRound() {
    st.nonce += 1;
    st.round = 0;
    st.pos = 8;
  }
  function int(n) {
    if (!(n >= 1)) throw new Error(`rng.int: n mora biti ≥ 1 (dobijeno ${n})`);
    const limit = Math.floor(TWO_32 / n) * n;
    let v;
    do { v = u32(); } while (v >= limit);
    return v % n;
  }

  return {
    get nonce() { return st.nonce; },
    beginRound,
    roll() { beginRound(); return { value: nextFloat(), nonce: st.nonce }; },
    next: nextFloat,
    int,
    // Fisher-Yates u mestu; sam otvara nov krug (nonce++).
    shuffle(arr) {
      beginRound();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}
