---
id: imperium-2026-09-18-linux-electron-optimizacija
type: log
domain: imperium
title: 2026-09-18-linux-electron-optimizacija
tags:
- dev-log
- entries
---

# 2026-09-18 — Linux prelazak, Electron prozor, optimizacija, preimenovanje agenta

Cilj: IMPERIUM ćelija radi brzo i uredno na Kali Linuxu, u pravom prozoru
aplikacije, sa ispravnim imenom agenta (ne „Kurator").

## Urađeno

- Linux prelazak: `start.sh` (zamena za `start.bat`/`.exe`), Linux `.venv`,
  `dependencies.py` platformski svestan (apt/pip hintovi umesto winget).
- Prozor: prešlo sa WebKit2GTK na Electron (Chromium) `cell-shell`
  (`~/ai/core-infrastructure/cell-shell`) — frameless, maksimizovan, app-ov
  TitleBar most; ~4x brži render teških CSS efekata na NVIDIA. `cell_window.py`
  (WebKit) ostaje fallback.
- Optimizacija starta: `PRAGMA synchronous = NORMAL`; RAG bootstrap izbačen sa
  boot putanje (nema blokirajućeg Postgres connect-a; ~18% brži import).
- Lokacija: ćelija premeštena u `~/ai/domains/imperium`.
- AI: `ai.assistant_model = qwen2.5:7b` (lokalna Ollama na 11434, GPU).
- Preimenovanje: FILMIUM-ov „Kurator" uklonjen iz zajedničkog sloja; interno
  `curator`→`assistant` (`ai_curator_model`→`ai_assistant_model`), prikazano
  ime agenta = `Imperium`.

## Provereno

Import OK; server 8783 → HTTP 200; `/cell/status` → `ai_assistant_model: qwen2.5:7b`
(nema `ai_curator_model`); `grep curator/kurator` u core/apps/cell.json/gui/dist/atomi = 0.

## Napomene

IMPERIUM je još skelet domen (chat/dock se ne renderuje). CORE više ne postoji,
pa su izmene u ćeliji trajne (nema `build_cell.py --update` prepisivanja).
