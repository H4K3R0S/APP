# Gambit

Lokalni desktop simulator online kazino igara (Dice, Mines, Keno) u Stake stilu: virtuelni
balans, provably-fair RNG (HMAC-SHA256), ručno i automatsko igranje, strategije kao JSON,
masovne Monte Carlo simulacije u zasebnim radnim procesima, Multi-Strategy sekvencer i
Strategy Hub.

Nema veze sa pravim kazinom ni pravim novcem.

## Pokretanje

- Dvoklik `Gambit.desktop` (Desktop / meni aplikacija) ili `./gambit.sh`.
- Razvoj: `./gambit.sh --dev` (DevTools). Testovi: `npm test` (jedinični + Electron smoke self-test).
- Instalacija prečice posle premeštanja repoa: `./scripts/install_desktop.sh`.

## Šta ima

| Ekran | Funkcije |
|---|---|
| 🎮 Igra | Dice (slider, over/under), Mines (5×5, cash out), Keno (40 brojeva, izvlači se 10, 4 nivoa rizika); Manual/Auto tabovi; pravila na gubitak/dobitak (Martingale), stop uslovi; Live Stats (balans, W/L, nizovi, roll history, milestones); grafikon profita |
| 📈 Simulacije | Monte Carlo: 12 budžeta × 1000 sesija, 5 Tier nivoa (1.5×…1000×), grafikon po budžetu, AI preporuka minimalnog balansa; Multi-Strategy sekvencer (AKO loss streak / pad balansa ➔ PREBACI NA …) sa marker-grafikonom; kontrola radnika (1–14, procesi ili niti) i benchmark kartica sa istorijom |
| 🗂️ Hub | Biblioteka svih strategija (kartice, pretraga, filter po igri), rangiranje po Tier 3 uspešnosti (🌟 Preporučeno > 70%), bočni panel sa pravilima i kartonom rizika, „Učitaj u ekran igre“, Obriši, Izvezi |

Mines auto ima hibridne okidače rotacije polja (Mirror / Invert / Random; odmah ili posle N
uzastopnih dobitaka/promašaja). Keno auto ima „Sidro“ strategiju (top 3 najučestalija + 7
popune: Random ili Cold Numbers) i toplotnu mapu učestalosti.

## Struktura

- `main.js`, `preload.cjs`, `main/` — Main proces (prozor, sysmon, IPC, Mines sesija, storage, simulator: runner/worker/session/engines/hybrid, benchmark log).
- `shared/` — čista matematika i šeme (dice/mines/keno engine-i, RNG, pravila uloga, strategije, hibrid, rangiranje, opisi).
- `src/` — renderer (HTML/CSS/ES-moduli, bez bundlera): `games/{dice,mines,keno}`, `sim/`, `hub/`, `stats/`, `chart/`.
- `data/<igra>/` — sačuvane strategije i `<ime>_analiza.json` (van gita); `data/benchmark.jsonl`.
- `docs/specs`, `docs/plans` — dizajn i planovi po fazama; `.superpowers/sdd/*/progress.md` — ledger odluka.

## Performanse (Ryzen 7 5700X, 14 radnika)

Dice ~3M krugova/s, Mines ~1.8M/s u aplikaciji. Radnici su zasebni procesi
(`child_process.fork` + `ELECTRON_RUN_AS_NODE`) jer Electron-ove worker niti slabo skaliraju;
režim „Worker niti“ ostaje kao poređenje.
