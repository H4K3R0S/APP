// Sysmon: CPU% (delta idle/total preko svih jezgara) + RAM; push 'sys:stats' u renderer.
import os from 'node:os';

const GB = 2 ** 30;
const round1 = (x) => Math.round(x * 10) / 10;

function cpuTimes() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const k of Object.keys(c.times)) total += c.times[k];
    idle += c.times.idle;
  }
  return { idle, total };
}

// Čista funkcija: prev = _raw iz prethodnog uzorka (ili null → cpu 0).
export function sample(prevRaw) {
  const raw = cpuTimes();
  let cpu = 0;
  if (prevRaw) {
    const dt = raw.total - prevRaw.total;
    const di = raw.idle - prevRaw.idle;
    cpu = dt > 0 ? round1((1 - di / dt) * 100) : 0;
    cpu = Math.min(100, Math.max(0, cpu));
  }
  const total = os.totalmem();
  const used = total - os.freemem();
  return { cpu, ramUsedGb: round1(used / GB), ramTotalGb: round1(total / GB), _raw: raw };
}

// getWindow: () => BrowserWindow|null. Vraća {stop, setFast}.
export function startSysMon(getWindow, intervalMs = 1500, fastMs = 500) {
  let prev = null;
  let timer = null;
  let stopped = false;
  let current = intervalMs;
  const tick = () => {
    const s = sample(prev);
    prev = s._raw;
    const win = getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('sys:stats', { cpu: s.cpu, ramUsedGb: s.ramUsedGb, ramTotalGb: s.ramTotalGb });
    }
  };
  const arm = () => { if (stopped) return; clearInterval(timer); timer = setInterval(tick, current); };
  arm();
  return {
    stop() { stopped = true; clearInterval(timer); timer = null; },
    setFast(fast) { current = fast ? fastMs : intervalMs; arm(); },
  };
}

