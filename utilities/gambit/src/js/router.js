// SPA ruter: display-toggle sekcija .screen unutar #main-content, fade tranzicija, .active na sidebar dugmetu.
const SCREENS = ['screen-game', 'screen-simulations', 'screen-strategy-hub'];

let current = null;
let onChange = () => {};

export function currentScreen() {
  return current;
}

// Vraća true ako je ekran prebačen; false (uz console.warn) za nepoznat ID — nikad ne ostavlja 0 aktivnih.
export function switchScreen(screenId) {
  if (!SCREENS.includes(screenId)) {
    console.warn('router: nepoznat ekran', screenId);
    return false;
  }
  if (screenId === current) return true;
  for (const id of SCREENS) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === screenId);
  }
  current = screenId;
  onChange(screenId);
  return true;
}

export function initRouter({ defaultScreen = 'screen-game', onChange: cb } = {}) {
  if (cb) onChange = cb;
  // Nepoznat podrazumevani ekran → prvi ekran; nikad 0 aktivnih.
  if (!switchScreen(defaultScreen)) switchScreen(SCREENS[0]);
  return { switchScreen, currentScreen, SCREENS };
}
