# Gambit — planovi po fazama

Spec: `docs/specs/2026-09-27-gambit-design.md`. Izvor koraka: `~/ai/IDEJE/Gembler/NN_KORAK_*.md`.
Izvršenje: nativno (Claude u sesiji, `superpowers:executing-plans`), autonomno kroz sve faze,
commit po tasku (`commit_local.sh gambit "…"`), dev-log po fazi (`devlog_commit.sh`).

| Faza | Koraci | Plan | Status |
|---|---|---|---|
| 1 Skelet | 01–04 | `2026-09-27-faza1-skelet.md` | gotovo (2026-09-27) |
| 2 Dice | 05–12 | `2026-09-27-faza2-dice.md` | gotovo (2026-09-27) |
| 3 Mines | 13–17 | `2026-09-27-faza3-mines.md` | gotovo (2026-09-27) |
| 4 Keno | 18–22 | `2026-09-27-faza4-keno.md` | gotovo (2026-09-27) |
| 5 Multi-Strategy | 23–25 | `2026-09-27-faza5-multi.md` | gotovo (2026-09-27) |
| 6 Strategy Hub | 26–29 | `2026-09-27-faza6-hub.md` | gotovo (2026-09-27) |
| 7 Benchmark | 30 | `2026-09-27-faza7-benchmark.md` | gotovo (2026-09-27) |

Pravilo (00_GLAVNI_PROCES): naredni korak počinje tek kad tekući ispuni svoj kriterijum
uspešnosti (testovi + screenshot prozora + čista DevTools konzola).
