// Tekstualni opis strategije za Hub panel (čisto): redovi {label, value, trigger?}.
import { multiplierFromChance, chanceFromTarget } from './dice_math.js';

const RISK = { classic: 'Klasičan (Classic)', low: 'Niski (Low)', medium: 'Srednji (Medium)', high: 'Visoki (High)' };
const ALGO = { mirror: 'Mirror (ogledalo)', invert: 'Invert (suprotna polja)', random: 'Random Shift' };
const f2 = (x) => Number(x).toFixed(2);

function rule(r) {
  return r?.action === 'increase' ? `Povećaj za ${Number(r.value) || 0}%` : 'Resetuj';
}
function shiftRule(r, kind) {
  if (!r || r.mode === 'stay') return 'ostani';
  if (r.mode === 'now') return kind === 'win' ? 'odmah posle dobitka' : 'odmah posle eksplozije';
  return `posle ${r.count} uzastapna ${kind === 'win' ? 'dobitka' : 'promašaja'}`.replace('uzastapna', 'uzastopna');
}

export function describeTrigger(t) {
  const cond = t.when === 'balanceDrop'
    ? `AKO balans padne ispod ${t.value}% početnog`
    : `AKO Loss Streak dostigne ${t.value} krugova`;
  const acts = [];
  if (t.actions?.minesShift) acts.push('aktiviraj rotaciju polja');
  if (t.actions?.kenoSwapAnchors) acts.push('zameni sidra');
  if (t.actions?.diceRaiseMultiplier) acts.push('primeni viši multiplikator');
  const pre = acts.length ? `${acts.join(', ')} i ` : '';
  return `${cond} ➔ ${pre}prebaci na ${t.switchTo}`;
}

export function describeRules(s) {
  if (!s || typeof s !== 'object') return [];
  const rows = [];
  if (s.type === 'multi') {
    rows.push({ label: 'Polazna strategija', value: s.baseStrategy || '—' });
    (s.triggers || []).forEach((t, i) => rows.push({ label: `Okidač ${i + 1}`, value: describeTrigger(t), trigger: true }));
    if (!(s.triggers || []).length) rows.push({ label: 'Okidači', value: 'nema (ponaša se kao solo)' });
    return rows;
  }
  if (Number(s.startBalance) > 0) rows.push({ label: 'Početni balans', value: `${f2(s.startBalance)}$` });
  rows.push({ label: 'Početni ulog', value: String(s.baseBet) });
  if (s.game === 'dice') {
    const chance = chanceFromTarget(s.targetValue, s.condition);
    rows.push({ label: 'Cilj', value: `Roll ${s.condition === 'under' ? 'Under' : 'Over'} ${f2(s.targetValue)} · šansa ${f2(chance)}% · ${f2(multiplierFromChance(chance))}×` });
  }
  if (s.game === 'mines') {
    rows.push({ label: 'Mine', value: `${s.minesCount} mine` });
    rows.push({ label: 'Polja', value: `${(s.selectedFields || []).join(', ')} (${(s.selectedFields || []).length})` });
    rows.push({ label: 'Rotacija', value: `na dobitak: ${shiftRule(s.shift?.onWin, 'win')} · na promašaj: ${shiftRule(s.shift?.onLoss, 'loss')} · ${ALGO[s.shift?.algo] || s.shift?.algo || '—'}` });
  }
  if (s.game === 'keno') {
    rows.push({ label: 'Rizik', value: RISK[s.riskLevel] || s.riskLevel });
    rows.push({ label: 'Brojevi', value: s.anchor?.enabled ? `Sidro strategija (top 3 + ${s.anchor.fillMode === 'cold' ? 'Cold Numbers' : 'Random Fill'})` : (s.selectedNumbers || []).join(', ') });
  }
  rows.push({ label: 'Na gubitak', value: rule(s.onLoss) });
  rows.push({ label: 'Na dobitak', value: rule(s.onWin) });
  const tp = Number(s.stopConditions?.takeProfit) || 0;
  const sl = Number(s.stopConditions?.stopLoss) || 0;
  rows.push({ label: 'Stop uslovi', value: [tp ? `Take Profit ${tp}` : null, sl ? `Stop Loss ${sl}` : null].filter(Boolean).join(' · ') || 'nema' });
  rows.push({ label: 'Broj krugova', value: s.maxBets ? String(s.maxBets) : '∞' });
  return rows;
}
