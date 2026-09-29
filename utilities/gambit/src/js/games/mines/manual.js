// Mines ručno igranje: start → klik na polja (reveal) → cash out ili eksplozija; statistika/grafikon preko state.
import { state, applyRound } from '../../state.js';
import { toast } from '../../ui/toast.js';

export function createMinesManual(ui) {
  let currentBet = 0;
  let busy = false;

  function finish(result, mines, explodedAt) {
    for (const m of mines) if (m !== explodedAt) ui.setField(m, 'mine-dim');
    ui.setGridEnabled(false);
    ui.setInputsLocked(false);
    ui.setRound(false);
    applyRound({ game: 'mines', betAmount: currentBet, ...result });
  }

  const api = {
    async start() {
      if (ui.isRoundActive() || busy) return null;
      const p = ui.getParams();
      busy = true;
      try {
        const res = await window.gambitAPI.startMines({ betAmount: p.betAmount, minesCount: p.minesCount, balance: state.stats.balance });
        if (!res || res.error) { toast(res?.error || 'Greška pri startu', 'error'); return null; }
        currentBet = p.betAmount;
        ui.resetGrid(ui.getMode() === 'auto');
        ui.setInputsLocked(true);
        ui.setGridEnabled(true);
        ui.setRound(true, 0);
        return res;
      } finally { busy = false; }
    },
    async reveal(index) {
      if (!ui.isRoundActive() || busy) return null;
      if (ui.fieldState(index) !== 'hidden' && ui.fieldState(index) !== 'selected') return null;
      busy = true;
      try {
        const res = await window.gambitAPI.revealMinesField(index);
        if (!res || res.error) { toast(res?.error || 'Greška', 'error'); return null; }
        if (res.status === 'diamond') { ui.setField(index, 'diamond'); ui.setRound(true, res.revealed); }
        else if (res.status === 'lose') { ui.setField(index, 'mine'); finish({ isWin: false, profit: res.profit }, res.mines, index); }
        else if (res.status === 'win') { ui.setField(index, 'diamond'); finish({ isWin: true, profit: res.profit, multiplier: res.multiplier }, res.mines, -1); }
        return res;
      } finally { busy = false; }
    },
    async cashout() {
      if (!ui.isRoundActive() || busy) return null;
      busy = true;
      try {
        const res = await window.gambitAPI.cashoutMines();
        if (!res || res.error) { toast(res?.error || 'Greška', 'error'); return null; }
        finish({ isWin: true, profit: res.profit, multiplier: res.multiplier }, res.mines, -1);
        return res;
      } finally { busy = false; }
    },
    currentBet: () => currentBet,
  };
  return api;
}
