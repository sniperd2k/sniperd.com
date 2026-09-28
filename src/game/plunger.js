/**
 * Plunger pull → launch power curve.
 * pullNorm: 0..1 (how far the plunger is pulled)
 * Returns launch speed (Matter.js vy magnitude) for the skill lane.
 */

export const PLUNGER_MIN_PULL = 0.08;
/** Full pull must clear lane exit into upper playfield. */
export const PLUNGER_MAX_SPEED = 28;
export const PLUNGER_MIN_SPEED = 7;

/**
 * Power curve: short pull = soft (falls back in lane),
 * long pull = hard (reaches skill shot / upper PF).
 * Mild ease-in so medium pulls still climb.
 */
export function plungerPower(pullNorm) {
  const t = clamp01(pullNorm);
  if (t < PLUNGER_MIN_PULL) return 0;
  const u = (t - PLUNGER_MIN_PULL) / (1 - PLUNGER_MIN_PULL);
  const curved = Math.pow(u, 1.35);
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
