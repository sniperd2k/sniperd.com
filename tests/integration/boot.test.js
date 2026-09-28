import { describe, it, expect } from 'vitest';
import {
  createGame,
  tick,
  tryLaunch,
  getHud,
  inject,
  inspectState,
  setFlippersFromInput,
} from '../../src/game/game.js';
import { createInputState } from '../../src/game/input.js';
import { M } from '../../src/game/scoring.js';

describe('integration: boot and cycles', () => {
  it('boots with plunger ball and zero score', () => {
    const g = createGame({ seed: 42 });
    const hud = getHud(g);
    expect(hud.score).toBe(0);
    expect(hud.balls).toBe(3);
    expect(hud.ballInPlay).toBe(false);
    expect(g.ballsList[0].held).toBe(true);
  });

  it('plunge → ball in play; drain → next ball', () => {
    const g = createGame({ seed: 7 });
    tryLaunch(g, 1);
    expect(g.ballInPlay).toBe(true);
    inject(g, {
      ball: { x: 180, y: g.geometry.drainY + 2, vx: 0, vy: 2, held: false, active: true },
    });
    tick(g);
    expect(g.ballInPlay).toBe(false);
    expect(g.balls).toBe(2);
    expect(g.ballsList[0].held).toBe(true);
  });

  it('flipper input applies press state', () => {
    const g = createGame();
    const input = createInputState();
    input.left = true;
    input.right = true;
    setFlippersFromInput(g, input);
    const left = g.geometry.flippers.find((f) => f.side === 'left');
    const right = g.geometry.flippers.find((f) => f.side === 'right');
    expect(left.pressed).toBe(true);
    expect(right.pressed).toBe(true);
    for (let i = 0; i < 6; i++) tick(g, input);
    expect(left.angle).not.toBe(left.restAngle);
  });

  it('bumper hit increases score (HUD)', () => {
    const g = createGame({ seed: 3 });
    tryLaunch(g, 1);
    const bumper = g.geometry.bumpers[0];
    inject(g, {
      ball: { x: bumper.x, y: bumper.y - bumper.r - 10, vx: 0, vy: 6, held: false, active: true },
    });
    const before = g.score;
    for (let i = 0; i < 20; i++) tick(g);
    expect(g.score).toBeGreaterThan(before);
    expect(getHud(g).score).toBe(g.score);
  });

  it('CADET target spots letter and scores', () => {
    const g = createGame();
    tryLaunch(g, 0.9);
    const target = g.geometry.targets.find((t) => t.bank === 'CADET' && t.letter === 'C');
    inject(g, {
      ball: { x: target.x + 5, y: target.y + 2, vx: 0, vy: 3, held: false, active: true },
    });
    for (let i = 0; i < 5; i++) tick(g);
    expect(g.cadet.lit[0]).toBe(true);
    expect(g.score).toBeGreaterThanOrEqual(250_000);
  });

  it('inspect/inject API works', () => {
    const g = createGame();
    inject(g, { score: 5 * M, balls: 1 });
    const snap = inspectState(g);
    expect(snap.score).toBe(5 * M);
    expect(snap.hud.balls).toBe(1);
  });

  it('tiny pull does not launch', () => {
    const g = createGame();
    tryLaunch(g, 0.01);
    expect(g.ballInPlay).toBe(false);
    expect(g.ballsList[0].held).toBe(true);
  });
});
