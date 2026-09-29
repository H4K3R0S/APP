// Gambit — Main proces (ESM): prozor, bezbednosni parametri, IPC registracija, sysmon, smoke režim.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { registerIpc } from './main/ipc.js';
import { startSysMon } from './main/sysmon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARGS = new Set(process.argv.slice(1));
const SMOKE = ARGS.has('--smoke');
const DEV = ARGS.has('--dev');
const argValue = (name, def) => {
  const a = [...ARGS].find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const SMOKE_TIMEOUT_MS = Number(argValue('smoke-timeout', 60000));

let win = null;

// Smoke kontekst: ping dokazuje IPC (SMOKE OK); renderer zatim šalje self-test izveštaj
// {checks:{router:bool,...}, errors:[]} → za svaku prošlu proveru "<KEY> OK"; izlaz 0 samo ako je sve prošlo.
const smoke = {
  active: SMOKE,
  screen: argValue('screen', null),
  errors: [],
  pinged: false,
  report(event, payload) {
    if (!this.active) return;
    if (event === 'ping') {
      this.pinged = true;
      console.log('SMOKE OK');
      return;
    }
    if (event === 'report') {
      let ok = this.pinged;
      for (const [key, passed] of Object.entries(payload.checks || {})) {
        if (passed) console.log(`${key.toUpperCase()} OK`);
        else { ok = false; console.error(`${key.toUpperCase()} FAIL`); }
      }
      // kratak drain: greške koje stignu asinhrono posle izveštaja takođe obaraju smoke
      setTimeout(() => {
        for (const e of [...(payload.errors || []), ...this.errors]) { ok = false; console.error('SMOKE ERROR:', e); }
        app.exit(ok ? 0 : 1);
      }, 250);
    }
  },
};

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    autoHideMenuBar: true,
    frame: false, // seamless window-chrome (custom traka: ─ ▢ ✕)
    icon: path.join(__dirname, 'assets', 'icon.png'),
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Gambit',
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  // Navigacija van index.html i novi prozori su zabranjeni; spoljni linkovi idu u sistemski browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) smoke.errors.push(message); // 3 = error; warn (2) je dozvoljen (npr. namerni 'nepoznat ekran')
    if (SMOKE || DEV) console.log(`[renderer:${level}] ${message}`);
  });
  win.on('closed', () => { win = null; });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
}

// Jedna instanca: drugi dvoklik fokusira postojeći prozor (worker pool i data/ ne trpe dve instance).
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    const ctx = { getWindow: () => win, smoke, sysmon: null, dataDir: path.join(__dirname, 'data') };
    registerIpc(ipcMain, ctx);
    createWindow();
    ctx.sysmon = startSysMon(ctx.getWindow);
    app.on('before-quit', () => {
      for (const ac of (ctx.jobs ? ctx.jobs.values() : [])) ac.abort(); // ugasi radnike simulacije (bez siročadi)
      if (ctx.sysmon) ctx.sysmon.stop();
    });
    if (SMOKE) {
      setTimeout(() => { console.error('SMOKE TIMEOUT'); app.exit(1); }, SMOKE_TIMEOUT_MS);
    }
  });

  app.on('window-all-closed', () => app.quit());
}
