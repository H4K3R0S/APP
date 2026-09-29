// Game host: prati state.game i montira/demontira modul aktivne igre u panele ekrana igre.
// Modul igre: { mount(panels) → api, unmount() → void | Promise } — unmount koji vraća Promise (npr. auto-petlja
// koja se gasi) se SAČEKA pre čišćenja panela, da se nijedan krug ne primeni nad demontiranim UI-jem.
import { state, subscribe } from '../state.js';

const games = new Map();
let mounted = null;
let switching = Promise.resolve();

export function registerGame(name, mod) {
  games.set(name, mod);
}

function clearOwnedSlots(panels) {
  for (const el of [panels.left.tabs, panels.left.inputs, panels.left.actions, panels.center.render]) {
    el.replaceChildren();
    el.classList.remove('filled');
  }
}

export function mountGameHost(panels) {
  const apply = async () => {
    if (mounted) await mounted.mod.unmount();
    clearOwnedSlots(panels);
    const mod = games.get(state.game);
    if (!mod) { mounted = null; return; }
    const api = mod.mount(panels);
    for (const el of [panels.left.tabs, panels.left.inputs, panels.left.actions, panels.center.render]) {
      el.classList.add('filled');
    }
    mounted = { name: state.game, mod, api };
  };
  const schedule = () => { switching = switching.then(apply); return switching; };
  subscribe((key) => { if (key === 'game') schedule(); });
  schedule();
  return { current: () => mounted, ready: () => switching };
}
