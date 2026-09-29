// Keno ručno igranje: validacija → IPC keno:play → animirano bojenje 20 izvučenih → statistika/grafikon.
import { state, applyRound } from '../../state.js';
import { toast } from '../../ui/toast.js';
import { validatePlay } from '../../../../shared/keno_engine.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function playKenoRound(ui, { betAmount, numbers, stepMs = 40 } = {}) {
  const p = ui.getParams();
  const bet = betAmount ?? p.betAmount;
  const nums = numbers ?? p.selectedNumbers;
  const args = { betAmount: bet, selectedNumbers: nums, riskLevel: p.riskLevel, balance: state.stats.balance };
  const v = validatePlay(args);
  if (!v.ok) { toast(v.error, 'error'); return null; }
  const wasLocked = ui.isLocked(); // auto petlja drži UI zaključan između krugova — ne otključavaj ga ovde
  ui.setBusy(true);
  ui.setLocked(true);
  try {
    const res = await window.gambitAPI.playKeno(args);
    if (!res || res.error) { toast(res?.error || 'Greška u igri', 'error'); return null; }
    ui.clearDraw();
    if (numbers) ui.setSelected(numbers);
    const sel = new Set(nums.map(Number));
    for (const n of res.drawnNumbers) {
      ui.markNumber(n, sel.has(n) ? 'hit' : 'miss');
      if (stepMs > 0) await sleep(stepMs);
    }
    applyRound({ game: 'keno', isWin: res.isWin, betAmount: bet, profit: res.profit, hits: res.hits, multiplier: res.multiplier, nonce: res.nonce });
    for (const fn of ui.drawHandlers) fn(res.drawnNumbers, res);
    return res;
  } finally {
    ui.setBusy(false);
    ui.setLocked(wasLocked);
  }
}
