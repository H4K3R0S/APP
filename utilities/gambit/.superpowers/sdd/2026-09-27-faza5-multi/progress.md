# SDD ledger — plan: docs/plans/2026-09-27-faza5-multi.md

Pre-flight: session.js već poziva hybrid.check (Faza 2 stub) → puna logika; engine.onHandover novi hook (mines/keno), dice bez hook-a → init; runner prosleđuje hybridConfig sa REŠENIM strategijama — usklađeno.
Task 1: complete (commits 246b513, tests: hybrid_schema 2/2)
Task 1: Ruling: hybridStrategy ne koriguje tiho loš `when` (validateHybrid ga prijavljuje) — cost if wrong: nijedan.
Task 2: complete (commits 246b513, tests: hybrid 5/5 + session/runner hibrid; 29/29 u paketu)
Task 2: Ruling: prebacivanje na baznu strategiju je dozvoljeno (ponovno učitavanje pravila); Keno handover zadržava istoriju sesije (sidra imaju smisla samo sa istorijom), Mines dobija polja nove strategije — cost if wrong: nijedan.
Task 3: complete (commits a374892, tests: npm test → 122/122 + smoke SEQUENCER/SIM_HYBRID; puna hibridna simulacija u app: 12000 sesija, 966M krugova, 109 s (8.9M krug/s), handoversAvg 0.89; screenshot f5-c/f5-d)
Task 3: Ruling: u Multi režimu tier/grafikon/rizik paneli su skriveni dok nema izveštaja (sekvencer dobija ceo prostor) — cost if wrong: nijedan.
Task 3: Ruling: hibrid se pre pokretanja ČUVA kao type:multi strategija u data/<game>/ (Hub ga lista; solo select ga prepoznaje ⛓) — cost if wrong: dodatni fajl po pokretanju (isto ime = prepis).
Faza 5 zatvorena.
