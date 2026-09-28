import { describe, it, expect } from 'vitest';
import {
  plungerPower,
  plungerLaneReach,
  pullFromDrag,
  PLUNGER_MIN_PULL,
  PLUNGER_MAX_SPEED,
} from '../../src/game/plunger.js';

describe('plunger power curve', () => {
  it('ignores tiny pulls', () => {
    expect(plungerPower(0)).toBe(0);
    expect(plungerPower(PLUNGER_MIN_PULL / 2)).toBe(0);
  });

  it('short pull weaker than full pull', () => {
    const soft = plungerPower(0.25);
    const hard = plungerPower(1);
    expect(soft).toBeGreaterThan(0);
    expect(hard).toBeGreaterThan(soft);
    expect(hard).toBeLessThanOrEqual(PLUNGER_MAX_SPEED);
  });

  it('short pull only partway up lane', () => {
    const short = plungerLaneReach(0.2);
    const full = plungerLaneReach(1);
    expect(short).toBeLessThan(full);
    expect(full).toBeCloseTo(1, 5);
    expect(short).toBeGreaterThan(0.2);
  });

  it('pullFromDrag maps pixels', () => {
    expect(pullFromDrag(100, 100, 100)).toBe(0);
    expect(pullFromDrag(100, 150, 100)).toBe(0.5);
    expect(pullFromDrag(100, 300, 100)).toBe(1);
  });
});
