// Launcher test: gambit.sh mora da radi (1) bez DISPLAY u okruženju (dvoklik mimo terminala)
// i (2) u svežoj kopiji bez node_modules (prvo pokretanje sam instalira Electron iz keša).
import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, '..');

function runLauncher(cwd) {
  return spawnSync('/bin/bash', [path.join(cwd, 'gambit.sh'), '--smoke'], {
    cwd,
    timeout: 120000,
    encoding: 'utf8',
    env: { HOME: process.env.HOME, PATH: process.env.PATH, XAUTHORITY: process.env.XAUTHORITY || '' },
  });
}

test('gambit.sh --smoke radi bez DISPLAY u okruženju', () => {
  const r = runLauncher(ROOT);
  assert.strictEqual(r.status, 0, `status=${r.status}\nstderr=${r.stderr}\nstdout=${r.stdout}`);
  assert.match(r.stdout, /SMOKE OK/);
});

test('gambit.sh u kopiji bez node_modules sam instalira Electron i pokreće app', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gambit-fresh-'));
  for (const f of ['package.json', 'package-lock.json', 'main.js', 'preload.cjs', 'gambit.sh', 'main', 'shared', 'src']) {
    fs.cpSync(path.join(ROOT, f), path.join(tmp, f), { recursive: true });
  }
  try {
    const r = runLauncher(tmp);
    assert.strictEqual(r.status, 0, `status=${r.status}\nstderr=${r.stderr}\nstdout=${r.stdout}`);
    assert.match(r.stdout, /SMOKE OK/);
    assert.ok(fs.existsSync(path.join(tmp, 'node_modules', 'electron', 'dist', 'electron')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
