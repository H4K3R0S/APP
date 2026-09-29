# SDD ledger — plan: docs/plans/2026-09-27-faza3-mines.md

Task 1: complete (commits 6bf6182, tests: smoke 12/12 + mines_math 3/3)
Task 2: complete (commits fad500d, tests: npm test → 68/68 pass; screenshot f3-t2: 7 dijamanata, eksplozija, ostale mine otkrivene)
Task 3: complete (commits 9f7ca56, tests: npm test → 70/70 pass; screenshot f3-t3: 4 ugla ljubičasto, auto 12 krugova, KESIRAJ 1.13$)
Task 3: Ruling: auto_fields.js + strategy_ui.js generalizovani za sve igre (Dice prebačen; DICE_AUTO/STRATEGY_IO smoke ostali zeleni) — cost if wrong: nijedan.
Task 4: complete (commits 73e970a, tests: npm test → 83/83 pass; smoke MINES_SHIFT: broj rotacija == broj gubitaka, mirror polja; screenshot f3-t4)
Task 4: Ruling: rotacije u živom auto modu koriste Math.random (nisu deo poštenog ishoda — tabla je u Main-u); simulator koristi HMAC tok — cost if wrong: živa rotacija nije reproduktivna.
Task 5: complete (commits 28f98f7, tests: npm test → 86/86 pass; puna Mines simulacija u app: 12000 sesija, 211.6M krugova, 118 s, 1.79M krug/s, 14 procesa; screenshot f3-t5c)
Task 5: Ruling: radnici simulacije su zasebni PROCESI (child_process.fork + ELECTRON_RUN_AS_NODE) umesto worker_threads — mereno: Electron worker niti 0.42M/s vs procesi 2.9M/s (Mines), 0.96 vs 3.35M/s (Dice); threads režim zadržan (workerMode) — cost if wrong: više RAM-a po radniku (~50 MB × 14), nalaz iz Faze 2 ledgera rešen.
Task 5: Ruling: generateBoard uzorkuje M različitih indeksa (ili komplement) umesto Fisher-Yates 25 — ista uniformna raspodela, ~8× manje rng poziva — cost if wrong: nijedan.
Final review F3 (opus): fixed C1 (mines:abort/state, unmount: cashout ako k≥1 inače abort, mount backstop abort; test mines_session + smoke), I2 (auto reveal-greška → abort + null), I3 (exit bez done → fail; test _testKillFirstWorkerOnProgress), I4 (before-quit abort jobs + worker disconnect exit), I5 (applyShift lanac mirror→vertikalno→random, null kad nema promene; testovi); minors 6 (profit_series decimacija sa testom), 7 (spec §3.4), 8 (count≥1 za after + validacija), 9 (guard mines IPC), 10 (execArgv []), 11 (generateBoard baca, multiplier M-provera prva), 13 (tests/mines_session.test.js), 15 (sameSet, random n=0/25 → null, jedan simulator job odjednom).
Final: minor (deferred): 12 radnik šalje sve sirove rezultate (limit 100k sesija/budžet; agregacija u radniku kad zatreba); 14 stop ne prekida kašnjenje između polja (≤1.1 s).
suite: npm test → 112/112 (3b2a3e5)
