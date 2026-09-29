// Benchmark istorija: data/benchmark.jsonl (jedan JSON red po simulaciji); čitanje poslednjih N, pokvaren red se preskače.
import fs from 'node:fs/promises';
import path from 'node:path';

const FILE = 'benchmark.jsonl';

export async function appendBenchmark(dataDir, row) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.appendFile(path.join(dataDir, FILE), `${JSON.stringify(row)}\n`, 'utf8');
}

export async function readBenchmarks(dataDir, limit = 20) {
  let text = '';
  try { text = await fs.readFile(path.join(dataDir, FILE), 'utf8'); } catch { return []; }
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* pokvaren red */ }
  }
  return rows.slice(-limit).reverse();
}
