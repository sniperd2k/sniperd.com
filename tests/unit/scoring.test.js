import { describe, it, expect } from 'vitest';
import {
  M,
  chairliftScoopValue,
  nextChairliftClimb,
  powderPlusRampValue,
  powderBumperValue,
  powderValueCap,
  treeWellCollect,
  boardBonusValue,
  snowCollectValue,
  pipeRampValue,
  multiballJackpot,
  applyScore,
  formatScore,
  peakAwardByIndex,
} from '../../src/game/scoring.js';

describe('scoring math', () => {
  it('chairlift scoop climbs 2M→5M', () => {
    expect(chairliftScoopValue(0)).toBe(2 * M);
    expect(chairliftScoopValue(1)).toBe(3 * M);
    expect(chairliftScoopValue(2)).toBe(4 * M);
    expect(chairliftScoopValue(3)).toBe(5 * M);
    expect(chairliftScoopValue(99)).toBe(5 * M);
    expect(nextChairliftClimb(0)).toBe(1);
    expect(nextChairliftClimb(3)).toBe(3);
  });

  it('powder plus ramp 1M→10M per ball', () => {
    expect(powderPlusRampValue(0)).toBe(1 * M);
    expect(powderPlusRampValue(4)).toBe(5 * M);
    expect(powderPlusRampValue(9)).toBe(10 * M);
    expect(powderPlusRampValue(50)).toBe(10 * M);
  });

  it('bumper value caps at 4M', () => {
    expect(powderBumperValue(0)).toBe(1 * M);
    expect(powderBumperValue(3)).toBe(4 * M);
    expect(powderBumperValue(100)).toBe(4 * M);
    expect(powderValueCap()).toBe(4 * M);
  });

  it('tree well 5× when lit', () => {
    expect(treeWellCollect(2 * M, false)).toBe(2 * M);
    expect(treeWellCollect(2 * M, true)).toBe(10 * M);
  });

  it('BOARD bonus 2M→10M', () => {
    expect(boardBonusValue(0)).toBe(0);
    expect(boardBonusValue(1)).toBe(2 * M);
    expect(boardBonusValue(5)).toBe(10 * M);
  });

  it('SNOW collect tiers 5/10/15M', () => {
    expect(snowCollectValue(0)).toBe(5 * M);
    expect(snowCollectValue(1)).toBe(10 * M);
    expect(snowCollectValue(2)).toBe(15 * M);
    expect(snowCollectValue(9)).toBe(15 * M);
  });

  it('pipe ramp grows with mode progress', () => {
    expect(pipeRampValue(0)).toBe(500_000);
    expect(pipeRampValue(2)).toBe(1_000_000);
  });

  it('multiball jackpot scales', () => {
    expect(multiballJackpot(5 * M, 2)).toBe(10 * M);
  });

  it('applyScore accumulates', () => {
    const s = applyScore({ score: 100 }, 50, 'test');
    expect(s.score).toBe(150);
    expect(s.lastReason).toBe('test');
  });

  it('formatScore', () => {
    expect(formatScore(2 * M)).toBe('2M');
    expect(formatScore(5000)).toBe('5K');
  });

  it('peak awards rotate', () => {
    expect(peakAwardByIndex(0).id).toBe('points');
    expect(peakAwardByIndex(5).id).toBe('points');
  });
});
