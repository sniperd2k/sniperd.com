import { describe, it, expect } from 'vitest';
import {
  createTurbo,
  runPlaythroughHunt,
  runStandardHuntSuite,
  scriptedPlaythrough,
  detectScoreSanity,
  detectStuckBall,
  detectPlungerFailure,
  detectFlipperFailure,
  PHYSICS_TURBO,
  SCORE_TURBO,
  HUNT_WALL_BUDGET_MS,
  snapshotInvariants,
} from '../../src/game/turbo.js';
import { createGame, tick, tryLaunch, getHud } from '../../src/game/game.js';
import { createInputState } from '../../src/game/input.js';

describe('turbo controller (default OFF)', () => {
  it('defaults to 1× and setTurbo clamps', () => {
    const state = createGame();
    const input = createInputState();
    const t = createTurbo(state, input);
    expect(t.getTurbo()).toBe(1);
    expect(t.setTurbo(100)).toBe(100);
    expect(t.setTurbo(0)).toBe(1);
    expect(t.setTurbo(-5)).toBe(1);
    expect(t.setTurbo(99999)).toBe(2000);
  });

  it('normal play path: single tick when turbo=1', () => {
    const state = createGame({ seed: 1 });
    const input = createInputState();
    const t = createTurbo(state, input);
    tryLaunch(state, 0.9);
    const f0 = state.frame;
    t.turboTick();
    expect(state.frame).toBe(f0 + 1);
  });

  it('turboTick(n) advances n frames', () => {
    const state = createGame({ seed: 2 });
    const input = createInputState();
    const t = createTurbo(state, input);
    t.setTurbo(50);
    tryLaunch(state, 1);
    const f0 = state.frame;
    t.turboTick();
    expect(state.frame).toBe(f0 + 50);
  });

  it('autoPlunge + autoFlip helpers drive play', () => {
    const state = createGame({ seed: 3 });
    const input = createInputState();
    const hud = scriptedPlaythrough(state, input, {
      ticks: 200,
      autoPlunge: true,
      autoFlipL: true,
      autoFlipR: true,
      turbo: 1,
    });
    expect(hud).toBeTruthy();
    expect(typeof hud.score).toBe('number');
    expect(hud.score).toBeGreaterThanOrEqual(0);
  });
});

describe('hunt detectors', () => {
  it('plunger and flipper baseline pass', () => {
    expect(detectPlungerFailure()).toEqual([]);
    const g = createGame();
    const input = createInputState();
    expect(detectFlipperFailure(g, input)).toEqual([]);
  });

  it('score sanity flags negative scores', () => {
    const snaps = [
      { score: 100, balls: 3, powderValue: 1, powderPlusHits: 0, powderBankHits: 0, frame: 1 },
      { score: -5, balls: 3, powderValue: 1, powderPlusHits: 0, powderBankHits: 0, frame: 2 },
    ];
    const f = detectScoreSanity(snaps);
    expect(f.some((x) => x.type === 'negative_score')).toBe(true);
  });

  it('stuck detector ignores empty history', () => {
    expect(detectStuckBall([])).toBeNull();
  });
});

describe('turbo playthrough hunt — standard two-pass (≤30s)', () => {
  it('physics pass @ ~100× finds no disasters (or documents)', () => {
    const result = runPlaythroughHunt({
      mode: 'physics',
      turbo: PHYSICS_TURBO,
      maxTicks: 8000,
      sampleEvery: 40,
      maxWallMs: 12_000,
      maxGames: 4,
      seed: 42,
    });
    expect(result.turbo).toBe(PHYSICS_TURBO);
    expect(result.wallMs).toBeLessThan(15_000);
    expect(result.ticks).toBeGreaterThan(100);
    if (!result.ok) {
      // Fail hard — hunt findings block deploy
      expect.fail(
        `physics hunt findings: ${JSON.stringify(result.findings, null, 2)}`
      );
    }
  });

  it('score pass @ ~15× finds no score sanity bugs', () => {
    const result = runPlaythroughHunt({
      mode: 'score',
      turbo: SCORE_TURBO,
      maxTicks: 5000,
      sampleEvery: 15,
      maxWallMs: 12_000,
      maxGames: 3,
      seed: 49,
      alwaysScoreCheck: true,
    });
    expect(result.turbo).toBe(SCORE_TURBO);
    expect(result.wallMs).toBeLessThan(15_000);
    if (!result.ok) {
      expect.fail(`score hunt findings: ${JSON.stringify(result.findings, null, 2)}`);
    }
  });

  it('combined standard suite stays within 30s and is green', () => {
    const suite = runStandardHuntSuite({
      budgetMs: HUNT_WALL_BUDGET_MS,
      physicsTurbo: PHYSICS_TURBO,
      scoreTurbo: SCORE_TURBO,
      seed: 42,
    });
    expect(suite.withinBudget).toBe(true);
    expect(suite.wallMs).toBeLessThanOrEqual(30_000);
    expect(suite.physics.turbo).toBe(PHYSICS_TURBO);
    expect(suite.score.turbo).toBe(SCORE_TURBO);
    expect(suite.physics.ticks).toBeGreaterThan(0);
    expect(suite.score.ticks).toBeGreaterThan(0);
    if (!suite.ok) {
      expect.fail(`standard hunt findings: ${JSON.stringify(suite.findings, null, 2)}`);
    }
  });

  it('new game resets score after game over (direct)', () => {
    const g = createGame({ seed: 11 });
    g.score = 12_000_000;
    g.gameOver = true;
    g.balls = 0;
    tryLaunch(g, 0.9);
    expect(g.gameOver).toBe(false);
    expect(g.score).toBe(0);
    expect(g.balls).toBe(3);
    expect(getHud(g).score).toBe(0);
  });

  it('snapshot invariants shape', () => {
    const g = createGame();
    const snap = snapshotInvariants(g);
    expect(snap).toHaveProperty('score');
    expect(snap).toHaveProperty('ballsList');
    expect(snap.ballsList.length).toBeGreaterThan(0);
  });
});
