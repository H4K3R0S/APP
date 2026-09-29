# Gambit Faza 1 — Skelet (koraci 01–04) — plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pokretljiv (dvoklik) Electron „Gambit“ prozor sa bezbednim IPC mostom, sysmon topbar-om, sidebar-om, SPA ruterom za 3 ekrana i troslojnim layout-om ekrana igre.

**Architecture:** Main (`main.js` + `main/`) drži prozor, sysmon i IPC; `preload.js` izlaže `window.gambitAPI`; renderer (`src/`) je čist HTML/CSS/ES-moduli bez bundlera. Smoke režim (`--smoke`) dokazuje IPC bez ljudskog oka; screenshot preko `import` dokazuje vizuelno.

**Tech Stack:** Electron 33.4.11 (keširan u `~/.cache/electron`), Node 20, `node --test`, ImageMagick `import`/`convert`, xdotool.

**Spec:** `docs/specs/2026-09-27-gambit-design.md` (§3.1 struktura, §3.2 IPC, §3.7 renderer)

## Global Constraints

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; jedina IPC površina je `window.gambitAPI`.
- Prozor 1280×800, naslov „Gambit“, pozadina `#0f172a`; tema tokeni u `src/css/global.css` (`--bg:#0f172a; --panel:#1e293b; --border:#334155; --text:#e2e8f0; --muted:#94a3b8; --green:#22c55e; --red:#ef4444; --blue:#3b82f6; --purple:#a855f7`), font `Inter, Roboto, system-ui, sans-serif`.
- UI tekstovi na srpskom (latinica): „Igra“, „Simulacije“, „Strategy Hub“, „CPU“, „RAM“, „Izaberi igru“.
- Svaka `.sh` skripta: Shebang linija 1 + `chmod +x`. Nema `cat <<EOF`; nov fajl = `Write`, izmena = `Edit`.
- Repo: `~/ai/APPS/utilities/gambit`, lokalni git (`git_setup.py`), online NIKAD bez zahteva.
- Bez eksternih biblioteka u Fazi 1 (uPlot dolazi u Fazi 2).

## Review Focus

1. Pokretanje bez `node_modules` (prvi dvoklik) mora sam instalirati Electron i pokrenuti app, ne pasti tiho → test u Task 2 (launcher bez `node_modules` u privremenoj kopiji).
2. Pokretanje mimo terminala (nema `DISPLAY`) → launcher postavlja `DISPLAY=:0.0` i `XAUTHORITY` → provera u Task 2 (`env -i` pokretanje).
3. Sysmon prvi uzorak: CPU delta nema prethodno stanje → mora vratiti 0, ne `NaN` → test u Task 3.
4. Ruter sa nepoznatim `screenId` ne sme srušiti renderer niti ostaviti 0 ekrana aktivnih → test u Task 4 (smoke self-test).
5. Zatvaranje prozora gasi ceo proces (nema zombi Electron-a) → provera u Task 1 (smoke izlazni kod + `pgrep`).

---

### Task 1: Electron kostur + IPC ping + smoke režim (korak 01)

**Files:**
- Create: `package.json`, `main.js`, `preload.js`, `main/ipc.js`, `src/index.html`, `src/css/global.css` (prazan sa tokenima), `src/js/renderer.js`, `.gitignore`, `data/{dice,mines,keno}/.gitkeep`, `README.md`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: `window.gambitAPI.ping() → Promise<{pong:true, ts:number}>`; `main/ipc.js` izvozi `registerIpc(ipcMain, ctx)`; `main.js` prihvata `--smoke` (izlaz 0 kad ping prođe, 1 posle 10 s) i `--dev` (otvara DevTools).

- [ ] **Step 1: Inicijalizuj repo i git**

Run: `python3 ~/ai/ai_workplace/scripts/git_setup.py ~/ai/APPS/utilities/gambit`
Expected: `.git` postoji, hookovi postavljeni. `.gitignore` sadrži `node_modules/`, `data/**/*.json`, `*.log`, `.commit-shots/`.

