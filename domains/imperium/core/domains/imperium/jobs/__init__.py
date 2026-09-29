# core/domains/imperium/jobs/__init__.py
"""Poslovi (cron/skripte kao funkcije domena) — v.
UNAPREDJENJE/01-ARHITEKTURA/08-cron-i-skripte-sloj.md.

`REGISTRY` (iz `core.domains.imperium.jobs.registry`) je modulski singleton
koji API ruter (`apps/api/routers/imperium_jobs.py`) koristi. Namerno se NE
uvozi ovde da bi uvoz ovog paketa ostao jeftin — uvezi `registry` direktno.
"""
