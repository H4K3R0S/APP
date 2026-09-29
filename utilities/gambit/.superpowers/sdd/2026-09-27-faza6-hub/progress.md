# SDD ledger — plan: docs/plans/2026-09-27-faza6-hub.md

Pre-flight: list-all (Task1) → hub.js (Task2) → panel (Task3) → injector koristi strategy.apply po igri (Faze 2–5) — usklađeno.
Task 1: complete (commits 27ea2e6, tests: ranking 2/2 + storage list-all; 8/8 u paketu)
Task 2: complete (commits 6d45b11, tests: npm test → 124/124 + smoke HUB/HUB_RANK; screenshot f6-t2)
Task 3: complete (commits 0a37ebb, tests: npm test → 128/128 + smoke HUB_PANEL; screenshot f6-t3)
Task 4: complete (commits 0ea641e, tests: npm test → 133/133 + smoke HUB_INJECT; screenshot f6-t4)
Task 4: Ruling: hibrid iz Hub-a se učitava u sekvencer (Simulacije/Multi), ne u ekran igre — spec korak 29 pominje hibridne okidače u polju igre, ali živa auto petlja nema hibridni handover; simulacija je mesto gde hibrid radi — cost if wrong: korisnik očekuje hibrid uživo (moguća Faza 7+).
Faza 6 zatvorena.
