// Mines engine za simulator (čisto, bez DOM-a): stanje po sesiji (polja + okidači rotacije), runda = tabla → klik polja redom.
import { generateBoard } from '../../../shared/mines_engine.js';
import { multiplier } from '../../../shared/mines_math.js';
import { createShiftState, applyShift } from '../../../shared/mines_shift.js';

const r8 = (x) => Math.round(x * 1e8) / 1e8;

export const minesEngine = {
  init(strategy) {
    return {
      fields: [...(strategy.selectedFields || [])].map(Number).sort((a, b) => a - b),
      shift: createShiftState(strategy.shift),
    };
  },
  // Hibridni prelazak: nova strategija donosi svoja polja/okidače; akcija minesShift odmah rotira matricu.
  onHandover(_st, next, rng, actions = {}) {
    const st = minesEngine.init(next);
    if (actions.minesShift) st.fields = applyShift(st.fields, next.shift?.algo || 'random', rng) || st.fields;
    return st;
  },
  playRound(strategy, rng, bet, st) {
    const mines = generateBoard(strategy.minesCount, rng);
    let n = 0;
    let isWin = true;
    for (const i of st.fields) {
      if (mines.has(i)) { isWin = false; break; }
      n += 1;
    }
    const profit = isWin ? r8(bet * multiplier(strategy.minesCount, n) - bet) : -bet;
    const next = isWin ? st.shift.onWin(st.fields, rng) : st.shift.onLoss(st.fields, rng);
    if (next) st.fields = [...next].sort((a, b) => a - b);
    return { isWin, profit, revealed: n };
  },
};
