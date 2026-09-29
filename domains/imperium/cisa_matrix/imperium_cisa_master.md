---
id: imperium-cisa-master
type: cisa_global_core
domain: imperium
title: IMPERIUM CISA — globalni koordinator situacione svesti
summary: Koordinator situacione svesti IMPERIUM-a; Commander delegira pod-agentima po fazama.
status: stable
agent_owner: strateg
active_sub_agents: [imperium-strategy-architect, imperium-content-producer, imperium-audit-janitor]
situation_awareness_level: high
total_learned_patterns: 3
keywords: [cisa, imperium, poslovne, kreativne, projekte, sadržaj, konzistentnost, outputa, strategy-architect, content-producer, audit-janitor]
tags: [cisa, imperium, koordinator, agenti]
source_path: cisa_matrix/imperium_cisa_master.md
atom_kreiran: 2026-09-19T16:07:14-04:00
atom_azuriran: 2026-09-19T16:07:14-04:00
edges:
- {type: has_part, target: imperium-strategy-architect, weight: 0.9}
- {type: has_part, target: imperium-content-producer, weight: 0.9}
- {type: has_part, target: imperium-audit-janitor, weight: 0.9}
- {type: references, target: strateg, weight: 0.6}
- {type: references, target: learn-strategy-patterns, weight: 0.7}
---

# 🧠 IMPERIUM CISA — situaciona svest

Koordinator (`strateg` kao Commander) prati poslovne/kreativne projekte, sadržaj i konzistentnost outputa. Kada zadaš zadatak, analizira CISA bazu, prepoznaje obrasce i delegira pod-agentima.

## 🔀 DELEGACIJA (faza → pod-agent)
| Faza | Pod-agent (persona) | Lokalni CISA fajl | Fokus |
|---|---|---|---|
| 1. Plan & analiza | Strategy-Architect (`strateg`) | `[[imperium-strategy-architect]]` | Strategija/plan i tržišna analiza pre izrade |
| 2. Izrada sadržaja | Content-Producer (`producent`) | `[[imperium-content-producer]]` | Generisanje sadržaja (scenario/SEO) po planu |
| 3. Provera & doslednost | Audit-Janitor (`analiticar-trzista`) | `[[imperium-audit-janitor]]` | Validacija outputa i konzistentnost |

## 🔄 CROSS-AGENT PETLJA UČENJA
Agenti rade redom, presreću greške, sami rešavaju iz svoje lokalne matrice, i upisuju nove lekcije u `[[learn-strategy-patterns]]`. Commander osvežava ovaj master i vezuje stabilno stanje za Git commit (Time-Travel = istorija commit-ova).

## 🛡️ Bezbednost
Lokalno; poverljivi podaci se ne šalju spolja. Osetljive akcije kroz Approval Gate.
