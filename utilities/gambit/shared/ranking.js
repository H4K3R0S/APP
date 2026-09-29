// Rangiranje strategija za Hub (korak 27): sažetak analize + grupe preporučene (>70% Tier 3) / ostale / netestirane.
export const RECOMMEND_THRESHOLD = 70;

export function summarizeAnalysis(report) {
  const o = report?.overall;
  if (!o || !Number.isFinite(Number(o.tier3Avg))) return null;
  const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  return {
    tier3Avg: num(o.tier3Avg),
    tier5Avg: num(o.tier5Avg),
    maxLossStreak: num(o.maxLossStreak),
    recommendedBalance: num(o.recommendedBalance),
    bankruptAvg: num(o.bankruptAvg),
    finishedAt: report.finishedAt || null,
    totalRounds: num(report.totalRounds),
  };
}

export function scoreOf(entry) {
  return entry?.summary ? Number(entry.summary.tier3Avg) || 0 : 0;
}

export function rankStrategies(list = []) {
  const tested = list.filter((e) => e.summary);
  const netestirane = list.filter((e) => !e.summary).sort((a, b) => a.name.localeCompare(b.name));
  const byScore = (a, b) => (scoreOf(b) - scoreOf(a)) || a.name.localeCompare(b.name);
  const preporucene = tested.filter((e) => scoreOf(e) > RECOMMEND_THRESHOLD).sort(byScore);
  const ostale = tested.filter((e) => scoreOf(e) <= RECOMMEND_THRESHOLD).sort(byScore);
  return { preporucene, ostale, netestirane, ordered: [...preporucene, ...ostale, ...netestirane] };
}
