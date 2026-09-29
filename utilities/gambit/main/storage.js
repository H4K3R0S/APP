// Storage strategija i analiza: data/<game>/<ime>.json i data/<game>/<ime>_analiza.json (Main proces).
import fs from 'node:fs/promises';
import path from 'node:path';
import { GAMES } from '../shared/strategy_schema.js';
import { summarizeAnalysis } from '../shared/ranking.js';

const ANALYSIS_SUFFIX = '_analiza.json';
const MAX_NAME = 60;

function gameDir(dataDir, game) {
  if (!GAMES.includes(game)) throw new Error(`Nepoznata igra: ${game}`);
  return path.join(dataDir, game);
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// Samo [A-Za-z0-9_-]; razmaci/ostalo → '_'; max 60; prazno → <Igra>_Strategy_<YYYYMMDD-HHMMSS>.
export function sanitizeName(name, game = 'dice') {
  let s = String(name ?? '').trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_NAME);
  if (!s) s = `${game[0].toUpperCase()}${game.slice(1)}_Strategy_${stamp()}`;
  return s;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`storage: preskačem ${file}: ${e.message}`);
    return null;
  }
}

export async function listStrategies(dataDir, game) {
  const dir = gameDir(dataDir, game);
  await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && !f.endsWith(ANALYSIS_SUFFIX)).sort();
  const out = [];
  for (const f of files) {
    const obj = await readJson(path.join(dir, f));
    if (!obj || typeof obj !== 'object') continue;
    const name = f.slice(0, -'.json'.length);
    let hasAnalysis = false;
    try { await fs.access(path.join(dir, `${name}${ANALYSIS_SUFFIX}`)); hasAnalysis = true; } catch { /* nema */ }
    out.push({ name, file: path.join(dir, f), game, type: obj.type === 'multi' ? 'multi' : 'solo', hasAnalysis, createdAt: obj.createdAt || null });
  }
  return out;
}

// Sve igre odjednom, sa sažetkom analize (Hub ne otvara N fajlova iz renderera).
export async function listAllStrategies(dataDir) {
  const out = [];
  for (const game of GAMES) {
    const list = await listStrategies(dataDir, game);
    for (const s of list) {
      let summary = null;
      if (s.hasAnalysis) summary = summarizeAnalysis(await loadAnalysis(dataDir, game, s.name));
      out.push({ ...s, hasAnalysis: !!summary, summary });
    }
  }
  return out;
}

// Prepis: dozvoljen samo za isti tip (solo→solo, multi→multi) i tada briše zastarelu analizu (opisivala je stara pravila).
// Solo↔multi prepis je odbijen — inače hibrid tiho uništi bazu i „nasledi“ njen 🌟 rang.
export async function saveStrategy(dataDir, game, obj) {
  const dir = gameDir(dataDir, game);
  await fs.mkdir(dir, { recursive: true });
  const name = sanitizeName(obj?.strategyName, game);
  const file = path.join(dir, `${name}.json`);
  const type = obj?.type === 'multi' ? 'multi' : 'solo';
  const existing = await readJson(file);
  if (existing) {
    const existingType = existing.type === 'multi' ? 'multi' : 'solo';
    if (existingType !== type) {
      return { error: `Postoji ${existingType === 'multi' ? 'hibridna' : 'solo'} strategija „${name}“ — izaberi drugo ime` };
    }
    try { await fs.unlink(path.join(dir, `${name}${ANALYSIS_SUFFIX}`)); } catch { /* nema analize */ }
  }
  const data = { ...obj, game, strategyName: name };
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  return { name, file, overwritten: !!existing };
}

export async function loadStrategy(dataDir, game, name) {
  const dir = gameDir(dataDir, game);
  return readJson(path.join(dir, `${sanitizeName(name, game)}.json`));
}

export async function deleteStrategy(dataDir, game, name) {
  const dir = gameDir(dataDir, game);
  const base = sanitizeName(name, game);
  let removed = false;
  for (const f of [`${base}.json`, `${base}${ANALYSIS_SUFFIX}`]) {
    try { await fs.unlink(path.join(dir, f)); if (f === `${base}.json`) removed = true; } catch { /* nema */ }
  }
  return removed;
}

export async function saveAnalysis(dataDir, game, name, report) {
  const dir = gameDir(dataDir, game);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${sanitizeName(name, game)}${ANALYSIS_SUFFIX}`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
  return { file };
}

export async function loadAnalysis(dataDir, game, name) {
  const dir = gameDir(dataDir, game);
  return readJson(path.join(dir, `${sanitizeName(name, game)}${ANALYSIS_SUFFIX}`));
}
