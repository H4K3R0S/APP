# Gambit Faza 7 — Sistemski benchmark i kontrola niti (korak 30) — plan implementacije

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Korisnik na stranici Simulacije bira broj radnika (1–14, preporučeno = jezgra − 2), vidi benchmark posle svake simulacije (vreme, krugova/s, stabilnost), CPU/RAM u topbaru osvežavaju brže tokom simulacije, i može uporediti režime radnika (procesi vs. niti).

**Architecture:** Runner i IPC već primaju `threads` i `workerMode`; Main već prebacuje sysmon u brzi režim. Dodaje se: `sys:hardware` vraća i `recommended`; `simulator:run` prima `workerMode`; izveštaj `benchmark` dobija `stability` (procenat progres-poruka sa razmakom ≤ 2× očekivanog = „bez seckanja“) i `roundsPerSecPerWorker`; renderer `src/js/sim/threads.js` (slajder + status tekst) i `src/js/sim/benchmark.js` (kartica u AI panelu). Benchmark istorija u `data/benchmark.jsonl` (append) za poređenje.

**Tech Stack:** kao ranije.

**Spec:** `docs/specs/2026-09-27-gambit-design.md` (§3.2 `getHardware`, §3.6 benchmark)

## Global Constraints

- Slajder `#sim-threads` 1…`maxAllowed` (= min(14, cpus−2), hardkodovan gornji limit 14); status: „Dodeli N radnika (Preporučeno M) — K niti rezervisano za sistem“.
- `workerMode` select `#sim-worker-mode`: `processes` (podrazumevano) | `threads`; vrednost se šalje u `simulator:run` i vraća u `report.benchmark.workerMode`.
- Benchmark kartica `#sim-benchmark`: `Ukupno vreme obrade: X.XX s`, `Indeks brzine procesora: N krugova/sek`, `Po radniku: N/s`, `Status stabilnosti: Stabilno / Seckanje (N% propuštenih progres intervala)`, `Režim: procesi|niti × K`.
- `data/benchmark.jsonl`: red po simulaciji `{ts, game, strategy, threads, workerMode, durationMs, rounds, roundsPerSec, cpuThreads}`; `benchmark:history` IPC vraća poslednjih 20 (za mini tabelu ispod kartice).
- Sysmon: 500 ms tokom simulacije (već), 1500 ms inače; renderer prikazuje „⚡“ pored CPU dok je simulacija aktivna.
- Smoke ključ: `BENCH`.

## Review Focus

1. `threads` iz slajdera veći od `maxAllowed` (ručno izmenjen DOM) → Main klampuje (već `normalizeSimOptions`) i UI prikazuje stvarno dodeljen broj → Task 1 smoke.
2. `workerMode: 'threads'` mora i dalje raditi (regresija zaštitnog režima) → Task 1 test runner-a sa `threads` režimom.
3. `benchmark.jsonl` pokvaren red ne sme oboriti `benchmark:history` → Task 1 test storage-a.
4. Stabilnost sa 1 radnikom i kratkom simulacijom (< 2 progres poruke) → „n/a“, ne 0% → Task 1 test.
5. Promena slajdera tokom aktivne simulacije ne sme uticati na tekući posao → Task 1 (slajder `disabled` dok radi).

---

### Task 1: Kontrola radnika, benchmark kartica i istorija (korak 30)

**Files:** Create `src/js/sim/threads.js`, `src/js/sim/benchmark.js`, `main/benchmark_log.js`; Modify `main/simulator/runner.js` (stability + roundsPerSecPerWorker), `main/simulator/analysis.js`, `main/ipc.js` (`sys:hardware.recommended`, `workerMode`, `benchmark:history`, append log), `preload.cjs`, `src/js/sim/sim_page.js` (slajder/select u kontrolni bar, kartica u AI panel), `src/js/ui/topbar.js` (⚡), `src/css/sim.css`, `src/js/renderer.js` (smoke `bench`); Test `tests/benchmark_log.test.js`, `tests/runner.test.js` (+threads režim, +stability), `tests/analysis.test.js` (+benchmark polja).

**Interfaces:**
- `benchmark_log.js`: `appendBenchmark(dataDir, row)`, `readBenchmarks(dataDir, limit=20) → rows` (pokvaren red preskočen).
- `runner.js`: `benchmark = { durationMs, threads, workerMode, seed, roundsTotal, roundsPerSec, roundsPerSecPerWorker, stability: { pct: number|null, label: 'Stabilno'|'Seckanje'|'n/a', gaps } }` — `gaps` = broj razmaka između progres poruka > 2×median; `pct` = 100·(1 − gaps/intervali), `null` ako je intervala < 2.
- `threads.js`: `mountThreadControl(el, hw) → {get(), set(n), setLocked(b), setMode(m), getMode()}`; DOM `#sim-threads` (range), `#sim-threads-text`, `#sim-worker-mode`.
- `benchmark.js`: `createBenchmarkCard(el) → {render(report), renderHistory(rows)}`; DOM `#sim-benchmark`, `#sim-benchmark-history`.

- [ ] Step 1: testovi: `benchmark_log` (append 3 → read 2 poslednja; pokvaren red preskočen); runner `workerMode:'threads'` daje isti `totalRounds` kao `processes` za isti seed; `benchmark.stability.label` ∈ skupu; `stability.pct === null` kad je 1 radnik i `progressEvery` veći od sesija. RED → GREEN.
- [ ] Step 2: smoke `BENCH`: `#sim-threads` max === `maxAllowed`, tekst sadrži „Preporučeno“; postavi slajder na 2 → mala simulacija → `report.benchmark.threads === 2`, `#sim-benchmark` sadrži „krugova/sek“ i „Status stabilnosti“; slajder `disabled` tokom rada; `benchmark:history` vraća ≥ 1 red; DOM vrednost 99 → Main klampuje (report.threads ≤ maxAllowed).
- [ ] Step 3: `npm test` → PASS; puna simulacija sa 12 radnika → screenshot (CPU ⚡ u topbaru, kartica). Commit `feat(korak30): kontrola radnika, benchmark kartica, istorija, režim radnika`. Dev-log Faze 7; README; ažuriraj `README.md` app-a (funkcije, prečice).
