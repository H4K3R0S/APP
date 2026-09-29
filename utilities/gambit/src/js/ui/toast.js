// Diskretna obaveštenja u donjem desnom uglu. toast(msg, 'info'|'ok'|'error', ms)
import { h } from './dom.js';

function root() {
  let el = document.getElementById('toast-root');
  if (!el) { el = h('div', { id: 'toast-root' }); document.body.append(el); }
  return el;
}

export function toast(msg, kind = 'info', ms = 2500) {
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  root().append(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 320); }, ms);
  return el;
}
