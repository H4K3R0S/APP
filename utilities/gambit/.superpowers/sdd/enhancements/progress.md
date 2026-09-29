# SDD ledger — plan: dopune (korisnički zahtevi posle Faze 7)

Zahtevi:
- A1 unos balansa za igru (setBalance)
- A2 veliki zeleni prikaz pogotka (multiplikator + zarada) u centru
- A3 zvuk na pogodak/promašaj za Mines i Keno (ne Dice)
- A4 strategija pamti početni balans + ulog
- A5 dugme „Odigraj 1 krug" + ispod „Pokreni Auto igru"
- A6 reset grafikona tokom igre
- A7 Mines: prikaz multiplikatora pri obeležavanju polja
- A8 Keno: Auto play (provera/popravka)
- B1 Napredni editor strategije (pop-up „Napredna opklada") + minimalistički Auto prikaz

## Napredak
- A1/A4 shared: setBalance (session_stats) + startBalance (strategy_schema, describe) — GREEN (tests/balance_strategy.test.js, 3 testa).
- Faza A complete (commit 11f99a5): A1 unos balansa (live_stats), A2 win_flash, A3 sound Mines/Keno, A6 reset grafikona (chart-reset-btn). npm test → 144/144. Smoke 27/27 OK, screenshot potvrđen.
- Faza B complete (commit 80e6464): B1 pop-up „Napredna opklada" (strategy_editor) + minimalistički Auto (auto_panel) + engine uslova (shared/conditions.js, 9 testova); A5 dugme „Odigraj 1 krug" iznad „POKRENI AUTO IGRU"; A7 Mines multiplikator pri obeležavanju polja; A8 Keno auto radi (isti novi panel); 3 brzine (Normalno/Brzo/Bez animacije); A4 startBalance u collect. npm test → 153/153, smoke 27/27. Screenshot potvrđen (panel + pop-up + win-flash).
- Ruling: strategije sa uslovima žive u živoj Auto petlji potpuno; Monte Carlo simulator koristi izvedena prosta pravila (deriveSimpleRules) — tačno za Martingale (svaki gubitak→increase, svaka pobeda→reset), ali složeni uslovi (npr. „svaki 3. gubitak", set/add/subtract) se u simulaciji aproksimiraju. Cena ako pogrešno: preporuka balansa iz simulacije manje precizna za složene strategije. Puni condition-engine u simulatoru je odložen (veći zahvat u worker/hybrid).
- Odloženo: sound i win-flash rade i za Dice? Ne — Dice bez zvuka (po zahtevu); win-flash važi za sve igre.
