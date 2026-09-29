// Dice modul igre: sastavlja UI + ručno igranje + auto petlju (minimalistički panel + pop-up uslovi). Registruje se u game host.
import { mountDiceUI } from './ui.js';
import { playManualRound } from './manual.js';
import { mountDiceAuto } from './auto.js';

export const diceGame = {
  api: null,
  mount(panels) {
    const api = mountDiceUI(panels);
    const auto = mountDiceAuto(api);
    api.auto = auto;
    api.strategy = auto.strategy;
    api.playManualRound = () => playManualRound(api);
    api.onBet(() => {
      if (api.getMode() === 'manual') { playManualRound(api); return; }
      if (auto.isRunning()) auto.stop(); else auto.start();
    });
    api.onPlayOne(() => auto.playOne());
    this.api = api;
    return api;
  },
  async unmount() {
    if (this.api?.auto?.isRunning()) await this.api.auto.loop.stopAndWait();
    this.api = null;
  },
};
