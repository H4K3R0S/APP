# SDD ledger — plan: docs/plans/2026-09-27-faza4-keno.md

Task 1: complete (commits 995b9fb, tests: 91/91)
Task 1: Ruling: tablice za low/medium i ne-10 izbore su Stake-slične aproksimacije (spec daje samo 10-pick classic/high), jedan fajl keno_paytables.js — cost if wrong: RTP odstupa; lako se menja.
Task 2: complete (commits b973aaf, tests: npm test → 95/95 pass; screenshot f4-t2: 10 izabranih, 3 pogotka zeleno, promašaji tačkice)
Task 2: Ruling: isWin = multiplier ≥ 1 (isplata 0.5× je gubitak za niz/statistiku, 1× je neutralno-dobitak) — cost if wrong: streak brojači kod 0.5× isplata.
Task 3: complete (commits afed7d7, tests: npm test → 101/101 pass; screenshot f4-t3a/b: sidra 16/1/23 ×4, heatmapa)
Task 4: complete (commits 4f7a3c8, tests: npm test → 103/103 pass; screenshot f4-t4a/b: sidro panel, auto sa zlatnim sidrima)
Task 5: complete (commits 9349d15, tests: npm test → 105/105 pass; puna Keno simulacija u app: 12000 sesija, 216k krugova, 1.9 s (sidro+50% strategija bankrotira brzo); screenshot f4-t5)
Faza 4 zatvorena.
Ruling (korisnik 2026-09-27): Keno tabla 40 brojeva, izvlači se 10 (ne 80/20 iz spec fajlova) — BOARD/DRAW_COUNT u keno_paytables.js, mreža 8×5, testovi/smoke prilagođeni — cost if wrong: nijedan (konstante).
Final review F4 (opus, stigao kasno): fixed C1 (10-pick classic/high tablice: spec redovi = RTP 13%/25% na 40/10 — classic-10 = Stake 40/10 red [3.5,8,13,63,500,800,1000], high-10 = spec oblik ×3.88 → 99%; RTP test za svih 40 redova), I1 (validacija 1–40/MAX_PICKS iz keno_paytables), I2 (auto zaključava ceo UI; manual vraća prethodno stanje), I3 (lenj applyShift + parcijalni FY), I4 (Uint32 + record keepHistory:false u radniku), I5 (close umesto exit), I6 (onHandover već u Fazi 5); minors: guard keno:play, dedupe pre slice, rng.int(0) baca, freq unsubscribe, stale 80/20 komentari.
Final: Ruling: isplatne tablice za 10 izabranih ODSTUPAJU od doslovnih spec vrednosti jer spec sam traži 1% kućne prednosti — korisnik može vratiti literale u keno_paytables.js (RTP test bi tada pao) — cost if wrong: RTP sidro strategija.
Final: minor (deferred): Keno engine sporiji 15× od Mines (alokacije po krugu); isWin=mult≥1 semantika (ruling); Math.random za živu popunu sidra (kao Mines ruling); balans u rendereru.
