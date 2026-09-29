// Kontrola radnika (korak 30): slajder 1…maxAllowed (hardkodovani limit 14) + režim radnika (procesi | niti).
import { h } from '../ui/dom.js';

export function mountThreadControl(el, hw = { threads: 1, maxAllowed: 1, recommended: 1, reserved: 0 }) {
  const range = h('input', { id: 'sim-threads', type: 'range', min: '1', max: String(hw.maxAllowed), step: '1', value: String(hw.recommended || hw.maxAllowed) });
  const text = h('div', { id: 'sim-threads-text', class: 'threads-text' });
  const mode = h('select', { id: 'sim-worker-mode', title: 'Režim radnika' },
    h('option', { value: 'processes' }, 'Procesi (brže)'),
    h('option', { value: 'threads' }, 'Worker niti'));
  el.replaceChildren(
    h('div', { class: 'threads-row' }, h('span', { class: 'threads-lbl' }, 'Radnici'), range, mode),
    text,
  );
  function render() {
    const n = Number(range.value);
    const reserved = Math.max(0, hw.threads - n);
    text.textContent = `Dodeli ${n} ${n === 1 ? 'radnika' : 'radnika'} (Preporučeno ${hw.recommended}) — ${reserved} niti rezervisano za sistem od ${hw.threads}`;
  }
  range.addEventListener('input', render);
  render();
  return {
    el: { range, text, mode },
    get: () => Math.max(1, Math.min(Number(range.value) || 1, hw.maxAllowed)),
    set(n) { range.value = String(Math.max(1, Math.min(Number(n) || 1, hw.maxAllowed))); render(); },
    setHardware(next) { hw = { ...hw, ...next }; range.max = String(hw.maxAllowed); if (Number(range.value) > hw.maxAllowed) range.value = String(hw.maxAllowed); render(); },
    getMode: () => (mode.value === 'threads' ? 'threads' : 'processes'),
    setMode(m) { mode.value = m === 'threads' ? 'threads' : 'processes'; },
    setLocked(b) { range.disabled = !!b; mode.disabled = !!b; },
  };
}