- [ ] **Step 2: Napiši `package.json`** — `name: gambit`, `main: main.js`, `scripts: {start: "electron .", dev: "electron . --dev", smoke: "electron . --smoke --no-sandbox", test: "node --test tests/"}`, `devDependencies: {electron: "33.4.11"}`.

- [ ] **Step 3: Instaliraj Electron iz keša**

Run: `cd ~/ai/APPS/utilities/gambit && npm install 2>&1 | tail -2 && ls node_modules/electron/dist/electron`
Expected: binarni fajl postoji; nema mrežnog preuzimanja (keš `~/.cache/electron/electron-v33.4.11-linux-x64.zip`).

- [ ] **Step 4: Napiši smoke test `tests/smoke.test.js`**

```js
const { test } = require('node:test'); const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
test('electron --smoke: IPC ping prolazi i proces se gasi', () => {
  const r = spawnSync('npx', ['electron', '.', '--smoke', '--no-sandbox'], { cwd: __dirname + '/..', timeout: 30000, encoding: 'utf8', env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0.0' } });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /SMOKE OK/);
});
```

- [ ] **Step 5: Pokreni test, očekuj pad** — Run: `npm test` → FAIL (main.js ne postoji).

- [ ] **Step 6: Napiši `main.js`** — `createWindow()` (1280×800, `backgroundColor:'#0f172a'`, `webPreferences:{preload, contextIsolation:true, nodeIntegration:false, sandbox:true}`), učitava `src/index.html`; `registerIpc(ipcMain, {win, smoke})`; `window-all-closed → app.quit()`; `--smoke`: kad stigne `sys:ping`, `console.log('SMOKE OK')` i `app.exit(0)`; tajmer 10 s → `app.exit(1)`.

- [ ] **Step 7: Napiši `preload.js`** — `contextBridge.exposeInMainWorld('gambitAPI', { ping: () => ipcRenderer.invoke('sys:ping') })`.

- [ ] **Step 8: Napiši `main/ipc.js`** — `registerIpc(ipcMain, ctx)` sa `ipcMain.handle('sys:ping', () => ({pong:true, ts:Date.now()}))` + smoke hook.

- [ ] **Step 9: Napiši `src/index.html` + `src/js/renderer.js`** — `<h1>Gambit — sistem spreman</h1>`, `<script type="module" src="js/renderer.js">`; renderer zove `ping()` i `console.log` odgovor. CSP meta: `default-src 'self'; style-src 'self' 'unsafe-inline'`.

- [ ] **Step 10: Pokreni test, očekuj prolaz** — Run: `npm test` → PASS; zatim `pgrep -f "gambit.*electron" || echo "nema zombija"` → „nema zombija“.

- [ ] **Step 11: Commit** — Run: `~/ai/ai_workplace/scripts/commit_local.sh gambit "feat(korak01): Electron kostur, preload most, IPC ping, smoke režim"`

### Task 2: Launcher, ikona, .desktop, registar (ZAKON izvršnih app)

**Files:**
- Create: `gambit.sh`, `Gambit.desktop`, `assets/icon.svg`, `assets/icon.png`, `scripts/install_desktop.sh`
- Modify: `~/ai/ai_workplace/scripts/apps.json` (dodaj `gambit`), `~/ai/ai_workplace/.ai/APLIKACIJE.md` (red u tabeli)
- Test: `tests/launcher.test.js`

**Interfaces:**
- Produces: `gambit.sh [args]` (prosleđuje `--dev/--smoke`); `scripts/install_desktop.sh` instalira `.desktop` u `~/.local/share/applications/` i `~/Desktop/` + `gio set … metadata::trusted true` + `chmod +x`.

