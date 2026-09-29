---
id: imperium-command-katalog
type: command
domain: imperium
title: Katalog komandi
summary: Daj tačan ulaz za komande koje ga traže (`target` = sekcija GUI-ja).
status: stable
keywords:
- katalog
- komandi
tags: []
source_path: .ai/atomi/personas/_shared/commands/katalog.md
atom_kreiran: 2026-09-18 09:43:19-04:00
atom_azuriran: 2026-09-18 09:43:19-04:00
---

Pick EXACTLY ONE command when the user wants a screen switched — only navigation
exists yet. Give the exact input (`target` = a GUI section). Never invent commands.

## Navigate
- open {target} — switch the IMPERIUM window to a section. target ∈ pocetna,
  dashboard. (IMPERIUM GUI is still a skeleton; more sections arrive with features.)
- open_second_brain_map {} — open the Second Brain MAPS map (rings/circle/areas/links/timeline/orbit + other systems' spheres).

IMPERIUM has NO executive tools yet (TTS/SD/exec/network are [TODO], gated by
Approval Gate F5). For everything else — questions, analysis, proposals — answer
directly in conversation, using RAG context when available.
