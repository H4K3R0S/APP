# Gambit — dizajn (spec)

Datum: 2026-09-27 · Autor: kalima + Claude · Status: odobreno (autonomna izgradnja)

Izvor zahteva: `~/ai/IDEJE/Gembler/` (30 numerisanih koraka + `atomic gambler`, `CISA Gambler.txt`,
6 referentnih slika Stake interfejsa). Ovaj dokument NE prepisuje tih 30 koraka; on fiksira
arhitekturu, odluke i ugovore koji važe kroz sve korake. Koraci ostaju izvor detalja i
kriterijuma uspešnosti.

## 1. Cilj i granice

**Gambit** je lokalni desktop simulator online-kazino igara (Dice, Mines, Keno) u Stake stilu,
sa virtuelnim balansom, provably-fair RNG-om, ručnim i automatskim igranjem, bibliotekom
strategija (JSON), masovnim Monte Carlo simulacijama u Worker Thread-ovima i Multi-Strategy
sekvencerom.

Van granica: bilo kakva veza sa pravim kazinom, pravim novcem ili nalozima. `vazno.txt` iz
IDEJE foldera nije deo aplikacije.

Korisnik: kalima, jedan korisnik, Kali Linux, Ryzen 7 5700X (16 niti), 32 GB RAM.

Uspeh: svaki od 30 koraka ispunjava svoj „Kriterijum uspešnosti“; aplikacija se pokreće
dvoklikom sa Desktopa; UI ostaje fluidan dok simulacija melje na 14 niti.

## 2. Odluke (razlike u odnosu na sirovi spec)

| Tema | Odluka | Zašto |
|---|---|---|
| Ime | **Gambit** (UI: „GAMBIT“), API most `window.gambitAPI` | korisnikova poslednja odluka; spec kaže „Gambler OS“ |
| Lokacija | `~/ai/APPS/utilities/gambit`, svoj git repo (`git_setup.py`) | ZAKON APPS strukture |
| Isporuka | `gambit.sh` launcher + `Gambit.desktop` (+ `~/Desktop`, trusted) + SVG/PNG ikona | ZAKON izvršnih aplikacija |
| Jezik koda | čist JS (CommonJS u Main/Worker, ES-moduli u rendereru), bez bundlera/TS | spec traži main.js/preload.js/renderer.js; nema build koraka |
| Grafikoni | **uPlot** (npm) | najlakši, canvas, decimacija nije potrebna do 100k tačaka |
| Podaci | `data/{dice,mines,keno}/` u korenu app-a, gitignored (`.gitkeep`) | podaci nisu kod; spec kaže `src/data` |
| Budžeti simulacije | svih **12** navedenih vrednosti ($1…$10.000) | spec kaže „11 nivoa“ ali nabraja 12 |
| Kraj sesije | bankrot ILI ≥1000× početnog ILI **gornja granica krugova** (podrazumevano 200.000) | garantovan završetak petlje |
| Worker pool | broj niti je parametar od prvog simulatora (korak 11), UI slajder tek u koraku 30 | izbegava refaktor |
| Auto-petlje uživo | u rendereru, sa vizuelnim kašnjenjem, krug po krug preko IPC-a | spec izričito traži |
| Balans | virtuelni, početni $1000, ne čuva se između pokretanja; „Resetuj statistiku“ postavlja novi početni | spec korak 06 |

## 3. Arhitektura

Tri hermetički odvojena sloja. Matematika igara i simulacija ne zavise od Electrona, pa ih
Worker niti i testovi koriste direktno.

```
Renderer (src/)  ──IPC (preload: window.gambitAPI)──▶  Main (main.js + main/)  ──worker_threads──▶  Workers
  UI, ruter, auto-petlje,                                 prozor, sysmon, IPC handleri,                simulator sesija
  grafikoni, stats                                        storage, engine sesije (Mines tabla)          (čista matematika)
                                                                     ▲
                                                          main/engines/*  main/simulator/session.js  (čisti Node moduli, bez Electrona)
```

### 3.1 Struktura fajlova

