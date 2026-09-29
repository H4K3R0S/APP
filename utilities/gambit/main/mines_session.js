// Mines sesija Main procesa: jedna aktivna runda; tabla nikad ne napušta Main pre kraja runde.
// abort() oslobađa rundu (promena igre, reload renderera) — ulog se ne naplaćuje (renderer nije primenio krug).
import { generateBoard, createRound, reveal, cashout, validateStart } from '../shared/mines_engine.js';
import { nextMultiplier, multiplier } from '../shared/mines_math.js';

export function createMinesSession(seeds) {
  let round = null;
  return {
    isActive: () => !!(round && round.active),
    state() {
      if (!round || !round.active) return { active: false };
      return { active: true, betAmount: round.betAmount, minesCount: round.minesCount, revealed: round.k, multiplier: multiplier(round.minesCount, round.k) };
    },
    start(args = {}) {
      if (round && round.active) return { error: 'Runda je već aktivna' };
      const v = validateStart(args);
      if (!v.ok) return { error: v.error };
      const rng = seeds.get('mines');
      rng.beginRound();
      const mines = generateBoard(args.minesCount, rng);
      round = createRound({ betAmount: args.betAmount, minesCount: args.minesCount, mines });
      return { ok: true, nextMultiplier: nextMultiplier(args.minesCount, 0), nonce: rng.nonce, serverSeedHash: seeds.serverSeedHash };
    },
    reveal(index) {
      if (!round) return { error: 'Runda nije aktivna' };
      const res = reveal(round, index);
      if (!res.error && res.status !== 'diamond') round = null;
      return res;
    },
    cashout() {
      if (!round) return { error: 'Runda nije aktivna' };
      const res = cashout(round);
      if (!res.error) round = null;
      return res;
    },
    abort() {
      const aborted = !!(round && round.active);
      round = null;
      return { ok: true, aborted };
    },
  };
}
