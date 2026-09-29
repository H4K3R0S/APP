// Smoke test: JEDNO pokretanje Electron-a u --smoke režimu; renderer preko preload mosta zove sys:ping
// (SMOKE OK), pa izvršava self-test i prijavljuje provere ("<KEY> OK"). Proces se gasi sa kodom 0.
import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, '..');
const ELECTRON = path.join(ROOT, 'node_modules', '.bin', 'electron');

export function runSmoke(extraArgs = [], timeout = 90000) {
  return spawnSync(ELECTRON, ['.', '--smoke', ...extraArgs], {
    cwd: ROOT,
    timeout,
    encoding: 'utf8',
    env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0.0' },
  });
}

const r = runSmoke();
const detail = () => `status=${r.status}\nstderr=${r.stderr}\nstdout=${r.stdout}`;

test('electron --smoke: proces se gasi sa kodom 0 (nema FAIL/SMOKE ERROR linija)', () => {
  assert.strictEqual(r.status, 0, detail());
  assert.doesNotMatch(r.stdout + r.stderr, /FAIL|SMOKE ERROR/, detail());
});

const CHECKS = [
  ['SMOKE OK', 'IPC ping prolazi (preload most)'],
  ['ROUTER OK', 'ruter prebacuje sva 3 ekrana, odbija nepoznat ID, fallback za loš podrazumevani'],
  ['LAYOUT OK', 'ekran igre: 3 kolone, 9 ID-jeva, bez skrola'],
  ['DICE_UI OK', 'Dice UI: slider/inputi/½/2x/over-under matematički vezani'],
  ['STATS OK', 'live stats: brojači, bedževi, milestone, reset'],
  ['RNG OK', 'dice:roll IPC: ishod, nonce raste, odbija ulog > balans'],
  ['DICE_MANUAL OK', 'ručno igranje: 3 kruga → stats 3, grafikon 4 tačke, bedževi; ulog > balans → toast'],
  ['DICE_AUTO OK', 'auto petlja: maxBets 20 Martingale → tačno 20 krugova, dugme/inputi vraćeni; stop usred rada'],
  ['STRATEGY_IO OK', 'IPC storage: save → list → load puni UI → delete; select popunjen'],
  ['SIM_PAGE OK', 'stranica Simulacije: mala simulacija (3 sesije × 12 budžeta, 2 niti) → tier %, preporuka, analiza fajl'],
  ['MINES_UI OK', 'Mines UI: 25 polja, select mina (3), ½/2×, profit = nextMultiplier × ulog'],
  ['MINES_MANUAL OK', 'Mines ručno: start → reveal do mine/22 dijamanta → stats +1, grafikon +1; reveal bez runde → error'],
  ['MINES_AUTO OK', 'Mines auto: 4 ugla, Martingale, maxBets 10 → tačno 10 krugova; strategija save/load (selectedFields)/delete'],
  ['MINES_SHIFT OK', 'Mines rotacija: onLoss now mirror → posle prvog gubitka polja su preslikana; shift se čuva u strategiji'],
  ['SIM_MINES OK', 'Simulacije za Mines: mala simulacija nad mines strategijom → izveštaj game=mines, tier %, analiza'],
  ['KENO_UI OK', 'Keno UI: 80 polja, izbor do 10 (11. odbijen), očisti, nasumično 10, risk menja tablicu'],
  ['KENO_MANUAL OK', 'Keno ručno: 3 broja → izvlačenje 20 (hit/miss na tabli), stats +1, grafikon +1; 0 brojeva → toast'],
  ['KENO_FREQ OK', 'Keno frekvencije: posle 5 krugova Top 3 sidro na ekranu = topAnchors; heat toggle boji tablu'],
  ['KENO_AUTO OK', 'Keno auto: sidro cold, maxBets 10 → 10 krugova, sidra zlatno na tabli; strategija save/load anchor/delete'],
  ['SIM_KENO OK', 'Simulacije za Keno: mala simulacija nad sidro strategijom → izveštaj game=keno, tier %, analiza'],
  ['SEQUENCER OK', 'Multi-Strategy sekvencer: pod-tab, 2 reda uslova → compile 2 okidača, ukloni → 1, bez uslova → prazan niz'],
  ['SIM_HYBRID OK', 'Hibridna simulacija: A (Martingale) → B na lossStreak 3; izveštaj type=multi, marker grafikon, analiza pod imenom hibrida'],
  ['HUB OK', 'Strategy Hub: kartice za sve igre, brojač, filter po igri, pretraga (i sa regex karakterima)'],
  ['HUB_RANK OK', 'Hub rangiranje: testirana strategija ispred netestiranih, preporučeno bedž samo >70%'],
  ['HUB_PANEL OK', 'Hub panel: klik kartice → .open, naslov/pravila/rizik ili „Podaci nedostupni“, zatvori, obriši → kartica nestaje'],
  ['HUB_INJECT OK', 'Učitaj u ekran igre: mines strategija dok dice auto radi → mines, Auto tab, 4 ugla, ulog; hibrid → Simulacije Multi sa sekvencerom; nevalidna → greška bez promene'],
  ['BENCH OK', 'Kontrola radnika: slajder max=maxAllowed, tekst Preporučeno, 2 radnika → report.threads 2, benchmark kartica, istorija, slajder zaključan tokom rada, 99 → klampovano'],
];

for (const [line, desc] of CHECKS) {
  test(`${line}: ${desc}`, () => {
    assert.match(r.stdout, new RegExp(line), detail());
  });
}
