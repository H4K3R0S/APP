// electron-main.cjs — Electron adapter (Sloj B) za window-chrome.
// Daje frameless opcije prozora i registruje IPC kontrole (─ ▢ ✕).
//
// Upotreba u main procesu:
//   const { windowOpts, registerWindowControls } = require('.../window-chrome/adapters/electron-main.cjs');
//   const win = new BrowserWindow({ ...windowOpts, backgroundColor:'#0f172a', /* app opcije */ });
//   registerWindowControls(ipcMain, () => win);
//
// NAPOMENA: ne postavljamo transparent:true (Linux WM artefakti). Traka je
// providna UNUTAR prozora koji ima čvrst backgroundColor.

/** Frameless opcije — spoji sa app-specifičnim opcijama preko spread-a. */
const windowOpts = {
  frame: false,
};

/**
 * Registruje tri kanala na dati ipcMain. `getWin` vraća BrowserWindow.
 * Kanali su usklađeni sa VELES konvencijom: win:minimize / win:maxToggle / win:close.
 * @param {import('electron').IpcMain} ipcMain
 * @param {() => import('electron').BrowserWindow} getWin
 */
function registerWindowControls(ipcMain, getWin) {
  ipcMain.handle('win:minimize', () => {
    const w = getWin();
    if (w) w.minimize();
  });
  ipcMain.handle('win:maxToggle', () => {
    const w = getWin();
    if (!w) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
  ipcMain.handle('win:close', () => {
    const w = getWin();
    if (w) w.close();
  });
}

module.exports = { windowOpts, registerWindowControls };
