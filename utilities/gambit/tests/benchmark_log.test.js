// Benchmark istorija (data/benchmark.jsonl): append + čitanje poslednjih N, pokvaren red se preskače.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendBenchmark, readBenchmarks } from '../main/benchmark_log.js';

test('append 3 → read(2) vraća 2 poslednja (najnoviji prvi); pokvaren red preskočen', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gambit-bench-'));
  await appendBenchmark(dir, { ts: 't1', game: 'dice', strategy: 'A', threads: 2, workerMode: 'processes', durationMs: 100, rounds: 1000, roundsPerSec: 10000 });
  await appendBenchmark(dir, { ts: 't2', game: 'dice', strategy: 'B', threads: 4, workerMode: 'threads', durationMs: 200, rounds: 2000, roundsPerSec: 10000 });
  fs.appendFileSync(path.join(dir, 'benchmark.jsonl'), '{ pokvaren\n');
  await appendBenchmark(dir, { ts: 't3', game: 'mines', strategy: 'C', threads: 14, workerMode: 'processes', durationMs: 300, rounds: 3000, roundsPerSec: 10000 });
  const rows = await readBenchmarks(dir, 2);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].ts, 't3');
  assert.strictEqual(rows[1].ts, 't2');
  const all = await readBenchmarks(dir, 20);
  assert.strictEqual(all.length, 3);
  assert.deepStrictEqual(await readBenchmarks(fs.mkdtempSync(path.join(os.tmpdir(), 'gambit-empty-')), 5), []);
});
