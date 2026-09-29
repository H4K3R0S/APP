// Hibridni menadžer stanja (korak 24): okidači „AKO lossStreak ≥ X / balans < Y% ➔ PREBACI NA B“ unutar sesije.
// Okidači se proveravaju redom (prvi ispunjen pobeđuje), svaki okida najviše JEDNOM po sesiji (bez ping-ponga).
// Prenos stanja: balans i ulog ostaju, aktivna strategija se menja, niz gubitaka se resetuje.
export function createHybrid({ base, byName = {}, triggers = [] } = {}) {
  const fired = new Set();
  const h = {
    base,
    byName,
    triggers,
    fired,
    last: null, // { index, trigger, actions } poslednjeg prebacivanja (session čita akcije po igri)
    check({ lossStreak = 0, balance = 0, budget = 0 } = {}) {
      for (let i = 0; i < triggers.length; i++) {
        if (fired.has(i)) continue;
        const t = triggers[i];
        const v = Number(t.value);
        const hit = t.when === 'lossStreak' ? lossStreak >= v
          : t.when === 'balanceDrop' ? balance < budget * (v / 100)
            : false;
        if (!hit) continue;
        const next = byName[t.switchTo];
        if (!next) continue;
        fired.add(i);
        h.last = { index: i, trigger: t, actions: t.actions || {} };
        return next;
      }
      return null;
    },
    reset() { fired.clear(); h.last = null; },
  };
  return h;
}

// Čist prenos: nova strategija diktira pravila, ali balans i tekući ulog se NE resetuju.
export function executeStateHandover(session, nextStrategy) {
  return { ...session, active: nextStrategy, lossStreak: 0 };
}
