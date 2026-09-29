// Keno engine za simulator (čisto): stanje po sesiji = mapa učestanosti (resetuje se po sesiji); runda = tiket
// (sidro top 3 + popuna random/cold, ili ručni brojevi) → izvlačenje 20 → isplata → beleženje frekvencija.
import { draw, resolvePlay } from '../../../shared/keno_engine.js';
import { createFreq, record, buildTicket } from '../../../shared/keno_freq.js';

export const kenoEngine = {
  init(_strategy) {
    return { freq: createFreq(), skipTop: 0 };
  },
  // Hibridni prelazak: istorija sesije se ZADRŽAVA; akcija kenoSwapAnchors zamenjuje top 3 sidra sekundarnim (sledeća 3).
  onHandover(st, _next, _rng, actions = {}) {
    return { freq: st.freq, skipTop: actions.kenoSwapAnchors ? 3 : 0 };
  },
  playRound(strategy, rng, bet, st) {
    const ticket = buildTicket(st.freq, { anchor: strategy.anchor, manualNumbers: strategy.selectedNumbers, rng, skipTop: st.skipTop });
    const drawn = draw(rng);
    const res = resolvePlay({ betAmount: bet, selectedNumbers: ticket, riskLevel: strategy.riskLevel }, drawn);
    record(st.freq, drawn, { keepHistory: false }); // radnik ne čuva istoriju (memorija: 200k krugova × 10 brojeva po sesiji)
    return { isWin: res.isWin, profit: res.profit, hits: res.hits, ticket };
  },
};
