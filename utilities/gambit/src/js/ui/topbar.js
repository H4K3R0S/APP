// Topbar: naziv, globalni izbor igre, CPU/RAM indikatori uživo.
import { setGame, state, subscribe } from '../state.js';

export function mountTopbar(el) {
  const select = el.querySelector('#game-select');
  const cpu = el.querySelector('#cpu-val');
  const ram = el.querySelector('#ram-val');

  select.value = state.game;
  select.addEventListener('change', () => {
    setGame(select.value);
    console.log('igra izabrana:', select.value);
  });

  // programska promena igre (Hub „Učitaj“, self-test) → select prati stanje
  subscribe((key) => { if (key === 'game' && select.value !== state.game) select.value = state.game; });

  window.gambitAPI.onSysStats((s) => {
    cpu.textContent = s.cpu.toFixed(1);
    ram.textContent = `${s.ramUsedGb.toFixed(1)} / ${s.ramTotalGb.toFixed(0)}`;
  });

  return { select };
}
