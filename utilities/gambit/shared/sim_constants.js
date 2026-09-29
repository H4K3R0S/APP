// Konstante Monte Carlo simulacije (spec §3.6).
export const BUDGETS = [1, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
export const SESSIONS_PER_BUDGET = 1000;
export const TIERS = [1.5, 2, 5, 10, 1000];
export const TIER_LABELS = ['Tier 1 (1.5×)', 'Tier 2 (2×)', 'Tier 3 (5×)', 'Tier 4 (10×)', 'Tier 5 (1000×)'];
export const TARGET_MULTIPLE = 1000;
export const MAX_ROUNDS_PER_SESSION = 200000;
export const SERIES_MAX_POINTS = 2000;
