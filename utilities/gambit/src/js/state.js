// Globalno stanje renderera + pub/sub: aktivna igra, statistika sesije (jedan balans za sve igre).
import { createStats, applyResult, resetStats, setBalance as setBalanceStat } from '../../shared/session_stats.js';

export const GAMES = ['dice', 'mines', 'keno'];
export const INITIAL_BALANCE = 1000;

export const state = {
  game: 'dice',
  stats: createStats(INITIAL_BALANCE),
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(key, extra) {
  for (const fn of listeners) fn(key, state, extra);
}

export function setGame(game) {
  if (!GAMES.includes(game)) return false;
  if (state.game !== game) {
    state.game = game;
    emit('game');
  }
  return true;
}

// Rezultat kruga: {isWin, betAmount, profit, ...} → ažurira statistiku; emituje 'stats' i 'round'.
export function applyRound(result) {
  state.stats = applyResult(state.stats, result);
  emit('stats');
  emit('round', result);
  return state.stats;
}

// Biblioteka strategija se promenila (save/delete/analiza) → Hub i liste se osvežavaju.
export function notifyStrategiesChanged() {
  emit('strategies-changed');
}

export function resetSession() {
  state.stats = resetStats(state.stats);
  emit('stats');
  emit('reset');
}

// Korisnik ručno postavlja balans za igru: novi početni balans, statistika i grafikon se resetuju.
export function setBalance(amount) {
  const next = setBalanceStat(state.stats, amount);
  if (next === state.stats) return false;
  state.stats = next;
  emit('stats');
  emit('reset');
  return true;
}
