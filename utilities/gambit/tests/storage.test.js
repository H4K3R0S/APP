// Storage strategija: data/<game>/<ime>.json + <ime>_analiza.json; sanitizacija imena; tolerancija na pokvaren JSON.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sanitizeName, listStrategies, saveStrategy, loadStrategy, deleteStrategy, saveAnalysis, loadAnalysis, listAllStrategies,
} from '../main/storage.js';

test('listAllStrategies: sve igre, sažetak iz analize, pokvarena/nepotpuna analiza → summary null', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gambit-all-'));
  await saveStrategy(dir, 'dice', { game: 'dice', strategyName: 'D1', type: 'solo', baseBet: 1 });
  await saveStrategy(dir, 'mines', { game: 'mines', strategyName: 'M1', type: 'solo', baseBet: 1 });
  await saveStrategy(dir, 'keno', { game: 'keno', strategyName: 'K1', type: 'multi', baseStrategy: 'x', triggers: [] });
  await saveAnalysis(dir, 'dice', 'D1', { overall: { tier3Avg: 84.2, tier5Avg: 0, maxLossStreak: 9, recommendedBalance: 511, bankruptAvg: 10 }, finishedAt: 'f', totalRounds: 3 });
  fs.writeFileSync(path.join(dir, 'mines', 'M1_analiza.json'), '{ "nema": "overall" }');
  const all = await listAllStrategies(dir);
  assert.deepStrictEqual(all.map((s) => `${s.game}/${s.name}/${s.type}`).sort(), ['dice/D1/solo', 'keno/K1/multi', 'mines/M1/solo']);
  const d1 = all.find((s) => s.name === 'D1');
  assert.strictEqual(d1.hasAnalysis, true);
  assert.strictEqual(d1.summary.tier3Avg, 84.2);
  assert.match(d1.file, /dice\/D1\.json$/);
  const m1 = all.find((s) => s.name === 'M1');
  assert.strictEqual(m1.summary, null);
  assert.strictEqual(m1.hasAnalysis, false, 'analiza bez overall = netestirano');
  assert.strictEqual(all.find((s) => s.name === 'K1').summary, null);
});

function tmpData() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gambit-data-'));
}
const strat = (name) => ({ game: 'dice', strategyName: name, type: 'solo', baseBet: 0.05, targetValue: 50.5, condition: 'over' });

test('sanitizeName: samo [A-Za-z0-9_-], max 60, prazno → Dice_Strategy_<datum>', () => {
  assert.strictEqual(sanitizeName('../x y'), 'x_y');
  assert.strictEqual(sanitizeName('Moja Test / Strategija!'), 'Moja_Test_Strategija');
  assert.strictEqual(sanitizeName('a'.repeat(80)).length, 60);
  assert.match(sanitizeName('', 'dice'), /^Dice_Strategy_\d{8}-\d{6}$/);
  assert.match(sanitizeName('   ', 'mines'), /^Mines_Strategy_/);
});

test('save → list sadrži → load vraća isti objekat → delete → list ne sadrži', async () => {
  const dir = tmpData();
  const { name, file } = await saveStrategy(dir, 'dice', strat('Moja_Test'));
  assert.strictEqual(name, 'Moja_Test');
  assert.ok(fs.existsSync(file) && file.startsWith(path.join(dir, 'dice')));
  const list = await listStrategies(dir, 'dice');
  assert.deepStrictEqual(list.map((s) => s.name), ['Moja_Test']);
  assert.strictEqual(list[0].hasAnalysis, false);
  const loaded = await loadStrategy(dir, 'dice', 'Moja_Test');
  assert.strictEqual(loaded.baseBet, 0.05);
  assert.strictEqual(loaded.strategyName, 'Moja_Test');
  assert.strictEqual(await deleteStrategy(dir, 'dice', 'Moja_Test'), true);
  assert.strictEqual(await deleteStrategy(dir, 'dice', 'Moja_Test'), false);
  assert.deepStrictEqual(await listStrategies(dir, 'dice'), []);
});

test('saveStrategy odbija prepis strategije DRUGOG tipa (solo↔multi) i briše zastarelu analizu pri prepisu istog tipa', async () => {
  const dir = tmpData();
  await saveStrategy(dir, 'dice', strat('Martingale'));
  await saveAnalysis(dir, 'dice', 'Martingale', { overall: { tier3Avg: 88 } });
  const res = await saveStrategy(dir, 'dice', { game: 'dice', strategyName: 'Martingale', type: 'multi', baseStrategy: 'Martingale', triggers: [] });
  assert.ok(res.error, 'hibrid ne sme pregaziti solo istog imena');
  assert.strictEqual((await loadStrategy(dir, 'dice', 'Martingale')).type, 'solo');
  assert.ok(await loadAnalysis(dir, 'dice', 'Martingale'), 'analiza netaknuta');
  const again = await saveStrategy(dir, 'dice', { ...strat('Martingale'), baseBet: 0.1 });
  assert.strictEqual(again.name, 'Martingale');
  assert.strictEqual((await loadStrategy(dir, 'dice', 'Martingale')).baseBet, 0.1);
  assert.strictEqual(await loadAnalysis(dir, 'dice', 'Martingale'), null, 'prepis istog tipa briše staru analizu (više ne opisuje pravila)');
});

test('ime sa ../ ne izlazi iz data/<game>/', async () => {
  const dir = tmpData();
  const { file } = await saveStrategy(dir, 'dice', strat('../../evil'));
  assert.ok(file.startsWith(path.join(dir, 'dice') + path.sep), file);
  assert.strictEqual(path.basename(file), 'evil.json');
});

test('pokvaren JSON u folderu ne obara list; nepoznata igra baca', async () => {
  const dir = tmpData();
  fs.mkdirSync(path.join(dir, 'dice'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'dice', 'los.json'), '{ nije json');
  await saveStrategy(dir, 'dice', strat('dobar'));
  const list = await listStrategies(dir, 'dice');
  assert.deepStrictEqual(list.map((s) => s.name), ['dobar']);
  await assert.rejects(() => listStrategies(dir, 'poker'), /igra/i);
  assert.strictEqual(await loadStrategy(dir, 'dice', 'nema'), null);
});

test('analiza: saveAnalysis → hasAnalysis true → loadAnalysis; delete strategije briše i analizu', async () => {
  const dir = tmpData();
  await saveStrategy(dir, 'dice', strat('A'));
  await saveAnalysis(dir, 'dice', 'A', { tier3Avg: 84.2 });
  assert.ok(fs.existsSync(path.join(dir, 'dice', 'A_analiza.json')));
  assert.strictEqual((await listStrategies(dir, 'dice'))[0].hasAnalysis, true);
  assert.strictEqual((await loadAnalysis(dir, 'dice', 'A')).tier3Avg, 84.2);
  await deleteStrategy(dir, 'dice', 'A');
  assert.strictEqual(await loadAnalysis(dir, 'dice', 'A'), null);
  assert.strictEqual((await listStrategies(dir, 'dice')).length, 0, 'analiza nije izlistana kao strategija');
});