```
gambit/
├── package.json              main: main.js · start: electron . · test: node --test tests/
├── main.js                   BrowserWindow 1280x800, contextIsolation, učitava main/ipc.js
├── preload.js                contextBridge → window.gambitAPI (jedina IPC površina)
├── gambit.sh                 launcher: cd, DISPLAY/XAUTHORITY, npm install ako fali node_modules, electron .
├── Gambit.desktop            Exec=…/gambit.sh, Icon=…/assets/icon.png
├── assets/icon.svg|png       ikona (generisana, tamna podloga, zelena kockica + „G“)
├── main/
│   ├── ipc.js                registruje sve ipcMain.handle/on kanale (tanki omotači)
│   ├── sysmon.js             CPU% (delta os.cpus()) + RAM; push 'sys:stats' na 1500 ms (500 ms tokom simulacije)
│   ├── rng.js                provablyFair(serverSeed, clientSeed, nonce) → float 0.00–99.99; kursor bajtova; SHA256 hash seed-a
│   ├── engines/
│   │   ├── dice.js           chance↔multiplier↔target, resolveRoll()
│   │   ├── mines.js          generateBoard(M), multiplier(M,k) (kombinatorika), sesija: start/reveal/cashout
│   │   ├── keno.js           draw20(), hits, payout(picks, hits, risk)
│   │   └── keno_paytables.js tablice 1–10 izabranih × classic/low/medium/high
│   ├── storage.js            data/<game>/: list/save/load/delete strategije + *_analiza.json; sanitizacija imena
│   └── simulator/
│       ├── runner.js         worker pool (N niti), deli 12×1000 sesija, agregira, progres, piše analizu, benchmark
│       ├── session.js        playSession(game, strategy, budget, rng) → metrike; primenjuje pravila uloga, rotacije, sidro, hibridne okidače
│       ├── hybrid.js         executeStateHandover(session, nextStrategy) — prenos balansa/uloga
│       ├── analysis.js       agregacija u izveštaj + AI preporuka balansa
│       └── worker.js         parentPort: prima paket sesija, vrti session.js, šalje progres/rezultat
├── src/
│   ├── index.html            sidebar + topbar + #main-content sa 3 <section>
│   ├── css/                  global.css (tema/tokeni), layout.css, game.css, sim.css, hub.css
│   └── js/
│       ├── renderer.js       bootstrap: ruter, topbar, izbor igre, montiranje modula
│       ├── router.js         switchScreen(id) + .active + fade
│       ├── state.js          globalno stanje (aktivna igra, balans, sesija stats) + pub/sub
│       ├── ui/               topbar.js, sidebar.js, toast.js, dom.js (helperi)
│       ├── chart/profit_chart.js   uPlot omotač (zelena/crvena po znaku, markeri za hibrid)
│       ├── stats/live_stats.js     desni panel (zajednički za sve igre) + milestones + roll history
│       ├── games/
│       │   ├── dice/   ui.js  manual.js  auto.js  strategy_ui.js
│       │   ├── mines/  ui.js  manual.js  auto.js  shift.js  strategy_ui.js
│       │   └── keno/   ui.js  manual.js  auto.js  freq.js   strategy_ui.js
│       ├── auto/loop.js      zajednička asinhrona petlja (pravila uloga, stop uslovi, bankrot, abort)
│       ├── sim/              sim_page.js  tiers.js  budget_chart.js  sequencer.js  hybrid_chart.js  threads.js  benchmark.js
│       └── hub/              hub.js  panel.js  injector.js   (ranking.js i describe.js su u shared/)
├── data/{dice,mines,keno}/   korisničke strategije + analize (gitignored)
├── tests/                    node:test — rng, engines, paytables, session, hybrid, storage, analysis
└── docs/{specs,plans}/
```

### 3.2 IPC ugovor (`window.gambitAPI`)

Svi pozivi su `invoke` (Promise) osim push-kanala. Nazivi kanala su stabilni kroz sve korake.

| Metod | Kanal | Ulaz → Izlaz |
|---|---|---|
| `ping()` | `sys:ping` | → `{pong, ts}` |
| `onSysStats(cb)` | `sys:stats` (push) | `{cpu, ramUsedGb, ramTotalGb}` |
| `setSysMonFast(bool)` | `sys:monfast` | brži uzorak tokom simulacije |
| `rollDice({betAmount,targetValue,condition})` | `dice:roll` | → `{roll,isWin,profit,multiplier,nonce,serverSeedHash}` |
| `startMines({betAmount,minesCount})` / `revealMinesField(i)` / `cashoutMines()` | `mines:start/reveal/cashout` | tabla ostaje u Main-u; reveal → `{status:'diamond'|'lose', multiplier, nextMultiplier, profit, mines?}` |
| `playKeno({betAmount,selectedNumbers,riskLevel})` | `keno:play` | → `{drawnNumbers,hitNumbers,multiplier,profit,nonce}` |
| `listStrategies(game)` / `saveStrategy(game,obj)` / `loadStrategy(game,name)` / `deleteStrategy(game,name)` | `strategy:list/save/load/delete` | jedan generički set kanala za sve tri igre |
| `loadAnalysis(game,name)` | `analysis:load` | → izveštaj ili `null` |
| `runSimulation({game,strategyName,threads})` | `simulator:run` | pokreće pool; vraća `{jobId}` |
| `runSimulation({game, hybridConfig, threads, workerMode})` | `simulator:run` | hibrid ide istim kanalom (nema zasebnog `run-hybrid`; odluka Faze 5); `workerMode` processes/threads |
| `cancelSimulation(jobId)` | `simulator:cancel` | gasi workere |
| `onSimProgress(cb)` | `simulator:progress` (push) | `{jobId, pct, sessionsDone, tiers:[5], budgets:[...], etaSec}` |
| `onSimDone(cb)` | `simulator:done` (push) | `{jobId, analysisFile, benchmark}` |
| `getHardware()` | `sys:hardware` | `{threads, maxAllowed: min(14, threads−2), recommended, reserved}` (rezerva 2 niti za sistem/UI) |

