// electron-preload.cjs — Electron preload adapter za window-chrome.
//
// Dve upotrebe:
//  (a) App BEZ postojećeg mosta:
//        const { contextBridge } = require('electron');
//        const { winChromeApi } = require('.../electron-preload.cjs');
//        contextBridge.exposeInMainWorld('winChrome', winChromeApi);
//      → renderer koristi window.winChrome.winMinimize() itd.
//
//  (b) App SA postojećim mostom (npr. Gambit window.gambitAPI): NE praviti
//      drugi global — umesto toga umetnuti winChromeApi polja u postojeći
//      objekat pre exposeInMainWorld:
//        contextBridge.exposeInMainWorld('gambitAPI', { ...postojeće, ...winChromeApi });

const { ipcRenderer } = require('electron');

const winChromeApi = {
  winMinimize: () => ipcRenderer.invoke('win:minimize'),
  winMaxToggle: () => ipcRenderer.invoke('win:maxToggle'),
  winClose: () => ipcRenderer.invoke('win:close'),
};

module.exports = { winChromeApi };
