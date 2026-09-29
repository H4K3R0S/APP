// Keno analitika (renderer): Top 3 sidro krugovi + toggle toplotne mape; prati svako izvlačenje u sesiji.
import { h } from '../../ui/dom.js';
import { subscribe } from '../../state.js';
import { createFreq, record, topAnchors, heat, resetFreq } from '../../../../shared/keno_freq.js';

export function mountKenoFreq(ui) {
  const freq = createFreq();
  const anchorsEl = h('div', { id: 'keno-anchors', class: 'keno-anchors' });
  const heatToggle = h('input', { id: 'keno-heat-toggle', type: 'checkbox' });
  ui.el.statsSlot.append(
    h('div', { class: 'stat-sub' }, 'Top 3 sidro'),
    anchorsEl,
    h('label', { class: 'heat-toggle' }, heatToggle, h('span', {}, 'Prikaži učestalost')),
  );
  let anchors = [];

  function applyHeat() { ui.setHeat(heatToggle.checked ? heat(freq) : null); }
  function update() {
    anchors = topAnchors(freq, 3);
    anchorsEl.replaceChildren(...anchors.map((n) => h('div', { class: 'anchor' },
      h('div', { class: 'num' }, String(n)),
      h('span', { class: 'cnt' }, `Izvučen ${freq.map[n]}×`))));
    applyHeat();
  }

  heatToggle.addEventListener('change', applyHeat);
  ui.onDraw((drawn) => { record(freq, drawn); update(); });
  const unsubscribe = subscribe((key) => { if (key === 'reset') { resetFreq(freq); update(); } });
  update();

  return { freq, getAnchors: () => [...anchors], update, unsubscribe, el: { anchorsEl, heatToggle } };
}