Renderer nikad ne dobija Mines tablu pre kraja runde. Nema `nodeIntegration`.

### 3.3 RNG (provably fair)

`rng.js` implementira Stake šemu: `HMAC-SHA256(serverSeed, clientSeed:nonce)`; po 4 bajta → uint32;
odbacivanje radi uniformnosti: ako je uint32 ≥ 4.294.960.000 (= 429496 · 10.000, najveći
umnožak ispod 2^32) uzmi sledeća 4 bajta (kad se 32 bajta potroše, novi heš sa `:nonce:round`);
rezultat `(uint32 % 10_000) / 100` u [0.00, 99.99] — tačno 10.000 jednako verovatnih ishoda sa
2 decimale. (Spec-ova formulacija „% 1.000.000 / 10.000, veći od 999.999“ je nekonzistentna:
daje 4 decimale, a uint32 je skoro uvek > 999.999; ovo je ispravna primena iste ideje.) Za Mines i Keno isti heš hrani Fisher-Yates
mešanje (jedan bajt-kursor po rundi; kad se potroši, `nonce`-podheš `:round:i`). Main drži
`serverSeed` (crypto.randomBytes 32) i `clientSeed` (`gambit_seed`), po igri svoj `nonce`.
Worker-i dobijaju svoj `serverSeed` po sesiji (deterministički iz seme posla, radi
reproduktivnosti).

### 3.4 Matematika igara

- **Dice:** house edge 1% → `multiplier = 99 / chance`; chance ∈ [2, 98] (2 decimale);
  `over`: target = 100 − chance, win ako roll **≥** target; `under`: target = chance, win ako roll < target.
  (Sa tačno 10.000 ishoda 0.00–99.99 oba smera imaju tačno chance·100 dobitnih ishoda; strogo „>“ bi
  over-u oduzeo jedan ishod — ispravka iz pregleda Faze 2.)
- **Mines:** `mult(M,k) = 0.99 · C(25,k) / C(25−M,k)`; M ∈ [1,24]; cashout dozvoljen kad k ≥ 1.
- **Keno:** tabla 40 brojeva, izvuci 10 (Stake standard; korisnik 2026-09-27 — spec fajlovi su pisali 80/20); multiplikator iz tablice `[risk][picks][hits]`; 10-pick classic i high
  tačno po spec-u; ostale tablice u `keno_paytables.js` (editabilne, jedan izvor istine).
  Riziki: classic, low, medium, high. `profit = bet·mult − bet`.

### 3.5 Strategija (JSON, `data/<game>/<ime>.json`)

Zajednička polja: `game, strategyName, type ('solo'|'multi'), createdAt, baseBet, maxBets,
onLoss{action:'reset'|'increase', value}, onWin{...}, stopConditions{takeProfit, stopLoss}`.
- Dice: `targetValue, condition, winChance`.
- Mines: `minesCount, selectedFields[], shift{onWin:{mode:'stay'|'now'|'after', count}, onLoss:{...}, algo:'mirror'|'invert'|'random'}`.
- Keno: `riskLevel, selectedNumbers[], anchor{enabled, fillMode:'random'|'cold'}`.
- Multi (`type:'multi'`): `baseStrategy, triggers:[{when:'lossStreak'|'balanceDrop', value, switchTo, actions{minesShift?, kenoSwapAnchors?, diceRaiseMultiplier?}}]`.

Ime fajla = sanitizovano `strategyName` (`[A-Za-z0-9_-]`, max 60). Analiza: `<ime>_analiza.json`
pored strategije (isto ime za sve igre; folder već razdvaja igre).

### 3.6 Simulator (Monte Carlo)

- Posao = `{game, strategy, budgets:[12], sessionsPerBudget:1000, threads, maxRoundsPerSession}`.
- `runner.js` napravi `threads` workera; svaki dobije ravnomeran paket `(budget, sessionIndex)` parova;
  worker vrti `session.js` i na svakih 50 sesija (ili 5000 krugova) šalje progres.
