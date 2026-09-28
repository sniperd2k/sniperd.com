import { describe, it, expect } from 'vitest';
import { createGame, tick, inject, tryLaunch } from '../../src/game/game.js';
import { applyBallState } from '../../src/game/physics.js';

describe('perf: bumper storm frame budget', () => {
  it('1000 ticks under bumper storm stay under budget', () => {
    const g = createGame({ seed: 99 });
    tryLaunch(g, 1);
    const b = g.geometry.bumpers[1];
    inject(g, {
      ball: { x: b.x, y: b.y - 20, vx: 4, vy: -3, held: false, active: true },
    });
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      if (i % 30 === 0) {
        const bb = g.geometry.bumpers[i % g.geometry.bumpers.length];
        const ball = g.ballsList[0];
        ball.x = bb.x;
        ball.y = bb.y - 18;
        ball.vx = 3;
        ball.vy = 5;
        ball.active = true;
        ball.held = false;
        applyBallState(g.geometry, ball);
      }
      tick(g);
    }
    const ms = performance.now() - t0;
    // Matter is heavier; still well under 2s on CI for 1000 ticks
    expect(ms).toBeLessThan(2000);
    expect(ms / 1000).toBeLessThan(2);
  });
});
