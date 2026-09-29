---
id: imperium-2026-09-18-fallthrough-ruter-integracija
type: log
domain: imperium
title: 2026-09-18-fallthrough-ruter-integracija
tags:
- dev-log
- entries
---

# 2026-09-18 — FALLTHROUGH integracija sa centralnim ruterom (prijemna strana)

## Cilj
Uključiti IMPERIUM u mrežu rutera. IMPERIUM je trenutno skelet (nema assistant
runtime/agenta), pa nema šta da se umota na SLANJE — ali može da PRIMA rutirane
zahteve i da bude spreman kad dobije agenta.

## Urađeno
- Deljeni modul `core/cell/fallthrough.py` postavljen (za budući agent: `build_fallthrough_retriever`).
- Nova ruta `apps/api/routers/solve.py` (POST `/solve`) i registrovana u `cell_app.py`
  (koji je do sada imao samo `system` ruter).
- Port ćelije vraćen na kanonski **4803**.

## Provereno
- Import ćelije čist (`import cell_app`), `/solve` ruta registrovana.
- Ruter podignut kao systemd user servis `ai-router` (127.0.0.1:4800), `enable --now`.
- Uživo: KALIMA→ruter→CODIUM vratio traženu skriptu (primer iz specifikacije);
  graf-keš pogodak preko `ggraph get`; nepoznat upit → prazan rezultat (graciozno).
- Uživo: `POST /solve` na IMPERIUM vraća `{ok:false, domain:imperium, snippets:[]}` (nema još znanja).

## Napomene
- Kada IMPERIUM dobije agenta/asistenta, samo umotati njegov retriever u
  `build_fallthrough_retriever(local, "imperium", _ROOT)` — SLANJE se time uključuje.
