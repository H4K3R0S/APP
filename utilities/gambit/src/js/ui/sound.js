// Mali zvučni efekti (WebAudio, bez fajlova): kratki „ding" na pogodak, „buzz" na promašaj.
// Koristi se za sve igre (Dice, Mines, Keno). Tiho po defaultu ako AudioContext nije dostupan.
let ctx = null;
let enabled = true;

function ac() {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch { ctx = null; }
  return ctx;
}

function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.06, slideTo = null }) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function playWin() {
  tone({ freq: 660, slideTo: 990, dur: 0.14, type: 'triangle', gain: 0.07 });
}

export function playLose() {
  tone({ freq: 300, slideTo: 150, dur: 0.16, type: 'sawtooth', gain: 0.05 });
}

export function setSoundEnabled(on) { enabled = !!on; }
export function isSoundEnabled() { return enabled; }
