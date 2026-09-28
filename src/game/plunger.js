/**
 * Plunger pull → launch power curve.
 * pullNorm: 0..1 (how far the plunger is pulled)
 * Returns launch speed and how far up the lane the ball travels conceptually.
 */

export const PLUNGER_MIN_PULL = 0.08;
export const PLUNGER_MAX_SPEED = 22;
export const PLUNGER_MIN_SPEED = 4;

/**
 * Power curve: short pull = soft, long pull = hard.
 * Uses ease-in quadratic so short pulls stay gentle.
 */
export function plungerPower(pullNorm) {
  const t = clamp01(pullNorm);
  if (t < PLUNGER_MIN_PULL) return 0;
  const u = (t - PLUNGER_MIN_PULL) / (1 - PLUNGER_MIN_PULL);
  const curved = u * u; // ease-in
  return PLUNGER_MIN_SPEED + curved * (PLUNGER_MAX_SPEED - PLUNGER_MIN_SPEED);
}

/**
 * Fraction of chairlift lane height reached (0..1) for a given pull.
 * Short pull only partway up the lane.
 */
export function plungerLaneReach(pullNorm) {
  const speed = plungerPower(pullNorm);
  if (speed <= 0) return 0;
  const reach = (speed - PLUNGER_MIN_SPEED) / (PLUNGER_MAX_SPEED - PLUNGER_MIN_SPEED);
  // Map to 0.25..1.0 so short pull still moves a bit
  return 0.25 + clamp01(reach) * 0.75;
}

export function pullFromDrag(startY, currentY, maxTravel) {
  const dy = Math.max(0, currentY - startY);
  const max = Math.max(1, maxTravel);
  return clamp01(dy / max);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export { clamp01 };
