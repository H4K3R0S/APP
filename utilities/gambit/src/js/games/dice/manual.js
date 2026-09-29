// Dice ručno igranje: jedan krug → validacija → IPC dice:roll → bljesak broja → statistika (→ grafikon preko state 'round').
import { state, applyRound } from '../../state.js';
import { validateBet } from '../../../../shared/dice_engine.js';
import { toast } from '../../ui/toast.js';

export async function playManualRound(ui, overrideBet) {
  const p = ui.getParams();
  const bet = {
    betAmount: overrideBet ?? p.betAmount,
    targetValue: p.targetValue,
    condition: p.condition,
    balance: state.stats.balance,
  };
  const v = validateBet(bet);
  if (!v.ok) { toast(v.error, 'error'); return null; }
  ui.setBusy(true);
  try {
    const res = await window.gambitAPI.rollDice(bet);
    if (!res || res.error) { toast(res?.error || 'Greška u igri', 'error'); return null; }
    ui.flashRoll(res.roll, res.isWin);
    applyRound({ game: 'dice', isWin: res.isWin, betAmount: bet.betAmount, profit: res.profit, multiplier: res.multiplier, roll: res.roll, nonce: res.nonce });
    return res;
  } finally {
    ui.setBusy(false);
  }
}
