import { describe, it, expect } from 'vitest';
import {
  createModeState,
  lightPeakAward,
  tickPeakTimer,
  openLodge,
  addLock,
  startMultiball,
  onBallDrain,
  bumpModeProgress,
  ModeId,
} from '../../src/game/modes.js';

describe('mode state machines', () => {
  it('lights and expires peak award', () => {
    let s = createModeState();
    s = lightPeakAward(s, 2);
    expect(s.peakLit).toBe(true);
    s = tickPeakTimer(s);
    expect(s.peakLit).toBe(true);
    s = tickPeakTimer(s);
    expect(s.peakLit).toBe(false);
    expect(s.mode).toBe(ModeId.IDLE);
  });

  it('LODGE → locks → multiball', () => {
    let s = openLodge(createModeState());
    expect(s.lodgeOpen).toBe(true);
    s = addLock(s);
    s = addLock(s);
    s = addLock(s);
    expect(s.locks).toBe(3);
    s = startMultiball(s, 3);
    expect(s.multiball).toBe(true);
    expect(s.mode).toBe(ModeId.MULTIBALL);
    expect(s.ballsInPlay).toBe(3);
  });

  it('drain ends multiball when one ball left', () => {
    let s = startMultiball(createModeState(), 2);
    s = onBallDrain(s);
    expect(s.multiball).toBe(false);
    expect(s.mode).toBe(ModeId.IDLE);
  });

  it('mode progress bumps', () => {
    const s = bumpModeProgress(createModeState(), 3);
    expect(s.modeProgress).toBe(3);
  });
});
