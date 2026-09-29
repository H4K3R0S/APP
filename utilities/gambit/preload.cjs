// Gambit — bezbednosni most (Context Isolation). Jedina IPC površina: window.gambitAPI.
const { contextBridge, ipcRenderer } = require('electron');

// Pretplata na push kanal; vraća funkciju za odjavu (game host montira/demontira module).
function on(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('gambitAPI', {
  // Kontrole prozora (frameless window-chrome).
  winMinimize: () => ipcRenderer.invoke('win:minimize'),
  winMaxToggle: () => ipcRenderer.invoke('win:maxToggle'),
  winClose: () => ipcRenderer.invoke('win:close'),
  ping: () => ipcRenderer.invoke('sys:ping'),
  getHardware: () => ipcRenderer.invoke('sys:hardware'),
  setSysMonFast: (fast) => ipcRenderer.invoke('sys:monfast', !!fast),
  onSysStats: (cb) => on('sys:stats', cb),
  smokeReport: (report) => ipcRenderer.send('sys:smoke-report', report),
  rollDice: (bet) => ipcRenderer.invoke('dice:roll', bet),
  startMines: (args) => ipcRenderer.invoke('mines:start', args),
  revealMinesField: (index) => ipcRenderer.invoke('mines:reveal', index),
  cashoutMines: () => ipcRenderer.invoke('mines:cashout'),
  abortMines: () => ipcRenderer.invoke('mines:abort'),
  minesState: () => ipcRenderer.invoke('mines:state'),
  playKeno: (args) => ipcRenderer.invoke('keno:play', args),
  listStrategies: (game) => ipcRenderer.invoke('strategy:list', game),
  listAllStrategies: () => ipcRenderer.invoke('strategy:list-all'),
  saveStrategy: (game, obj) => ipcRenderer.invoke('strategy:save', game, obj),
  loadStrategy: (game, name) => ipcRenderer.invoke('strategy:load', game, name),
  deleteStrategy: (game, name) => ipcRenderer.invoke('strategy:delete', game, name),
  loadAnalysis: (game, name) => ipcRenderer.invoke('analysis:load', game, name),
  runSimulation: (opts) => ipcRenderer.invoke('simulator:run', opts),
  benchmarkHistory: (limit) => ipcRenderer.invoke('benchmark:history', limit),
  cancelSimulation: (jobId) => ipcRenderer.invoke('simulator:cancel', jobId),
  onSimProgress: (cb) => on('simulator:progress', cb),
  onSimDone: (cb) => on('simulator:done', cb),
});
