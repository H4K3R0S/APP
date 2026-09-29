// Rešavanje hibridne konfiguracije pre pokretanja radnika: učitava sve strategije iz data/<game>/ i validira.
import * as storage from '../storage.js';
import { hybridStrategy, validateHybrid } from '../../shared/hybrid_schema.js';
import { validateStrategy } from '../../shared/strategy_schema.js';

export async function resolveHybrid(dataDir, game, config) {
  const h = hybridStrategy({ ...config, game });
  const list = await storage.listStrategies(dataDir, game).catch(() => []);
  const solo = new Map(list.filter((s) => s.type !== 'multi').map((s) => [s.name, s.game]));
  const v = validateHybrid(h, { gameOf: (name) => solo.get(name) || null });
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const byName = {};
  for (const name of new Set([h.baseStrategy, ...h.triggers.map((t) => t.switchTo)])) {
    const s = await storage.loadStrategy(dataDir, game, name);
    if (!s) return { ok: false, error: `Strategija „${name}“ nije nađena` };
    const sv = validateStrategy({ ...s, game });
    if (!sv.ok) return { ok: false, error: `Strategija „${name}“: ${sv.errors.join('; ')}` };
    byName[name] = { ...s, game };
  }
  return { ok: true, hybrid: { base: byName[h.baseStrategy], byName, triggers: h.triggers }, config: h };
}
