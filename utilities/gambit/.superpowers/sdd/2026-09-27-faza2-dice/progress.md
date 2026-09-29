# SDD ledger — plan: docs/plans/2026-09-27-faza2-dice.md

Ruling (Task 0): ceo projekat ESM — cost if wrong: require() nedostupan u Main-u.
Task 0: complete (commits b45f9f5, tests: npm test → 7/7 pass)
Task 1: complete (commits ece54a4, tests: npm test → 13/13 pass; screenshot: slider crveno/zeleno, 3 vezana polja, ½/2×)
Task 1: Ruling: isplata koristi multiplikator zaokružen na 4 decimale (kao UI prikaz) — cost if wrong: razlika ≤ 0.00005·ulog po krugu.
Task 2: complete (commits 3343895, tests: npm test → 20/20 pass; screenshot desnog panela)
Task 3: complete (commits 1bcbfc0, tests: npm test → 30/30 pass)
Task 3: Ruling: RNG ishod = (u % 10000)/100 (2 decimale, 10.000 ishoda), ne spec-ovo % 1e6/1e4 (4 decimale) — spec §3.3 ispravljen — cost if wrong: drugačija granularnost od Stake-a (Stake: 0.00–100.00).
Final review F1 (opus reviewer): fixed Important 1–5 (--no-sandbox uklonjen, initRouter fallback + self-test, --smoke-timeout= (60s) + 250ms drain, requestSingleInstanceLock, setWindowOpenHandler/will-navigate); fixed minors 8,11,12,15,16,18,19,20; smoke test jedno pokretanje (13).
Final: minor (deferred): 6 asinhrone greške posle drain-a; 7 onSysStats sada vraća unsubscribe (topbar ga ne koristi); 9 sysmon lifecycle whenReady/before-quit; 10 maxAllowed=min(14,cpus-2) (ruling: rezerva 2 niti po spec §3.6/korak 30); 14 launcher test radi npm ci u tmp (namerno, keš); 17 data/*.json ignore; 21 state pub/sub — sada ima pretplatnike.
Task 4: complete (commits 64e4e71, tests: npm test → 31/31 pass; screenshot: 6 krugova, bljesak 39.08, bedževi, grafikon)
Task 5: complete (commits ca03345, tests: npm test → 37/37 pass; screenshot: auto Martingale 61 krugova uživo, crveno dugme ZAUSTAVI)
Task 6: complete (commits 78695cc, tests: npm test → 46/46 pass; screenshot: Sačuvaj kao + lista u Auto panelu, levi panel skrolabilan)
Task 6: Ruling: sanitizeName uklanja vodeće/prateće "_" (smoke ime promenjeno u smoke_dice) — cost if wrong: nijedan.
Task 7: complete (commits 39bf777, tests: npm test → 57/57 pass; runner 2 niti determinističan, otkazivanje radi)
Task 7: Ruling: Monte Carlo sesija primenjuje SAMO pravila uloga (onLoss/onWin), ne maxBets/takeProfit/stopLoss — spec korak 11: sesija ide do bankrota ili 1000× — cost if wrong: Tier e odražava korisnikove stop uslove.
Task 7: Ruling: budžet 100 (index 0) je reprezentativna sesija za marker grafikon — cost if wrong: nijedan.
Task 8: complete (commits 04f2830, tests: npm test → 58/58 pass; puna simulacija u app: 12000 sesija, 49.8M krugova, 43.6 s, 1.14M krug/s, 14 niti; screenshot f2-t8d)
Task 8: Ruling: simulacija troši kontinuirani HMAC tok (rng.next, 8 ishoda po digestu) umesto roll() po krugu — 7× manje heševanja, isti HMAC-SHA256 izvor — cost if wrong: nonce po krugu nije 1:1 kao u živoj igri.
Task 8: Ruling: progres poruke prigušene na 150 ms (PROGRESS_MIN_MS) — cost if wrong: nijedan.
Nalaz (za Fazu 7): Electron-ov Node slabije skalira worker_threads (14 niti: 0.96M/s vs 3.1M/s u sistemskom Node-u; 1 nit podjednako) — kandidat: utilityProcess ili child_process sa sistemskim node-om.
Faza 2: zatvorena a2f0c58. Ruling: smoke self-test koristi nasumično ime strategije (node --test pokreće smoke i launcher fajlove paralelno → 2–3 Electron-a nad istim data/) — cost if wrong: zaostali smoke_* fajlovi ako se test prekine.
Final review F2 (opus): fixed Important 1 (over: roll ≥ target; test countWins over==under), Important 2 (loop: stopRequested na vrhu + prekid sleep-a + stopAndWait; game_host await unmount; test auto_loop), Important 3 (simulator/options.js normalizacija + validateStrategy; session NaN/≤0 guard; test sim_options/session); fixed minors 1 (delete ok===true), 3 (hybrid.js stub), 4 (push bez spread-a), 6 (chart decimacija 4000), 7 (prazan multiplier), 8 (resetStats balans 0), 10 (plan RNG tekst).
Final: minor (deferred): 2 prepisivanje istoimene strategije bez potvrde; 9 cancel ne čeka terminate; 5 balans je u rendereru (Ruling: sesija/balans žive u rendereru po spec §3.7 — Main validira oblik; cost if wrong: renderer može lagati sam sebi, nema pravog novca).
suite: npm test → 77/77 (81ed7f9)
