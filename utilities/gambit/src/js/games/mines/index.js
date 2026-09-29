// Mines modul igre: UI + ručno igranje + auto petlja (minimalistički panel + pop-up uslovi). Registruje se u game host.
import { mountMinesUI } from './ui.js';
import { createMinesManual } from './manual.js';
import { mountMinesAuto } from './auto.js';

export const minesGame = {
  api: null,
  mount(panels) {
    const api = mountMinesUI(panels);
    const manual = createMinesManual(api);
    const auto = mountMinesAuto(api);
    api.manual = manual;
    api.auto = auto;
    api.strategy = auto.strategy;
    api.onBet(() => {
      if (api.getMode() === 'manual') { if (api.isRoundActive()) manual.cashout(); else manual.start(); return; }
      if (auto.isRunning()) auto.stop(); else auto.start();
    });
    api.onPlayOne(() => auto.playOne());
    api.onField((i) => {
      if (api.getMode() === 'auto') { auto.toggleField(i); return; }
      if (api.isRoundActive()) manual.reveal(i);
      else api.el.cells[i].classList.add('field-pulse');
    });
    const baseSetMode = api.setMode.bind(api);
    api.setMode = (m) => { baseSetMode(m); api.setGridEnabled(m === 'auto' || api.isRoundActive()); if (m !== 'auto') api.resetGrid(); else auto.setSelectedFields(auto.getSelectedFields()); };
    // Backstop: runda zaostala u Main-u (reload renderera, prethodna instanca modula) se oslobađa pri montiranju.
    window.gambitAPI.abortMines().catch(() => {});
    this.api = api;
    return api;
  },
  // Promena igre usred runde: auto petlja se čeka; ručna runda sa bar jednim dijamantom se kešira, inače se oslobađa.
  async unmount() {
    const api = this.api;
    this.api = null;
    if (!api) return;
    if (api.auto?.isRunning()) await api.auto.loop.stopAndWait();
    if (api.isRoundActive()) {
      const st = await window.gambitAPI.minesState().catch(() => null);
      if (st?.active && st.revealed > 0) await api.manual.cashout();
      else await window.gambitAPI.abortMines().catch(() => {});
    }
  },
};
