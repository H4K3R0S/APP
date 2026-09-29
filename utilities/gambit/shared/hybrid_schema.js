// Multi-Strategy (hibridna) konfiguracija: bazna strategija + okidači „AKO … ➔ PREBACI NA …“ unutar iste igre.
// Čuva se kao strategija type:'multi' u data/<game>/ (Hub je lista zajedno sa solo strategijama).
import { GAMES } from './strategy_schema.js';

export const TRIGGER_KINDS = ['lossStreak', 'balanceDrop'];
const ACTION_KEYS = ['minesShift', 'kenoSwapAnchors', 'diceRaiseMultiplier'];

function trigger(t = {}) {
  const actions = {};
  for (const k of ACTION_KEYS) actions[k] = !!t.actions?.[k];
  return {
    when: t.when === undefined ? 'lossStreak' : String(t.when), // ne koriguj tiho — validateHybrid prijavljuje loš when
    value: Number(t.value) || 0,
    switchTo: String(t.switchTo ?? ''),
    actions,
  };
}

export function hybridStrategy(p = {}) {
  return {
    game: GAMES.includes(p.game) ? p.game : 'dice',
    strategyName: String(p.strategyName ?? ''),
    type: 'multi',
    createdAt: p.createdAt || new Date().toISOString(),
    baseStrategy: String(p.baseStrategy ?? ''),
    triggers: Array.isArray(p.triggers) ? p.triggers.map(trigger) : [],
  };
}

// gameOf(name) → igra sačuvane strategije ili null ako ne postoji.
export function validateHybrid(h, { gameOf = () => null } = {}) {
  const errors = [];
  if (!h || typeof h !== 'object') return { ok: false, errors: ['hibrid nije objekat'] };
  if (!GAMES.includes(h.game)) errors.push(`game mora biti ${GAMES.join('/')}`);
  const baseGame = gameOf(h.baseStrategy);
  if (!h.baseStrategy) errors.push('baseStrategy je obavezna');
  else if (!baseGame) errors.push(`bazna strategija „${h.baseStrategy}“ ne postoji`);
  else if (baseGame !== h.game) errors.push(`bazna strategija „${h.baseStrategy}“ nije iz igre ${h.game}`);
  if (!Array.isArray(h.triggers)) errors.push('triggers mora biti niz');
  else {
    h.triggers.forEach((t, i) => {
      const tag = `okidač ${i + 1}`;
      if (!TRIGGER_KINDS.includes(t.when)) errors.push(`${tag}: when mora biti ${TRIGGER_KINDS.join('/')}`);
      const v = Number(t.value);
      if (!(v > 0)) errors.push(`${tag}: vrednost mora biti > 0`);
      if (t.when === 'balanceDrop' && v > 100) errors.push(`${tag}: balanceDrop je procenat (≤ 100)`);
      const g = gameOf(t.switchTo);
      if (!t.switchTo) errors.push(`${tag}: switchTo je obavezan`);
      else if (!g) errors.push(`${tag}: strategija „${t.switchTo}“ ne postoji`);
      else if (g !== h.game) errors.push(`${tag}: „${t.switchTo}“ nije iz igre ${h.game}`);
    });
  }
  return { ok: errors.length === 0, errors };
}
