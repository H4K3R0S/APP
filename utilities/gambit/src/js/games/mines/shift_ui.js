// Mines hibridni okidači (UI): rotacija nakon pogotka / promašaja + algoritam (Mirror / Invert / Random).
import { h } from '../../ui/dom.js';

function triggerGroup(prefix, label, labels) {
  const stay = h('input', { id: `${prefix}-stay`, type: 'radio', name: prefix, value: 'stay', checked: true });
  const now = h('input', { id: `${prefix}-now`, type: 'radio', name: prefix, value: 'now' });
  const after = h('input', { id: `${prefix}-after`, type: 'radio', name: prefix, value: 'after' });
  const count = h('input', { id: `${prefix}-count`, type: 'number', min: '1', step: '1', value: '2' });
  const row = h('div', { class: 'field' },
    h('span', {}, label),
    h('div', { class: 'shift-rows' },
      h('label', { class: 'rule-opt' }, stay, h('span', {}, labels.stay)),
      h('label', { class: 'rule-opt' }, now, h('span', {}, labels.now)),
      h('label', { class: 'rule-opt' }, after, h('span', {}, labels.afterPre), count, h('span', {}, labels.afterPost)),
    ));
  return {
    row, stay, now, after, count,
    get() { return { mode: now.checked ? 'now' : after.checked ? 'after' : 'stay', count: Math.max(1, Math.floor(Number(count.value) || 1)) }; },
    set(r = {}) {
      ({ stay, now, after }[r.mode] || stay).checked = true;
      if (r.count != null) count.value = String(Math.max(1, Math.floor(Number(r.count) || 1)));
    },
    inputs: [stay, now, after, count],
  };
}

export function mountShiftUI(container) {
  const onWin = triggerGroup('mines-shift-onwin', 'Rotacija nakon pogotka (Shift on Win)',
    { stay: 'Ostani na istim mestima', now: 'Promeni poziciju odmah nakon dobitka', afterPre: 'Sačekaj', afterPost: 'uzastopnih dobitaka pa promeni' });
  const onLoss = triggerGroup('mines-shift-onloss', 'Rotacija nakon promašaja (Shift on Loss)',
    { stay: 'Ostani na istim mestima', now: 'Promeni poziciju odmah nakon eksplozije', afterPre: 'Sačekaj', afterPost: 'uzastopnih promašaja pa promeni' });
  const algo = h('select', { id: 'mines-shift-algo' },
    h('option', { value: 'mirror' }, 'Mirror (ogledalo)'),
    h('option', { value: 'invert' }, 'Invert (suprotna polja)'),
    h('option', { value: 'random' }, 'Random Shift (nasumični skok)'));
  algo.value = 'random';
  container.append(h('div', { class: 'shift-box' },
    h('div', { class: 'stat-sub' }, 'Hibridni okidači rotacije'),
    onWin.row, onLoss.row,
    h('label', { class: 'field' }, h('span', {}, 'Algoritam rotacije'), algo)));
  return {
    getShift() { return { onWin: onWin.get(), onLoss: onLoss.get(), algo: algo.value }; },
    setShift(s = {}) { onWin.set(s.onWin); onLoss.set(s.onLoss); if (['mirror', 'invert', 'random'].includes(s.algo)) algo.value = s.algo; },
    inputs: [...onWin.inputs, ...onLoss.inputs, algo],
  };
}
