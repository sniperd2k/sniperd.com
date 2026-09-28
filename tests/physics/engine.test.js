import { describe, it, expect } from 'vitest';
import {
  createTableGeometry,
  createBall,
  placeBallInPlunger,
  launchFromPlunger,
  stepPhysics,
  simulate,
  setFlipperPressed,
  applyBallState,
  PHYSICS_HZ,
  FIXED_DT_MS,
  TUNING,
  TABLE_W,
  TABLE_H,
} from '../../src/game/physics.js';
import { plungerPower } from '../../src/game/plunger.js';

function worldWithBall(ball, geo = createTableGeometry()) {
  return { balls: [ball], geometry: geo };
}

describe('Matter.js fixed-step physics', () => {
  it('exposes ~60/120 Hz fixed timestep and downhill tilt gravity', () => {
    expect(PHYSICS_HZ).toBeGreaterThanOrEqual(60);
    expect(PHYSICS_HZ).toBeLessThanOrEqual(120);
    expect([60, 120]).toContain(PHYSICS_HZ);
    expect(FIXED_DT_MS).toBeCloseTo(1000 / PHYSICS_HZ, 5);
    expect(TUNING.gravityY).toBeGreaterThan(0);
    expect(TUNING.gravityScale).toBeGreaterThan(0);
    expect(TUNING.flipperPower).toBeGreaterThan(0);
    expect(TUNING.rubberRestitution).toBeGreaterThan(0);
    expect(TUNING.bumperKick).toBeGreaterThan(0);
  });

  it('gravity pulls ball downhill (+Y) in open space', () => {
    const geo = createTableGeometry();
    const ball = createBall(55, 480, 0, 0);
    ball.held = false;
    applyBallState(geo, ball);
    const y0 = ball.y;
    const vy0 = ball.vy;
    stepPhysics(worldWithBall(ball, geo), 1);
    expect(ball.vy).toBeGreaterThan(vy0);
    expect(ball.y).toBeGreaterThan(y0);
  });

  it('identical steps are deterministic', () => {
    const run = () => {
      const geo = createTableGeometry();
      const ball = createBall(180, 300, 2, -6);
      ball.held = false;
      applyBallState(geo, ball);
      const world = { balls: [ball], geometry: geo };
      simulate(world, 40);
      return {
        x: Math.round(ball.x * 1000) / 1000,
        y: Math.round(ball.y * 1000) / 1000,
        vx: Math.round(ball.vx * 1000) / 1000,
        vy: Math.round(ball.vy * 1000) / 1000,
      };
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
    simulate({ balls: [ball], geometry: geo }, 20);
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
    for (let i = 0; i < 8; i++) {
      stepPhysics({ balls: [], geometry: geo }, 1);
    }
    const tipX = left.pivotX + Math.cos(left.angle) * left.length * 0.65;
    const tipY = left.pivotY + Math.sin(left.angle) * left.length * 0.65;
    const ball = createBall(tipX, tipY - 12, 0, 4);
    ball.held = false;
    applyBallState(geo, ball);
    const world = { balls: [ball], geometry: geo };
    const before = { vx: ball.vx, vy: ball.vy };
    const events = simulate(world, 20);
    const flipHits = events.filter((e) => e.type === 'flipper' && e.side === 'left');
    expect(flipHits.length).toBeGreaterThan(0);
    expect(ball.vx !== before.vx || ball.vy !== before.vy).toBe(true);
  });

  it('bumper hit emits bumper event and kicks ball', () => {
    const geo = createTableGeometry();
    const bumper = geo.bumpers[0];
    const ball = createBall(bumper.x, bumper.y - bumper.r - 10, 0, 6);
    ball.held = false;
    applyBallState(geo, ball);
    const world = { balls: [ball], geometry: geo };
    let sawBumper = false;
    let vyAfter = null;
    for (let i = 0; i < 25; i++) {
      const events = stepPhysics(world, 1);
      if (events.some((e) => e.type === 'bumper')) {
        sawBumper = true;
        vyAfter = ball.vy;
        break;
      }
    }
    expect(sawBumper).toBe(true);
    expect(vyAfter).not.toBeNull();
  });

  it('ball below drainY drains', () => {
    const geo = createTableGeometry();
    const ball = createBall(180, geo.drainY + 1, 0, 2);
    ball.held = false;
    applyBallState(geo, ball);
    const events = stepPhysics({ balls: [ball], geometry: geo }, 1);
    expect(events.some((e) => e.type === 'drain')).toBe(true);
    expect(ball.active).toBe(false);
  });

  it('layout includes Cadet essentials', () => {
    const geo = createTableGeometry();
    expect(geo.W).toBe(TABLE_W);
    expect(geo.H).toBe(TABLE_H);
    expect(geo.flippers.filter((f) => f.side === 'left' || f.side === 'right').length).toBe(2);
    expect(geo.bumpers.length).toBeGreaterThanOrEqual(3);
    expect(geo.walls.some((w) => w.kind === 'sling')).toBe(true);
    expect(geo.walls.some((w) => w.kind === 'ramp')).toBe(true);
    expect(geo.walls.some((w) => w.kind === 'orbit')).toBe(true);
    expect(geo.walls.some((w) => w.kind === 'lane')).toBe(true);
    expect(geo.triggers.some((t) => t.id === 'skill_shot')).toBe(true);
    expect(geo.triggers.some((t) => t.id === 'saucer')).toBe(true);
    expect(geo.triggers.some((t) => t.id === 'ramp_exit')).toBe(true);
    expect(geo.triggers.some((t) => t.id === 'loop_exit')).toBe(true);
    expect(geo.triggers.some((t) => t.id === 'inlane_left')).toBe(true);
    expect(geo.triggers.some((t) => t.id === 'outlane_right')).toBe(true);
    expect(geo.targets.filter((t) => t.bank === 'CADET').length).toBe(5);
    const left = geo.flippers.find((f) => f.side === 'left');
    expect(left.pivotX).toBeGreaterThan(40);
    expect(left.pivotX).toBeLessThan(TABLE_W / 2);
    expect(geo.plunger.x).toBeGreaterThan(TABLE_W * 0.8);
  });
});
