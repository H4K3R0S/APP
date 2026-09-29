# ========== IMPERIUM MIGRACIJE ==========
# IMPERIUM je za sada prazan skelet (bez tabela). Prazan skup je NAMERAN i
# eksplicitan: ćelijski okvir ga učita po konvenciji
# `core/domains/<domen>/migrations.py::<DOMEN>_MIGRATIONS` i napravi praznu bazu
# ćelije. Kada IMPERIUM dobije tabele, dodaju se ovde kao DatabaseMigration redovi.
from __future__ import annotations

from core.database.migrations import DatabaseMigration

IMPERIUM_MIGRATIONS: tuple[DatabaseMigration, ...] = ()
