import { describe, it, expect } from 'vitest';
import {
  createTableGeometry,
  createBall,
  placeBallInPlunger,
  launchFromPlunger,
  stepPhysics,
  simulate,
  setFlipperPressed,
  GRAVITY,
} from '../../src/game/physics.js';
import { plungerPower } from '../../src/game/plunger.js';

function worldWithBall(ball, geo = createTableGeometry()) {
  return { balls: [ball], geometry: geo };
}

describe('deterministic physics', () => {
  it('gravity pulls ball down with fixed dt in open space', () => {
    const geo = createTableGeometry();
    // clear lower-left alley away from bumpers/ramps/flippers
    const ball = createBall(55, 480, 0, 0);
    ball.held = false;
    const world = worldWithBall(ball, geo);
    const y0 = ball.y;
    const vy0 = ball.vy;
    stepPhysics(world, 1);
    expect(ball.vy).toBeGreaterThan(vy0);
    // gravity then friction: vy ≈ (vy0 + GRAVITY) * FRICTION
    expect(ball.vy).toBeGreaterThan(0.15);
    expect(ball.vy).toBeLessThan(0.2);
    expect(ball.y).toBeGreaterThan(y0);
  });

  it('identical seeds/steps are deterministic', () => {
    const run = () => {
      const geo = createTableGeometry();
      const ball = createBall(180, 300, 2, -6);
      ball.held = false;
      const world = { balls: [ball], geometry: geo };
      simulate(world, 40);
      return { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
    };
    expect(run()).toEqual(run());
  });

  it('plunger launch sends ball up lane', () => {
    const geo = createTableGeometry();
    const ball = createBall(0, 0);
    placeBallInPlunger(ball, geo);
    const speed = launchFromPlunger(ball, geo, 1, plungerPower);
    expect(speed).toBeGreaterThan(10);
    expect(ball.vy).toBeLessThan(0);
    expect(ball.held).toBe(false);
    const y0 = ball.y;
    const world = { balls: [ball], geometry: geo };
    simulate(world, 15);
    expect(ball.y).toBeLessThan(y0);
  });

  it('short plunger weaker than full', () => {
    const geo = createTableGeometry();
    const soft = createBall(0, 0);
    const hard = createBall(0, 0);
    placeBallInPlunger(soft, geo);
    placeBallInPlunger(hard, geo);
    const s1 = launchFromPlunger(soft, geo, 0.2, plungerPower);
    const s2 = launchFromPlunger(hard, geo, 1, plungerPower);
    expect(s2).toBeGreaterThan(s1);
  });

  it('flipper impulse registers flipper event when pressed', () => {
    const geo = createTableGeometry();
    const left = geo.flippers.find((f) => f.side === 'left');
    setFlipperPressed(left, true);
    // warm flipper toward raised angle
    for (let i = 0; i < 5; i++) {
      stepPhysics({ balls: [], geometry: geo }, 1);
    }
    const tipX = left.pivotX + Math.cos(left.angle) * left.length * 0.65;
    const tipY = left.pivotY + Math.sin(left.angle) * left.length * 0.65;
    const ball = createBall(tipX, tipY - 12, 0, 3);
    ball.held = false;
    const world = { balls: [ball], geometry: geo };
    const before = { vx: ball.vx, vy: ball.vy };
    const events = simulate(world, 12);
    const flipHits = events.filter((e) => e.type === 'flipper' && e.side === 'left');
    expect(flipHits.length).toBeGreaterThan(0);
    // velocity should change from the impulse
    expect(ball.vx !== before.vx || ball.vy !== before.vy).toBe(true);
  });

  it('bumper hit emits bumper event and kicks ball', () => {
    const geo = createTableGeometry();
    const bumper = geo.bumpers[0];
    const ball = createBall(bumper.x, bumper.y - bumper.r - 8, 0, 5);
    ball.held = false;
    const world = { balls: [ball], geometry: geo };
    let sawBumper = false;
    let vyAfter = null;
    for (let i = 0; i < 10; i++) {
      const events = stepPhysics(world, 1);
      if (events.some((e) => e.type === 'bumper')) {
        sawBumper = true;
        vyAfter = ball.vy;
        break;
      }
    }
    expect(sawBumper).toBe(true);
    expect(vyAfter).toBeLessThan(0);
  });

  it('ball below drainY drains', () => {
    const geo = createTableGeometry();
    const ball = createBall(180, geo.drainY + 1, 0, 1);
    ball.held = false;
    const world = { balls: [ball], geometry: geo };
    const events = stepPhysics(world, 1);
    expect(events.some((e) => e.type === 'drain')).toBe(true);
    expect(ball.active).toBe(false);
  });
});
