# SDD ledger — plan: docs/plans/2026-09-27-faza7-benchmark.md

Task 1: complete (commits 3d79318, tests: npm test → 136/136 + smoke BENCH; puna Martingale simulacija u app: 12000 sesija, 49.4M krugova, 5.1 s, 9.6M krug/s, 14 procesa; screenshot f7-b/f7-c)
Task 1: Ruling: stabilnost se meri kašnjenjem event-loop-a Main procesa (tajmer 50 ms, >100 ms = propušten frejm, ≥95% = Stabilno), ne razmacima progres poruka (bursty sa 14 radnika → lažno Seckanje) — cost if wrong: renderer kašnjenje se ne meri direktno.
Faza 7 zatvorena. SVIH 30 KORAKA IZGRAĐENO.
Final review F5–7 (opus): fixed C1 (saveStrategy: solo↔multi prepis odbijen, prepis istog tipa briše staru analizu; test), I2 (sim_page prati strategies-changed; smoke), I3 (injector zaustavlja petlju iste igre; smoke), I4 (krug prelaska ne primenjuje pravilo uloga — nasleđeni ulog ulazi u sledeći krug, handovers.nextBet; testovi), I5 (data/*.jsonl gitignored, benchmark.jsonl uklonjen iz gita); minors 6 (limit clamp), 7 (dice akcija označena informativno), 8 (redovi sekvencera se brišu pri promeni igre), 9 (segment > umesto ≥), 11 (panel se ponovo puni/zatvara na refresh + generation guard), 12 (openSeq guard), 14 (dup preporuka), 16 (balanceDrop max 100), 17 (spec §3.1/§3.2 beleške).
Final: minor (deferred): 10 showReport ne gleda pod-tab; 13 brisanje strategije koju hibrid referencira (greška tek pri pokretanju); 15 levi panel klipovan na 1024px; jsonl neograničen.
suite: npm test → 141/141 (3b587ac)
