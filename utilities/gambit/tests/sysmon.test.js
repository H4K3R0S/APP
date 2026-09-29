// sysmon.sample: čista funkcija nad os.cpus()/os.freemem(); prvi uzorak (bez prethodnog) daje cpu 0, nikad NaN.
import { test } from 'node:test';
import assert from 'node:assert';
import { sample } from '../main/sysmon.js';

test('sample(null) vraća cpu 0 i validan RAM, bez NaN', () => {
  const s = sample(null);
  assert.strictEqual(s.cpu, 0);
  assert.ok(s.ramTotalGb > 0);
  assert.ok(s.ramUsedGb >= 0 && s.ramUsedGb <= s.ramTotalGb);
  assert.ok(s._raw && typeof s._raw.idle === 'number' && typeof s._raw.total === 'number');
});

test('sample(prev) posle opterećenja daje cpu u [0,100]', () => {
  const first = sample(null);
  const end = Date.now() + 120;
  let x = 0;
  while (Date.now() < end) x += Math.sqrt(x + 1);
  const s = sample(first._raw);
  assert.ok(Number.isFinite(s.cpu), `cpu=${s.cpu}`);
  assert.ok(s.cpu >= 0 && s.cpu <= 100, `cpu=${s.cpu}`);
});
