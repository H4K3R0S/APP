// Keno modul igre: UI + ručno igranje + frekvencije/sidro + auto petlja (minimalistički panel + pop-up uslovi). Registruje se u game host.
import { mountKenoUI } from './ui.js';
import { playKenoRound } from './manual.js';
import { mountKenoFreq } from './freq.js';
import { mountKenoAuto } from './auto.js';

export const kenoGame = {
  api: null,
  mount(panels) {
    const api = mountKenoUI(panels);
    api.freq = mountKenoFreq(api);
    const auto = mountKenoAuto(api, api.freq);
    api.auto = auto;
    api.strategy = auto.strategy;
    api.playManualRound = (opts) => playKenoRound(api, opts);
    api.onNumber((n) => { if (!auto.isRunning()) api.toggleNumber(n); });
    api.onBet(() => {
      if (api.getMode() === 'manual') { playKenoRound(api); return; }
      if (auto.isRunning()) auto.stop(); else auto.start();
    });
    api.onPlayOne(() => auto.playOne());
    this.api = api;
    return api;
  },
  async unmount() {
    if (this.api?.auto?.isRunning()) await this.api.auto.loop.stopAndWait();
    this.api?.freq?.unsubscribe?.();
    this.api = null;
  },
};
