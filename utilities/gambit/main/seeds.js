// Seed store Main procesa: jedan serverSeed po pokretanju, clientSeed promenljiv, po igri svoj RNG (nonce).
import { createRng, hashSeed, randomSeedHex } from '../shared/rng.js';

export function createSeedStore({ clientSeed = 'gambit_seed', serverSeed = randomSeedHex(32) } = {}) {
  const rngs = new Map();
  const store = {
    clientSeed,
    serverSeedHash: hashSeed(serverSeed),
    get(game) {
      if (!rngs.has(game)) rngs.set(game, createRng({ serverSeed, clientSeed: store.clientSeed, nonce: 0 }));
      return rngs.get(game);
    },
    setClientSeed(seed) {
      store.clientSeed = String(seed || 'gambit_seed');
      rngs.clear();
    },
  };
  return store;
}