- [ ] **Step 1: Napiši `tests/launcher.test.js`** — test 1: `gambit.sh --smoke` iz `env -i HOME=$HOME PATH=$PATH` (bez DISPLAY) vraća status 0 i stdout sadrži `SMOKE OK`; test 2: privremena kopija repoa bez `node_modules` (kopiraj `package.json`, `main.js`, `preload.js`, `main/`, `src/`, `gambit.sh`; `npm ci` u launcheru koristi keš) → `gambit.sh --smoke` status 0.

- [ ] **Step 2: Pokreni test, očekuj pad** — Run: `npm test -- tests/launcher.test.js` → FAIL (nema `gambit.sh`).

- [ ] **Step 3: Napiši `gambit.sh`** — Shebang `#!/bin/bash`; `cd "$(dirname "$(readlink -f "$0")")"`; `export DISPLAY="${DISPLAY:-:0.0}" XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"`; ako nema `node_modules/electron/dist/electron` → `npm install --no-audit --no-fund` (neuspeh → `notify-send` ako postoji + exit 1); `exec ./node_modules/.bin/electron . --no-sandbox "$@"`. `chmod +x`.

- [ ] **Step 4: Napiši `assets/icon.svg`** — 256×256, zaobljeni kvadrat `#0f172a` sa ivicom `#334155`, zelena kockica (`#22c55e`) sa 5 belih tačaka, u donjem desnom uglu belo slovo „G“ (Inter/sans, bold). Generiši PNG: `convert -background none assets/icon.svg -resize 256x256 assets/icon.png`.

- [ ] **Step 5: Napiši `Gambit.desktop`** — `[Desktop Entry] Type=Application Version=1.0 Name=Gambit GenericName=Simulator kazino igara Comment=Dice/Mines/Keno simulator sa strategijama i Monte Carlo analizom Exec=/home/kalima/ai/APPS/utilities/gambit/gambit.sh Icon=/home/kalima/ai/APPS/utilities/gambit/assets/icon.png Path=/home/kalima/ai/APPS/utilities/gambit Terminal=false Categories=Game;Utility; Keywords=gambit;dice;mines;keno;simulator; StartupWMClass=Gambit`.

- [ ] **Step 6: Napiši `scripts/install_desktop.sh`** — kopira `.desktop` u oba odredišta, `chmod +x`, `gio set <fajl> metadata::trusted true`, `update-desktop-database ~/.local/share/applications 2>/dev/null || true`; ispisuje jednu liniju. Pokreni ga.

Run: `./scripts/install_desktop.sh && ls -l ~/Desktop/Gambit.desktop && gio info ~/Desktop/Gambit.desktop | grep trusted`
Expected: fajl postoji, `metadata::trusted: true`.

- [ ] **Step 7: Registar** — u `apps.json` dodaj `"gambit": {"kind":"proc","dir":"ai/APPS/utilities/gambit","start":"./gambit.sh","match":"gambit.*electron","tests":"tests"}`; u `APLIKACIJE.md` dodaj red `| **Gambit** | ~/ai/APPS/utilities/gambit | Simulator kazino igara (Electron): Dice/Mines/Keno, strategije JSON, Monte Carlo worker pool. |`.

- [ ] **Step 8: Pokreni testove** — Run: `npm test` → PASS (oba fajla).

- [ ] **Step 9: Commit** — `commit_local.sh gambit "feat: launcher gambit.sh, ikona, Gambit.desktop (dvoklik), install_desktop.sh"` i `commit_local.sh ai_workplace "chore(apps.json,APLIKACIJE): registruj gambit"`.

### Task 3: Sysmon + globalni layout (sidebar, topbar) (korak 02)

**Files:**
- Create: `main/sysmon.js`, `src/css/layout.css`, `src/js/ui/topbar.js`, `src/js/ui/sidebar.js`, `src/js/state.js`
- Modify: `main.js` (start/stop sysmon), `main/ipc.js`, `preload.js`, `src/index.html`, `src/js/renderer.js`
- Test: `tests/sysmon.test.js`

