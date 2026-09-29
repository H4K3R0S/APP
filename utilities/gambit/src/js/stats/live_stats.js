// Desna sekcija (zajednička za sve igre): balans/profit, W/L, nizovi, roll history, milestone-i, reset.
import { h, fmt } from '../ui/dom.js';
import { state, subscribe, resetSession, setBalance } from '../state.js';
import { toast } from '../ui/toast.js';
import { winRate, profitPct, MILESTONES } from '../../../shared/session_stats.js';

const MILESTONE_CLASS = { 50: 'm-blue', 100: 'm-green', 200: 'm-orange', 500: 'm-purple' };

export function mountLiveStats(right) {
  // Balans i profit
  const balance = h('div', { id: 'stat-balance', class: 'stat-balance' }, '$1000.00');
  const profitPctEl = h('span', { id: 'stat-profit-pct', class: 'stat-pct' }, '+0.00%');
  const bets = h('b', { id: 'stat-bets' }, '0');
  const wins = h('b', { id: 'stat-wins', class: 'pos' }, '0');
  const losses = h('b', { id: 'stat-losses', class: 'neg' }, '0');
  const winrate = h('b', { id: 'stat-winrate' }, '0.00%');
  const maxWin = h('b', { id: 'stat-max-win', class: 'pos' }, '$0.00');

  // Unos balansa za igru: postavi koliko para imaš pre nego što počneš
  const balInput = h('input', { id: 'set-balance-input', type: 'number', step: '1', min: '0', placeholder: 'npr. 1000' });
  const balBtn = h('button', { id: 'set-balance-btn', type: 'button', class: 'btn-secondary' }, 'Postavi balans');
  function applyBalance() {
    const v = Number(balInput.value);
    if (!Number.isFinite(v) || v <= 0) { toast('Unesi balans veći od 0', 'error'); return; }
    setBalance(v);
    balInput.value = '';
    toast(`Balans postavljen na ${fmt(v, 2)}$`, 'ok');
  }
  balBtn.addEventListener('click', applyBalance);
  balInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyBalance(); });

  right.balance.replaceChildren(
    h('div', { class: 'stat-title' }, 'Live Stats'),
    h('div', { class: 'stat-balance-row' }, h('span', { class: 'coin' }, '$'), balance, profitPctEl),
    h('div', { class: 'set-balance-row' }, balInput, balBtn),
    h('div', { class: 'stat-grid' },
      h('div', {}, h('span', {}, 'Ukupno'), bets),
      h('div', {}, h('span', {}, 'Pobede'), wins),
      h('div', {}, h('span', {}, 'Porazi'), losses),
      h('div', {}, h('span', {}, 'Win rate'), winrate),
      h('div', { class: 'stat-wide' }, h('span', {}, 'Najveći dobitak (sesija)'), maxWin),
    ),
  );

  // Nizovi i istorija
  const streak = h('b', { id: 'stat-streak' }, '0');
  const maxStreak = h('b', { id: 'stat-max-streak' }, '0');
  const history = h('div', { id: 'roll-history', class: 'roll-history' });
  right.streaks.replaceChildren(
    h('div', { class: 'stat-grid' },
      h('div', { class: 'streak' }, h('span', {}, 'Trenutni niz gubitaka'), streak),
      h('div', { class: 'streak' }, h('span', {}, 'Maks. niz gubitaka'), maxStreak),
    ),
    h('div', { class: 'stat-sub' }, 'Live Roll History'),
    history,
  );

  // Milestone-i + reset
  const milestoneEls = {};
  const list = h('div', { id: 'milestones', class: 'milestones' }, ...MILESTONES.map((m) => {
    const box = h('span', { class: 'box' }, '');
    const when = h('span', { class: 'when' }, '');
    const el = h('div', { class: `milestone ${MILESTONE_CLASS[m]}`, dataset: { pct: String(m) } }, box, h('span', { class: 'lbl' }, `Milestone ${m}%`), when);
    milestoneEls[m] = { el, box, when };
    return el;
  }));
  const resetBtn = h('button', { id: 'stats-reset', type: 'button', class: 'btn-ghost' }, 'Resetuj statistiku');
  resetBtn.addEventListener('click', () => resetSession());
  right.notes.replaceChildren(h('div', { class: 'stat-sub' }, 'Prekretnice profita'), list, resetBtn);
  for (const el of [right.balance, right.streaks, right.notes]) el.classList.add('filled');

  function update(s) {
    balance.textContent = fmt(s.balance, 2);
    const pct = profitPct(s);
    profitPctEl.textContent = `${pct >= 0 ? '+' : ''}${fmt(pct, 2)}%`;
    profitPctEl.classList.toggle('pos', pct >= 0);
    profitPctEl.classList.toggle('neg', pct < 0);
    bets.textContent = String(s.bets);
    wins.textContent = String(s.wins);
    losses.textContent = String(s.losses);
    winrate.textContent = `${fmt(winRate(s), 2)}%`;
    maxWin.textContent = `$${fmt(s.maxWin || 0, 2)}`;
    streak.textContent = String(s.lossStreak);
    streak.classList.toggle('streak-danger', s.lossStreak >= 5);
    maxStreak.textContent = String(s.maxLossStreak);
    history.replaceChildren(...s.history.map((r) => h('span', { class: `badge ${r === 'W' ? 'win' : 'lose'}` }, r)));
    for (const m of MILESTONES) {
      const hit = s.milestones[m] != null;
      milestoneEls[m].el.classList.toggle('hit', hit);
      milestoneEls[m].box.textContent = hit ? '✓' : '';
      milestoneEls[m].when.textContent = hit ? `krug ${s.milestones[m]}` : '';
    }
  }

  subscribe((key) => { if (key === 'stats') update(state.stats); });
  update(state.stats);
  return { update, reset: () => resetSession() };
}
