/**
 * Pure scoring helpers for SniperD Pinball.
 * Values are in points (1M = 1_000_000).
 */

export const M = 1_000_000;

/** Chairlift scoop skill-shot / climb: 2M → 5M */
export function chairliftScoopValue(climbIndex) {
  const steps = [2 * M, 3 * M, 4 * M, 5 * M];
  const i = Math.max(0, Math.min(climbIndex | 0, steps.length - 1));
  return steps[i];
}

export function nextChairliftClimb(climbIndex) {
  return Math.min(3, (climbIndex | 0) + 1);
}

/** Powder Plus Ramp: 1M → 10M per ball */
export function powderPlusRampValue(hitsThisBall) {
  const n = Math.max(0, hitsThisBall | 0);
  return Math.min(10 * M, (1 + n) * M);
}

/** Powder Bank bumper value: 1M → 4M per ball */
export function powderBumperValue(hitsThisBall) {
  const n = Math.max(0, hitsThisBall | 0);
  return Math.min(4 * M, (1 + n) * M);
}

export function powderValueCap() {
  return 4 * M;
}

/** Tree Well collect: powder value, or 5× when lit */
export function treeWellCollect(powderValue, lit) {
  const base = Math.max(0, powderValue | 0);
  return lit ? base * 5 : base;
}

/** BOARD bonus: 2M → 10M game-long (letters completed count 0..5) */
export function boardBonusValue(lettersLit) {
  const n = Math.max(0, Math.min(5, lettersLit | 0));
  if (n <= 0) return 0;
  // 1 letter → 2M, 5 letters → 10M linear
  return (2 + (n - 1) * 2) * M;
}

/** SNOW collect at Chairlift: 5M / 10M / 15M by completion count */
export function snowCollectValue(completions) {
  const n = Math.max(0, completions | 0);
  const tiers = [5 * M, 10 * M, 15 * M];
  return tiers[Math.min(n, tiers.length - 1)];
}

/** Center pipe ramp base + mode progress points */
export function pipeRampValue(modeProgress) {
  const base = 500_000;
  const bonus = Math.max(0, modeProgress | 0) * 250_000;
  return base + bonus;
}

/** Peak award temporary collect values */
export const PEAK_AWARDS = Object.freeze([
  { id: 'points', label: 'PEAK 1M', value: 1 * M },
  { id: 'light_snow', label: 'SPOT SNOW', value: 0 },
  { id: 'powder_up', label: 'POWDER +1M', value: 0 },
  { id: 'points2', label: 'PEAK 2M', value: 2 * M },
  { id: 'hold_bonus', label: 'HOLD BONUS', value: 0 },
]);

export function peakAwardByIndex(index) {
  const list = PEAK_AWARDS;
  const i = ((index % list.length) + list.length) % list.length;
  return list[i];
}

/** Multiball jackpot at Vault / Chairlift */
export function multiballJackpot(base, litCount) {
  const b = Math.max(1 * M, base | 0);
  const n = Math.max(1, litCount | 0);
  return b * n;
}

export function formatScore(n) {
  const v = Math.max(0, n | 0);
  if (v >= M) {
    const mil = v / M;
    return Number.isInteger(mil) ? `${mil}M` : `${mil.toFixed(1)}M`;
  }
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(v);
}

/** Apply a scored event to a mutable score state (pure-ish: returns new object) */
export function applyScore(state, amount, reason = '') {
  const add = Math.max(0, amount | 0);
  return {
    ...state,
    score: (state.score | 0) + add,
    lastAward: add,
    lastReason: reason,
  };
}