- `session.js` je JEDNA implementacija za sve igre i za hibrid: petlja `while(alive)`:
  odigraj krug (engine), primeni rezultat, ažuriraj streak/tier, proveri hibridne okidače
  (`hybrid.js`), primeni pravilo uloga, proveri bankrot (sledeći ulog > balans), 1000×, cap.
- Metrike sesije: `maxMultiple` (za Tier 1.5/2/5/10/1000×), `maxLossStreak`, `rounds`, `outcome`,
  `handovers[]` (krug, strategija, balans). Reprezentativna sesija (prva sesija budžeta $100)
  čuva decimiranu seriju profita za marker-grafikon.
- Izveštaj (`analysis.js`): po budžetu `% Tier1..5, % bankrot, avg krugova, max loss streak`;
  ukupno `maxLossStreak`, `tier3Avg` (prosek po budžetima; Hub rang), `tier5Avg`,
  `recommendedBalance(baseBet=1)` = Σ_{i=0..L} 1·(1+p/100)^i (za `increase`), ili `L+1` (za `reset`);
  benchmark `{durationMs, roundsTotal, roundsPerSec, threads}`.
- Otkazivanje: `worker.terminate()` na sve; delimičan izveštaj se ne piše.

### 3.7 Renderer

- Ruter: display-toggle tri `<section>`, `.active` na sidebar dugmetu, fade 180 ms.
- `state.js`: `{game:'dice'|'mines'|'keno', balance, initialBalance, bets, wins, losses,
  lossStreak, maxLossStreak, history[], milestones}` + `subscribe()`. Balans je jedan za sve
  igre (kao pravi kazino wallet); promena igre ne resetuje statistiku.
- `auto/loop.js`: generička petlja `runAutoLoop({playRound, applyResult, rules, delayMs, onStop})`;
  igre daju samo `playRound` (Dice: jedan roll; Mines: start→reveal…→cashout; Keno: play).
- Live chart: uPlot, x = redni broj kruga, y = kumulativni profit; boja po znaku; hibrid:
  serija po strategiji + vertikalni markeri sa tooltip-om.
- Virtuelizacija (ZAKON): roll history drži zadnjih 10; Hub mreža i liste renderuju
  vidljivo + 10% i dopunjavaju na skrol kada pređu 60 kartica.

### 3.8 Greške

- IPC handleri hvataju izuzetke i vraćaju `{error: 'poruka'}`; renderer prikazuje toast.
- Validacija ulaza (ulog ≥ 0.001, chance ∈ [2,98], M ∈ [1,24], 1–10 keno brojeva, ulog ≤ balans)
  i u rendereru (UX) i u Main-u (istina).
- Worker crash → runner prijavi `simulator:done {error}` i ugasi ostale.
- Nepostojeći/pokvaren JSON u `data/` → preskoči uz upozorenje u konzoli, ne ruši Hub.

### 3.9 Testiranje i verifikacija

- `node --test tests/` (bez Electrona): RNG determinizam i raspodela (χ² grubo), Dice
  ivice (2/98), Mines kombinatorika (poznate Stake vrednosti npr. M=3,k=1 → 1.1250), Keno
  jedinstvenost 20 brojeva + tablice, session terminacija (cap), hibridni handover čuva balans/ulog,
  analysis preporuka.
- Vizuelno: pokrenuti `electron .` na :0 i slikati prozor (OKO IPC ili `import`), po koraku.
- DevTools konzola bez grešaka kao kriterijum (`--dev` flag otvara DevTools).
- QA: `qa.py` (ruff/bandit nisu za JS) → koristi se `node --test` + `verify.py` unos u `apps.json`.

## 4. Faze (mapiranje na 30 koraka)

| Faza | Koraci | Isporuka |
|---|---|---|
| 1 Skelet | 01–04 | Electron + preload + sysmon topbar + sidebar + ruter + 3 kolone; launcher/desktop/ikona; git |
| 2 Dice | 05–12 | UI, live stats, RNG, manual, auto, strategije, worker pool, sim stranica |
| 3 Mines | 13–17 | grid, engine, manual, auto, rotacije, sim |
| 4 Keno | 18–22 | tabla 80, engine+tablice, frekvencije/sidro, auto, sim |
| 5 Multi | 23–25 | sekvencer UI, hybrid handover, hibridni worker + marker grafikon |
| 6 Hub | 26–29 | kartice+filteri, rangiranje, bočni panel, injector |
| 7 Benchmark | 30 | thread slajder, benchmark kartica, brži sysmon |

Svaki korak: implementacija → testovi → screenshot/kriterijum → `commit_local.sh` → dev-log unos.