**Interfaces:**
- Produces: `sysmon.js`: `sample(prev) → {cpu:number(0..100), ramUsedGb, ramTotalGb, _raw}` (čista funkcija nad `os.cpus()`; `prev=null` → `cpu:0`), `startSysMon(win, intervalMs=1500) → {stop(), setFast(bool)}` (push `sys:stats`).
- `preload`: `onSysStats(cb)`, `setSysMonFast(bool)`, `getHardware() → {threads, maxAllowed:14}`.
- `state.js`: `state = {game:'dice'}`, `setGame(g)`, `subscribe(fn)`; `topbar.js`: `mountTopbar(el)`, `sidebar.js`: `mountSidebar(el, onSelect)`.
- DOM ID-jevi: `#sidebar`, `#topbar`, `#main-content`, `#game-select`, `#cpu-val`, `#ram-val`; sidebar dugmad `data-screen="screen-game|screen-simulations|screen-strategy-hub"`.

- [ ] **Step 1: Napiši `tests/sysmon.test.js`** — `sample(null).cpu === 0`; `sample(prevRaw)` posle 100 ms busy petlje daje `cpu` u `[0,100]`, `ramTotalGb > 0`, `ramUsedGb <= ramTotalGb`; nikad `NaN`.
- [ ] **Step 2: Run** `npm test -- tests/sysmon.test.js` → FAIL.
- [ ] **Step 3: Implementiraj `main/sysmon.js`** (delta idle/total preko svih jezgara). Poveži u `main.js`: start kad je prozor `ready-to-show`, stop na `closed`; kanali `sys:stats`, `sys:monfast`, `sys:hardware` u `ipc.js`; metode u `preload.js`.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Layout** — `index.html`: `<nav id="sidebar">` (3 dugmeta sa emoji 🎮 📈 🗂️ + labela), `<header id="topbar">` („GAMBIT“ levo; `<select id="game-select">` DICE/MINES/KENO; desno `CPU: <span id="cpu-val">--</span>%` i `RAM: <span id="ram-val">--</span> GB`), `<main id="main-content">` sa privremenim tekstom „Ekrani u fazi izrade“. `layout.css`: grid `72px 1fr` / `56px 1fr`, fiksni sidebar/topbar, `body {overflow:hidden}`, hover na dugmad (`background: #273449`).
- [ ] **Step 6: Renderer** — `mountSidebar` loguje klik; `mountTopbar` puni CPU/RAM iz `onSysStats` i `setGame` na promenu selecta (log u konzoli).
- [ ] **Step 7: Vizuelna provera** — Run: `./gambit.sh & sleep 4; import -window "$(xdotool search --name '^Gambit$' | head -1)" /tmp/claude-1000/…/scratchpad/f1-t3.png; pkill -f 'gambit.*electron'` → pogledaj sliku: sidebar levo, topbar gore, CPU/RAM brojevi se menjaju (dva snimka u razmaku 2 s daju različite vrednosti ili bar nisu `--`).
- [ ] **Step 8: Commit** — `commit_local.sh gambit "feat(korak02): sysmon (CPU/RAM push), sidebar + topbar layout, izbor igre"`.

### Task 4: SPA ruter i tri ekrana (korak 03)

**Files:**
- Create: `src/js/router.js`, `src/css/screens.css`
- Modify: `src/index.html`, `src/js/renderer.js`, `main.js` + `main/ipc.js` + `preload.js` (smoke self-test kanal `sys:smoke-report`)
- Test: `tests/smoke.test.js` (proširi)

**Interfaces:**
- Produces: `router.js`: `switchScreen(screenId) → boolean` (false + `console.warn` za nepoznat ID; nikad ne ostavlja 0 aktivnih), `currentScreen()`, `initRouter({default:'screen-game'})`. Sekcije `#screen-game`, `#screen-simulations`, `#screen-strategy-hub` sa klasom `.screen`; aktivna `.screen.active` (opacity tranzicija 180 ms); sidebar dugme `.active`.
- Smoke self-test: renderer u `--smoke` režimu (Main šalje `sys:smoke` flag u `ping` odgovoru) izvrši `switchScreen` na sva 3 + na `'nema'`, i pošalje `sys:smoke-report {ok, errors[]}`; Main ispisuje `SMOKE OK` samo ako `ok` i nema `console.error` (hvata `console-message` level ≥ 2).

