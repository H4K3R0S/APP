---
id: core-ec77b562-imperium-md
type: reference
domain: core
namespace: global
visibility: global
tier: core
title: IMPERIUM (Level-1)
summary: 'Namena: menadžer/dashboard za YouTube i striming + poslovni asistent. Status:
  skeleton (manifest.py). Agenti: **20 planirano** (manifest). Agentna arhitektura: '
keywords:
- imperium
- level
- reference
- domains
tags:
- reference
- domains
source_path: .ai/reference/domains/IMPERIUM.md
---

# IMPERIUM (Level-1)

Namena: menadžer/dashboard za YouTube i striming + poslovni asistent. Status: skeleton (manifest.py). Agenti: **20 planirano** (manifest). Agentna arhitektura: `reference/AGENTS.md`.
Napomena: "Srecko GX" je JEDAN projekat unutar IMPERIUM-a (ne ceo domen).
Dva pravca: (1) Srecko GX — lični gejming kanal; (2) nezavisni kanali za zaradu (odvojeni). Platforme: YouTube, Twitch, Kick, TikTok.

## Dashboard projekta (npr. Srecko GX)
Stanje karijere, Pripremi stream/video, kalendar, notifikacije, konekcije Twitch/Kick/TikTok, OBS integracija, omnichat. Biblioteka igara (igrao/želim/nadolaze) + posteri igara. "MOJ GX PREVIEW" (nove igre, nextlev). Tragalica za igrama (hype sajtovi/Steam/Epic/SteamDB → preporuke).

## Content pipeline
Naslov, tekst za thumbnail, ChatGPT slike, gotovi opisi (hashtag/tag/emote). Scenario (poslovni): analiza niše → ideja → scenario → naslov → opisi → skripta → psihološke veštine (retencija). Cilj: auto-unos u stream servise, pokretanje na "stream".

## Poslovni alati
nextlev, pretraga tržišta, cloud + "moj sistem ↔ Claude" petlja (Claude šalje skripte, vraćam rezultat), ChatGPT. Produkcija: SunoAI, Veo 3.1, youtubetranscript.com, 69labs.

## IMPERIUM_SICA + korpus agenata (plan)
Domenska SICA vodi content-to-cash pipeline i bira tim iz 4 korpusa:
- Content pipeline (6): AUCTOR (script), Pictor (thumbnail), FABIUS (title/SEO), MELPO (audio/muzika), SCAENA (montaža), VERITAS (fact-check).
- Streaming/platform (6): DIRECTOR (OBS/stream producer), MERKURIUS (chat mod), PLANNER (kalendar), ANALYST (analitika), CONNECTOR (platform API-ji), ALERTUS (notifikacije).
- Growth/business (5): TACTICUS (rast), NEGOTIATOR (sponzorstva), LEGATUS (community), QUAESTOR (monetizacija), ARCHIVUS (arhiva/repurpose).
- Specifični projekti (3): SRECKO (gaming kanal), FACELESS (faceless kanali), OMNIS (multi-channel orkestrator).
Sve auto-objave/postovi = sandbox + HUMAN_APPROVE (Constitution §8).

OTVORENO: spisak projekata; API-ji Twitch/Kick/TikTok/YouTube; OBS WebSocket.
