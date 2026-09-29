// Pop-up „Napredna opklada" (Stake-stil): naziv strategije + lista uslova (Bet/Profit), Dodaj uslov, Sačuvaj.
// Poziva se iz Auto panela; onSave dobija { strategyName, conditions }. Čist DOM (bez innerHTML stringova).
import { h } from '../ui/dom.js';
import { defaultCondition, BET_ON, PROFIT_ON, OUTCOMES, BET_DO_ACTIONS, DICE_DO_ACTIONS, NO_VALUE_ACTIONS } from '../../../shared/conditions.js';

const ON_BET_LABEL = { every: 'Svaki', everyStreak: 'Svaki niz od', firstStreak: 'Prvi niz od', streakGreater: 'Niz veći od', streakLower: 'Niz manji od' };
const ON_PROFIT_LABEL = { profitAbove: 'Profit dostigne (≥ $)', profitBelow: 'Gubitak dostigne (≥ $)' };
const OUTCOME_LABEL = { wins: 'Dobitaka', losses: 'Gubitaka', bets: 'Krugova' };
const DO_LABEL = {
  increase: 'Povećaj ulog (%)', decrease: 'Smanji ulog (%)', add: 'Dodaj ulogu ($)', subtract: 'Oduzmi od uloga ($)',
  set: 'Postavi ulog ($)', reset: 'Resetuj ulog', stop: 'Zaustavi auto',
  setChance: 'Postavi šansu (%)', increaseChance: 'Povećaj šansu (+ % poena)', decreaseChance: 'Smanji šansu (− % poena)',
  resetChance: 'Resetuj šansu', switchDir: 'Promeni Over/Under',
};

function opt(value, label, sel) { return h('option', sel === value ? { value, selected: '' } : { value }, label); }

export function openStrategyEditor({ initial = {}, onSave, game } = {}) {
  // Dice dobija dodatne akcije (šansa/smer); ostale igre samo akcije nad ulogom.
  const doActions = game === 'dice' ? [...BET_DO_ACTIONS, ...DICE_DO_ACTIONS] : BET_DO_ACTIONS;
  const conditions = (initial.conditions && initial.conditions.length ? initial.conditions : [defaultCondition()]).map((c) => ({ ...c }));

  const nameInput = h('input', { id: 'se-name', type: 'text', maxlength: '60', placeholder: 'npr. Martingale_Baza_1', value: initial.strategyName || '' });
  const list = h('div', { class: 'se-conditions' });
  const overlay = h('div', { class: 'modal-overlay', id: 'strategy-editor' });

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function renderCondition(c, idx) {
    const isBet = c.kind !== 'profit';
    // Red 1: Bet / Profit prekidač
    const betRadio = h('label', { class: `se-toggle ${isBet ? 'on' : ''}` }, h('span', { class: 'dot' }), 'Bet uslov');
    const profitRadio = h('label', { class: `se-toggle ${isBet ? '' : 'on'}` }, h('span', { class: 'dot' }), 'Profit uslov');
    betRadio.addEventListener('click', () => { c.kind = 'bet'; c.on = 'every'; refresh(); });
    profitRadio.addEventListener('click', () => { c.kind = 'profit'; c.on = 'profitBelow'; refresh(); });

    // Red „NA": okidač
    const onSel = h('select', {}, ...(isBet ? BET_ON.map((v) => opt(v, ON_BET_LABEL[v], c.on)) : PROFIT_ON.map((v) => opt(v, ON_PROFIT_LABEL[v], c.on))));
    onSel.addEventListener('change', () => { c.on = onSel.value; });
    const countInput = h('input', { type: 'number', step: isBet ? '1' : '0.01', min: isBet ? '1' : '0', value: String(c.count) });
    countInput.addEventListener('input', () => { c.count = Number(countInput.value) || 0; });
    const outcomeSel = h('select', {}, ...OUTCOMES.map((v) => opt(v, OUTCOME_LABEL[v], c.outcome)));
    outcomeSel.addEventListener('change', () => { c.outcome = outcomeSel.value; });
    const onRow = isBet
      ? h('div', { class: 'se-row3' }, onSel, countInput, outcomeSel)
      : h('div', { class: 'se-row2' }, onSel, countInput);

    // Red „URADI": akcija
    const doSel = h('select', {}, ...doActions.map((v) => opt(v, DO_LABEL[v], c.do)));
    const valInput = h('input', { type: 'number', step: '0.01', min: '0', value: String(c.value) });
    valInput.addEventListener('input', () => { c.value = Number(valInput.value) || 0; });
    const syncVal = () => {
      valInput.hidden = NO_VALUE_ACTIONS.includes(c.do);
      if (c.do === 'setChance') { valInput.min = '2'; valInput.max = '98'; valInput.placeholder = 'šansa % (2–98)'; }
      else { valInput.min = '0'; valInput.removeAttribute('max'); valInput.placeholder = ''; }
    };
    syncVal();
    doSel.addEventListener('change', () => { c.do = doSel.value; syncVal(); });
    const doRow = h('div', { class: 'se-row2' }, doSel, valInput);

    const delBtn = h('button', { type: 'button', class: 'se-del' }, 'Obriši uslov');
    delBtn.addEventListener('click', () => { conditions.splice(idx, 1); if (!conditions.length) conditions.push(defaultCondition()); refresh(); });

    return h('div', { class: 'se-cond' },
      h('div', { class: 'se-cond-head' }, h('b', {}, `Uslov ${idx + 1}`), h('div', { class: 'se-toggles' }, betRadio, profitRadio)),
      h('div', { class: 'se-lbl' }, 'NA'), onRow,
      h('div', { class: 'se-lbl' }, 'URADI'), doRow,
      delBtn,
    );
  }

  function refresh() {
    list.replaceChildren(...conditions.map((c, i) => renderCondition(c, i)));
  }

  const addBtn = h('button', { id: 'se-add', type: 'button', class: 'se-add' }, '＋ Dodaj uslov');
  addBtn.addEventListener('click', () => { conditions.push(defaultCondition()); refresh(); });
  const saveBtn = h('button', { id: 'se-save', type: 'button', class: 'se-save' }, '✓ Sačuvaj strategiju');
  const closeBtn = h('button', { type: 'button', class: 'modal-x', title: 'Zatvori' }, '✕');
  closeBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.classList.add('invalid'); nameInput.focus(); return; }
    if (onSave) onSave({ strategyName: name, conditions: conditions.map((c) => ({ ...c })) });
    close();
  });
  nameInput.addEventListener('input', () => nameInput.classList.remove('invalid'));

  const modal = h('div', { class: 'modal-card se-card' },
    h('div', { class: 'modal-head' }, h('h2', {}, 'Napredna opklada'), closeBtn),
    h('div', { class: 'modal-body' },
      h('label', { class: 'se-field' }, h('span', {}, 'Naziv strategije *'), nameInput),
      list,
      addBtn),
    h('div', { class: 'modal-foot' }, saveBtn),
  );
  overlay.append(modal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  refresh();
  document.body.append(overlay);
  return { el: overlay, close };
}