- [ ] **Step 1: Proširi `tests/smoke.test.js`** — dodatni `assert.match(r.stdout, /ROUTER OK/)`.
- [ ] **Step 2: Run** `npm test -- tests/smoke.test.js` → FAIL.
- [ ] **Step 3: Implementiraj** `router.js`, tri `<section>` sa `<h1>` naslovima („Ekran za Igru“, „Simulacije i Analitika“, „Strategy Hub (Biblioteka)“) i praznim kontejnerima, `screens.css`, sidebar klik → `switchScreen`, aktivna klasa na dugmetu (`.active` = svetlija pozadina + zelena linija levo `box-shadow: inset 3px 0 0 var(--green)`), smoke self-test + `console-message` hvatanje u Main-u.
- [ ] **Step 4: Run** `npm test` → PASS (`SMOKE OK`, `ROUTER OK`).
- [ ] **Step 5: Vizuelna provera** — 3 screenshot-a (po jedan klik preko `xdotool key`/klik na sidebar ili pozivom preko `--dev` konzole nije potreban: pokreni sa `--screen=screen-simulations` argumentom koji Main prosledi rendereru kroz `ping` odgovor). Očekivano: naslov se menja, aktivno dugme ima zelenu liniju.
- [ ] **Step 6: Commit** — `commit_local.sh gambit "feat(korak03): SPA ruter, tri ekrana, fade tranzicija, smoke self-test"`.

### Task 5: Troslojna struktura ekrana igre (korak 04)

**Files:**
- Create: `src/css/game.css`
- Modify: `src/index.html` (`#screen-game`)

**Interfaces:**
- Produces DOM: `#game-left-panel` (`#panel-mode-tabs`, `#panel-input-fields`, `#panel-action-buttons`), `#game-center-panel` (`#panel-game-render`, `#panel-live-chart`), `#game-right-panel` (`#panel-live-balance`, `#panel-profit-notes`, `#panel-streak-counters`). Grid `minmax(280px,27%) 1fr minmax(260px,25%)`, `height:100%`, `overflow:hidden`; paneli `background: var(--panel)`, `border:1px solid var(--border)`, `border-radius:8px`, unutrašnji pod-kontejneri sa isprekidanom ivicom (privremeno) i labelom ID-ja.

- [ ] **Step 1: Napiši HTML + `game.css`.**
- [ ] **Step 2: Proširi smoke self-test** — renderer proverava da svih 9 ID-jeva postoji i da su tri panela u istom redu (`getBoundingClientRect().top` jednak) → dodaje u `sys:smoke-report`; Main ispisuje `LAYOUT OK`. `tests/smoke.test.js`: `assert.match(r.stdout, /LAYOUT OK/)`.
- [ ] **Step 3: Run** `npm test` → PASS.
- [ ] **Step 4: Vizuelna provera** — screenshot na 1280×800 i posle `xdotool windowsize <id> 1600 900` → kolone drže proporcije, bez skrol traka.
- [ ] **Step 5: Commit** — `commit_local.sh gambit "feat(korak04): troslojni layout ekrana igre (levo/sredina/desno)"`.
- [ ] **Step 6: Dev-log faze** — `~/ai/ai_workplace/scripts/devlog_commit.sh --title "Gambit — Faza 1 skelet (koraci 01–04)" --summary "Electron kostur, launcher+desktop, sysmon topbar, ruter, 3-kolonski layout" --domain gambit`; ažuriraj `docs/plans/README.md` status Faze 1 → „gotovo“.
