// Veliki zeleni prikaz pogotka u centru table: multiplikator + zarada. Bljesne na dobitak, pa nestane.
// Montira se u #panel-game-render; prati state 'round'. Samo dobici (isWin && profit > 0).
import { h, fmt } from './dom.js';
import { subscribe } from '../state.js';

export function mountWinFlash(centerRenderEl) {
  const mult = h('div', { class: 'wf-mult' }, '');
  const profit = h('div', { class: 'wf-profit' }, '');
  const overlay = h('div', { id: 'win-flash', class: 'win-flash' }, mult, profit);
  centerRenderEl.append(overlay);
  let hideT = null;

  function show(result) {
    // game_host čisti render panel pri promeni igre → overlay se ponovo prikači
    if (!overlay.isConnected) centerRenderEl.append(overlay);
    const m = Number(result.multiplier);
    mult.textContent = Number.isFinite(m) && m > 0 ? `${fmt(m, 2)}×` : 'POGODAK';
    profit.textContent = `+${fmt(result.profit, result.profit < 1 ? 4 : 2)}$`;
    overlay.classList.remove('show');
    void overlay.offsetWidth; // restart animacije
    overlay.classList.add('show');
    if (hideT) clearTimeout(hideT);
    hideT = setTimeout(() => overlay.classList.remove('show'), 1500);
  }

  const unsubscribe = subscribe((key, _s, result) => {
    if (key === 'round' && result && result.isWin && Number(result.profit) > 0) show(result);
  });

  return { el: overlay, show, unsubscribe };
}
