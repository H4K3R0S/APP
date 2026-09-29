# SDD ledger — plan: docs/plans/2026-09-27-faza1-skelet.md

Spec: docs/specs/2026-09-27-gambit-design.md (pročitan). Izvršenje: nativno, autonomno.
Ruling (setup): rad direktno na `master` novog repoa (nema ničeg za zaštitu; korisnik tražio autonomnu izgradnju) — cost if wrong: ništa, repo je nov.
Ruling (setup): ledger vodim ručno (bez sdd-workspace/task-start skripti) da uštedim tool-pozive po ZAKONU efikasnosti — cost if wrong: nema automatske provere formata.
Pre-flight: Task1→Task4 (ping odgovor dobija `smoke`/`screen` polja — kompatibilno, proširenje objekta); Task3→Task4 (sidebar `data-screen` = ID sekcija — usklađeno). Bez konflikata.
Task 1: complete (commits 0842939, tests: npm test → 1/1 pass)
Task 2: complete (commits 958fb8f, tests: npm test → 3/3 pass; Desktop trusted=true)
Task 3: complete (commits 74bc27e, tests: npm test → 5/5 pass; screenshot: CPU 60.3→59.1 menja se)
Task 3: Ruling: Electron default menu bar sakriven (Menu null + autoHideMenuBar) — Stake stil nema meni — cost if wrong: nema prečica iz menija (DevTools kroz --dev).
Task 4: complete (commits 7d59007, tests: npm test → 6/6 pass; screenshot --screen=screen-simulations: naslov + zelena linija na aktivnom dugmetu)
Task 4: Ruling: smoke broji samo console level 3 (error), ne warn — namerni warn za nepoznat ekran je deo self-testa — cost if wrong: upozorenja ne obaraju smoke.
Task 5: complete (commits 84a3c5a, tests: npm test → 7/7 pass; screenshot 1280x800 i 1600x900: 3 kolone drže proporcije)
Task 5: Ruling: uklonjen height:100% sa #screen-game (absolute inset već daje visinu; prelivalo je 24px) — cost if wrong: nijedan.
