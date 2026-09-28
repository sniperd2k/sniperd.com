import { describe, it, expect } from 'vitest';
import { createGame, tick, inject, tryLaunch } from '../../src/game/game.js';

describe('perf: bumper storm frame budget', () => {
  it('1000 ticks under bumper storm stay under budget', () => {
    const g = createGame({ seed: 99 });
    tryLaunch(g, 1);
    // park ball among bumpers and thrash
    const b = g.geometry.bumpers[1];
    inject(g, {
      ball: { x: b.x, y: b.y - 20, vx: 4, vy: -3, held: false, active: true },
    });
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      // jitter toward bumpers to keep storm going
      if (i % 30 === 0) {
        const bb = g.geometry.bumpers[i % g.geometry.bumpers.length];
        g.ballsList[0].x = bb.x;
        g.ballsList[0].y = bb.y - 18;
        g.ballsList[0].vy = 5;
        g.ballsList[0].active = true;
      }
      tick(g);
    }
    const ms = performance.now() - t0;
    // generous: 1000 ticks should finish well under 2s on CI
    expect(ms).toBeLessThan(2000);
    // average < 2ms/tick
    expect(ms / 1000).toBeLessThan(2);
  });
});
