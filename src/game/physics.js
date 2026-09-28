/**
 * SniperD Pinball physics — Matter.js, fixed ~120 Hz, downhill tilt gravity.
 * Vendored Matter via assets/vendor (browser script tag / vitest setup).
 * Real collision responses; hinged flippers with angle stops + short impulse.
 */

import Matter from '../../assets/vendor/matter.mjs';

const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;

export const TABLE_W = 360;
export const TABLE_H = 640;
export const BALL_R = 8;

/**
 * Fixed timestep. Matter.js uses per-step velocities (px/tick), so we align
 * the engine update to 60 Hz (Matter base delta). Solver is still fixed-step;
 * bump to 120 with half-velocity if mobile perf allows later.
 */
export const PHYSICS_HZ = 60;
export const FIXED_DT_MS = 1000 / PHYSICS_HZ;
export const FIXED_DT = FIXED_DT_MS / 1000;

/**
 * Tunable Zaccaria / Pinball FX–style params.
 * Gravity is downhill tilt along the playfield (+Y toward drain).
 */
export const TUNING = {
  gravityX: 0,
  gravityY: 1,
  // Matter gravity: force += mass * y * scale; scale~0.001 is table tilt feel
  gravityScale: 0.00095,
  flipperPower: 0.55,       // angle tracking gain
  flipperReturn: 0.28,
  flipperMaxOmega: 0.55,    // rad per Matter step (NOT rad/s)
  rubberRestitution: 0.85,
  wallRestitution: 0.72,
  bumperKick: 0.08,         // Matter force units
  bumperRestitution: 1.2,
  ballFriction: 0.001,
  ballFrictionAir: 0.02,
  ballRestitution: 0.5,
  ballDensity: 0.004,
  slingKick: 0.06,
};

export const GRAVITY = TUNING.gravityScale;
export const FRICTION = 1 - TUNING.ballFrictionAir;
export const WALL_RESTITUTION = TUNING.wallRestitution;
export const BUMPER_RESTITUTION = TUNING.bumperRestitution;
export const FLIPPER_POWER = TUNING.flipperPower;

export function vec(x, y) {
  return { x, y };
}

export function len(v) {
  return Math.hypot(v.x, v.y);
}

export function norm(v) {
  const L = len(v) || 1;
  return { x: v.x / L, y: v.y / L };
}

let _ballSeq = 0;
export function createBall(x, y, vx = 0, vy = 0) {
  _ballSeq += 1;
  return {
    x,
    y,
    vx,
    vy,
    r: BALL_R,
    active: true,
    held: false,
    body: null,
    id: `b${_ballSeq}`,
  };
}

export function createFlipper(pivotX, pivotY, length, restAngle, swing, side) {
  return {
    pivotX,
    pivotY,
    length,
    restAngle,
    swing,
    side,
    angle: restAngle,
    pressed: false,
    angularVel: 0,
    body: null,
    constraint: null,
    thickness: side === 'mini' ? 8 : 12,
  };
}

export function createBumper(x, y, r = 16, id = 'bumper') {
  return { x, y, r, id, cooldown: 0, body: null };
}

export function createSegment(x1, y1, x2, y2, kind = 'wall') {
  return { x1, y1, x2, y2, kind };
}

export function createCircleTrigger(x, y, r, id) {
  return { x, y, r, id, body: null };
}

function segBody(seg, restitution) {
  const cx = (seg.x1 + seg.x2) / 2;
  const cy = (seg.y1 + seg.y2) / 2;
  const length = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) || 1;
  const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
  const thickness = seg.kind === 'lane' ? 5 : seg.kind === 'ramp' ? 7 : 8;
  const b = Bodies.rectangle(cx, cy, length, thickness, {
    isStatic: true,
    angle,
    restitution,
    friction: 0.02,
    label: seg.kind || 'wall',
  });
  b.plugin = { kind: seg.kind };
  return b;
}

/**
 * Italian Bottom + mobile-classic layout (portrait).
 */
export function createTableGeometry() {
  const W = TABLE_W;
  const H = TABLE_H;

  const walls = [
    createSegment(22, 44, 22, H - 28, 'wall'),
    createSegment(W - 22, 44, W - 22, H - 90, 'wall'),
    createSegment(22, 44, W - 22, 44, 'wall'),
    createSegment(22, H - 28, 105, H - 10, 'wall'),
    createSegment(W - 95, H - 10, W - 52, H - 88, 'wall'),
    createSegment(22, H - 150, 48, H - 70, 'wall'),
    createSegment(58, H - 145, 108, H - 58, 'sling'),
    createSegment(W - 118, H - 58, W - 58, H - 140, 'sling'),
    createSegment(W - 55, H - 88, W - 40, H - 50, 'wall'),
    createSegment(W - 46, H - 88, W - 46, 115, 'lane'),
    createSegment(W - 20, H - 88, W - 20, 115, 'lane'),
    createSegment(W - 46, 115, W - 20, 115, 'lane'),
    createSegment(36, 200, 95, 95, 'ramp'),
    createSegment(48, 208, 108, 105, 'ramp'),
    createSegment(145, 175, 175, 78, 'ramp'),
    createSegment(195, 175, 215, 78, 'ramp'),
    createSegment(40, 70, 120, 55, 'orbit'),
    createSegment(120, 55, 240, 55, 'orbit'),
    createSegment(240, 55, 310, 75, 'orbit'),
    createSegment(310, 75, 310, 160, 'orbit'),
    createSegment(70, H - 210, 85, H - 165, 'fan'),
    createSegment(100, H - 215, 112, H - 168, 'fan'),
    createSegment(130, H - 218, 140, H - 170, 'fan'),
    createSegment(160, H - 218, 170, H - 170, 'fan'),
    createSegment(190, H - 215, 202, H - 168, 'fan'),
    createSegment(220, H - 210, 235, H - 165, 'fan'),
    createSegment(250, H - 200, 262, H - 160, 'fan'),
    createSegment(80, H - 250, 95, H - 220, 'fan'),
    createSegment(230, H - 250, 245, H - 220, 'fan'),
  ];

  const bumpers = [
    createBumper(115, 235, 17, 'powder0'),
    createBumper(175, 210, 18, 'powder1'),
    createBumper(235, 235, 17, 'powder2'),
    createBumper(140, 285, 15, 'powder3'),
    createBumper(210, 285, 15, 'powder4'),
  ];

  const triggers = [
    createCircleTrigger(W - 33, 100, 16, 'chairlift_scoop'),
    createCircleTrigger(72, 92, 18, 'powder_plus_exit'),
    createCircleTrigger(195, 72, 16, 'pipe_exit'),
    createCircleTrigger(285, 355, 20, 'tree_well'),
    createCircleTrigger(175, 145, 18, 'vault'),
    createCircleTrigger(52, H - 155, 12, 'inlane_left'),
    createCircleTrigger(W - 105, H - 155, 12, 'inlane_right'),
    createCircleTrigger(36, H - 55, 12, 'outlane_left'),
    createCircleTrigger(W - 68, H - 48, 12, 'outlane_right'),
    createCircleTrigger(55, 100, 12, 'orbit_left'),
    createCircleTrigger(300, 120, 12, 'orbit_right'),
  ];

  const targets = [
    { x: 55, y: 330, w: 16, h: 11, id: 'B', letter: 'B', bank: 'BOARD' },
    { x: 78, y: 328, w: 16, h: 11, id: 'O', letter: 'O', bank: 'BOARD' },
    { x: 101, y: 326, w: 16, h: 11, id: 'A', letter: 'A', bank: 'BOARD' },
    { x: 124, y: 328, w: 16, h: 11, id: 'R', letter: 'R', bank: 'BOARD' },
    { x: 147, y: 330, w: 16, h: 11, id: 'D', letter: 'D', bank: 'BOARD' },
    { x: 68, y: 385, w: 16, h: 11, id: 'L', letter: 'L', bank: 'LODGE' },
    { x: 91, y: 383, w: 16, h: 11, id: 'O2', letter: 'O', bank: 'LODGE' },
    { x: 114, y: 381, w: 16, h: 11, id: 'D2', letter: 'D', bank: 'LODGE' },
    { x: 137, y: 383, w: 16, h: 11, id: 'G', letter: 'G', bank: 'LODGE' },
    { x: 160, y: 385, w: 16, h: 11, id: 'E', letter: 'E', bank: 'LODGE' },
  ];

  const flippers = [
    createFlipper(118, H - 58, 54, 0.55, -0.95, 'left'),
    createFlipper(242, H - 58, 54, Math.PI - 0.55, 0.95, 'right'),
    createFlipper(98, 155, 34, 0.35, -0.75, 'mini'),
  ];

  const plunger = {
    x: W - 33,
    y: H - 42,
    laneTop: 115,
    laneBottom: H - 42,
  };

  const engine = Engine.create({
    gravity: {
      x: TUNING.gravityX,
      y: TUNING.gravityY,
      scale: TUNING.gravityScale,
    },
  });
  engine.enableSleeping = false;

  const geo = {
    W,
    H,
    walls,
    bumpers,
    triggers,
    targets,
    flippers,
    plunger,
    drainY: H - 4,
    engine,
    _matterReady: false,
    _pendingEvents: [],
    _triggerArmed: Object.create(null),
    _ballBodies: new Set(),
  };

  buildMatterWorld(geo);
  return geo;
}

function buildMatterWorld(geo) {
  if (geo._matterReady) return;
  const { engine } = geo;
  const statics = [];

  for (const seg of geo.walls) {
    const rest =
      seg.kind === 'sling'
        ? TUNING.rubberRestitution
        : seg.kind === 'ramp'
          ? 0.55
          : TUNING.wallRestitution;
    statics.push(segBody(seg, rest));
  }

  for (const bumper of geo.bumpers) {
    const b = Bodies.circle(bumper.x, bumper.y, bumper.r, {
      isStatic: true,
      restitution: TUNING.bumperRestitution,
      friction: 0,
      label: `bumper:${bumper.id}`,
    });
    bumper.body = b;
    b.plugin = { bumper };
    statics.push(b);
  }

  for (const t of geo.triggers) {
    const b = Bodies.circle(t.x, t.y, t.r, {
      isStatic: true,
      isSensor: true,
      label: `trigger:${t.id}`,
    });
    t.body = b;
    b.plugin = { trigger: t };
    statics.push(b);
  }

  for (const target of geo.targets) {
    const b = Bodies.rectangle(
      target.x + target.w / 2,
      target.y + target.h / 2,
      target.w,
      target.h,
      { isStatic: true, restitution: 0.35, label: `target:${target.id}` }
    );
    target.body = b;
    b.plugin = { target };
    statics.push(b);
  }

  for (const f of geo.flippers) {
    const w = f.length;
    const h = f.thickness;
    const cx = f.pivotX + Math.cos(f.restAngle) * (w / 2);
    const cy = f.pivotY + Math.sin(f.restAngle) * (w / 2);
    const body = Bodies.rectangle(cx, cy, w, h, {
      restitution: 0.12,
      friction: 0.02,
      density: 0.08,
      label: `flipper:${f.side}`,
      collisionFilter: { category: 0x0008, mask: 0x0001 },
    });
    Body.setAngle(body, f.restAngle);
    const constraint = Constraint.create({
      bodyA: body,
      pointA: { x: -w / 2, y: 0 },
      pointB: { x: f.pivotX, y: f.pivotY },
      length: 0,
      stiffness: 1,
      damping: 0.05,
    });
    f.body = body;
    f.constraint = constraint;
    body.plugin = { flipper: f, isFlipper: true };
    statics.push(body);
    Composite.add(engine.world, constraint);
  }

  Composite.add(engine.world, statics);

  Events.on(engine, 'collisionStart', (ev) => {
    for (const pair of ev.pairs) handlePair(geo, pair, true);
  });
  Events.on(engine, 'collisionActive', (ev) => {
    for (const pair of ev.pairs) handlePair(geo, pair, false);
  });
  Events.on(engine, 'beforeUpdate', () => {
    for (const f of geo.flippers) {
      if (!f.body) continue;
      f.body.force.x = 0;
      f.body.force.y = 0;
      f.body.torque = 0;
    }
  });

  geo._matterReady = true;
}

function isBallLabel(b) {
  return b && typeof b.label === 'string' && b.label.startsWith('ball:');
}

function pick(pair, pred) {
  if (pred(pair.bodyA)) return { hit: pair.bodyA, other: pair.bodyB };
  if (pred(pair.bodyB)) return { hit: pair.bodyB, other: pair.bodyA };
  return null;
}

function handlePair(geo, pair, isStart) {
  const events = geo._pendingEvents;
  if (!events) return;

  const bump = pick(pair, (b) => b.plugin?.bumper);
  if (bump && isBallLabel(bump.other) && isStart) {
    const bumper = bump.hit.plugin.bumper;
    if (bumper.cooldown <= 0) {
      const ballBody = bump.other;
      const nx = ballBody.position.x - bumper.x;
      const ny = ballBody.position.y - bumper.y;
      const d = Math.hypot(nx, ny) || 1;
      Body.applyForce(ballBody, ballBody.position, {
        x: (nx / d) * TUNING.bumperKick,
        y: (ny / d) * TUNING.bumperKick,
      });
      bumper.cooldown = 8;
      events.push({ type: 'bumper', id: bumper.id, ball: ballBody.plugin?.ball });
    }
  }

  const sling = pick(pair, (b) => b.plugin?.kind === 'sling');
  if (sling && isBallLabel(sling.other) && isStart) {
    const ballBody = sling.other;
    const mid = sling.hit.position;
    const nx = ballBody.position.x - mid.x;
    const ny = ballBody.position.y - mid.y;
    const d = Math.hypot(nx, ny) || 1;
    Body.applyForce(ballBody, ballBody.position, {
      x: (nx / d) * TUNING.slingKick,
      y: (ny / d) * TUNING.slingKick * 0.55,
    });
    events.push({ type: 'sling', ball: ballBody.plugin?.ball });
  }

  const flip = pick(pair, (b) => b.plugin?.isFlipper);
  if (flip && isBallLabel(flip.other) && isStart) {
    events.push({
      type: 'flipper',
      side: flip.hit.plugin.flipper.side,
      ball: flip.other.plugin?.ball,
    });
  }

  const ramp = pick(pair, (b) => b.plugin?.kind === 'ramp');
  if (ramp && isBallLabel(ramp.other) && isStart) {
    events.push({ type: 'ramp_contact', ball: ramp.other.plugin?.ball });
  }

  const tgt = pick(pair, (b) => b.plugin?.target);
  if (tgt && isBallLabel(tgt.other) && isStart) {
    const target = tgt.hit.plugin.target;
    if (!target._hit) {
      target._hit = true;
      events.push({
        type: 'target',
        id: target.id,
        letter: target.letter,
        bank: target.bank,
        ball: tgt.other.plugin?.ball,
      });
    }
  }

  const trig = pick(pair, (b) => b.plugin?.trigger);
  if (trig && isBallLabel(trig.other) && isStart) {
    const t = trig.hit.plugin.trigger;
    const ball = trig.other.plugin?.ball;
    const key = `${t.id}|${ball?.id || trig.other.id}`;
    if (!geo._triggerArmed[key]) {
      geo._triggerArmed[key] = true;
      events.push({ type: 'trigger', id: t.id, ball });
    }
  }
}

export function setFlipperPressed(flipper, pressed) {
  flipper.pressed = !!pressed;
}

function stepFlipperMatter(flipper) {
  const body = flipper.body;
  if (!body) return;
  const target = flipper.pressed
    ? flipper.restAngle + flipper.swing
    : flipper.restAngle;
  const minA = Math.min(flipper.restAngle, flipper.restAngle + flipper.swing);
  const maxA = Math.max(flipper.restAngle, flipper.restAngle + flipper.swing);

  let diff = target - body.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  const gain = flipper.pressed ? TUNING.flipperPower : TUNING.flipperReturn;
  let omega = diff * gain * 1.8;
  const maxO = TUNING.flipperMaxOmega * (flipper.pressed ? 1.15 : 0.75);
  omega = Math.max(-maxO, Math.min(maxO, omega));

  if (Math.abs(diff) < 0.025) {
    Body.setAngle(body, target);
    Body.setAngularVelocity(body, 0);
  } else {
    Body.setAngularVelocity(body, omega);
  }

  if (body.angle < minA - 0.015) {
    Body.setAngle(body, minA);
    Body.setAngularVelocity(body, Math.max(0, body.angularVelocity));
  } else if (body.angle > maxA + 0.015) {
    Body.setAngle(body, maxA);
    Body.setAngularVelocity(body, Math.min(0, body.angularVelocity));
  }

  flipper.angle = body.angle;
  flipper.angularVel = body.angularVelocity;
}

export function stepFlipper(flipper, dt = 1) {
  if (!flipper.body) {
    const target = flipper.pressed
      ? flipper.restAngle + flipper.swing
      : flipper.restAngle;
    const speed = flipper.pressed ? 0.45 : 0.25;
    const diff = target - flipper.angle;
    const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
    const prev = flipper.angle;
    flipper.angle += step;
    flipper.angularVel = flipper.angle - prev;
    return;
  }
  stepFlipperMatter(flipper);
}

function ensureBallBody(geo, ball) {
  if (ball.body) return ball.body;
  const body = Bodies.circle(ball.x, ball.y, ball.r, {
    restitution: TUNING.ballRestitution,
    friction: TUNING.ballFriction,
    frictionAir: TUNING.ballFrictionAir,
    density: TUNING.ballDensity,
    label: `ball:${ball.id}`,
    collisionFilter: { category: 0x0001, mask: 0xffffffff },
  });
  Body.setVelocity(body, { x: ball.vx, y: ball.vy });
  body.plugin = { ball };
  ball.body = body;
  return body;
}

function addBallToWorld(geo, ball) {
  ensureBallBody(geo, ball);
  if (!geo._ballBodies.has(ball.body)) {
    Composite.add(geo.engine.world, ball.body);
    geo._ballBodies.add(ball.body);
  }
}

function removeBallFromWorld(geo, ball) {
  if (ball.body && geo._ballBodies.has(ball.body)) {
    Composite.remove(geo.engine.world, ball.body);
    geo._ballBodies.delete(ball.body);
  }
}

function syncBallFromBody(ball) {
  if (!ball.body || ball.held) return;
  ball.x = ball.body.position.x;
  ball.y = ball.body.position.y;
  ball.vx = ball.body.velocity.x;
  ball.vy = ball.body.velocity.y;
}

export function syncBallToBody(ball) {
  if (!ball.body) return;
  Body.setPosition(ball.body, { x: ball.x, y: ball.y });
  Body.setVelocity(ball.body, { x: ball.vx, y: ball.vy });
}

export function applyBallState(geometry, ball) {
  ensureBallBody(geometry, ball);
  Body.setPosition(ball.body, { x: ball.x, y: ball.y });
  Body.setVelocity(ball.body, { x: ball.vx, y: ball.vy });
  if (ball.active && !ball.held) addBallToWorld(geometry, ball);
  else removeBallFromWorld(geometry, ball);
}

/**
 * Step physics one or more fixed 120 Hz ticks.
 * @param {object} world { balls, geometry }
 * @param {number} dtSteps number of fixed steps
 */
export function stepPhysics(world, dtSteps = 1) {
  const events = [];
  const { balls, geometry: geo } = world;
  if (!geo._matterReady) buildMatterWorld(geo);
  geo._pendingEvents = events;

  const steps = Math.max(1, dtSteps | 0);

  for (const bumper of geo.bumpers) {
    if (bumper.cooldown > 0) bumper.cooldown -= steps;
  }
  for (const target of geo.targets) {
    if (!target._hit) continue;
    let still = false;
    for (const ball of balls) {
      if (!ball.active || ball.held) continue;
      if (
        ball.x + ball.r > target.x &&
        ball.x - ball.r < target.x + target.w &&
        ball.y + ball.r > target.y &&
        ball.y - ball.r < target.y + target.h
      ) {
        still = true;
        break;
      }
    }
    if (!still) target._hit = false;
  }

  for (let s = 0; s < steps; s++) {
    for (const f of geo.flippers) stepFlipperMatter(f);

    for (const ball of balls) {
      if (!ball.active) {
        removeBallFromWorld(geo, ball);
        continue;
      }
      ensureBallBody(geo, ball);
      if (ball.held) {
        removeBallFromWorld(geo, ball);
        continue;
      }
      addBallToWorld(geo, ball);
    }

    Engine.update(geo.engine, FIXED_DT_MS);

    for (const ball of balls) {
      if (!ball.active || ball.held) continue;
      syncBallFromBody(ball);
      if (ball.y > geo.drainY) {
        ball.active = false;
        removeBallFromWorld(geo, ball);
        events.push({ type: 'drain', ball });
      }
    }

    // Re-arm triggers once ball leaves sensor
    for (const key of Object.keys(geo._triggerArmed)) {
      const [tid, bid] = key.split('|');
      const t = geo.triggers.find((x) => x.id === tid);
      const ball = balls.find((b) => b.id === bid);
      if (!t || !ball || !ball.active || ball.held) {
        delete geo._triggerArmed[key];
        continue;
      }
      if (Math.hypot(ball.x - t.x, ball.y - t.y) > t.r + ball.r + 2) {
        delete geo._triggerArmed[key];
      }
    }
  }

  return events;
}

/** Launch from plunger. powerFn returns legacy speed units; converted to Matter vy. */
export function launchFromPlunger(ball, geometry, pullNorm, powerFn) {
  const p = geometry.plunger;
  ball.x = p.x;
  ball.y = p.y - 10;
  ball.held = false;
  ball.active = true;
  const speed = powerFn(pullNorm);
  // Matter velocity is px per engine step (aligned with 60 Hz FIXED_DT)
  const matterVy = -speed;
  ball.vx = 0;
  ball.vy = matterVy;
  ensureBallBody(geometry, ball);
  Body.setPosition(ball.body, { x: ball.x, y: ball.y });
  Body.setVelocity(ball.body, { x: 0, y: matterVy });
  Body.setAngularVelocity(ball.body, 0);
  addBallToWorld(geometry, ball);
  return speed;
}

export function placeBallInPlunger(ball, geometry) {
  const p = geometry.plunger;
  ball.x = p.x;
  ball.y = p.y - 5;
  ball.vx = 0;
  ball.vy = 0;
  ball.held = true;
  ball.active = true;
  ensureBallBody(geometry, ball);
  Body.setPosition(ball.body, { x: ball.x, y: ball.y });
  Body.setVelocity(ball.body, { x: 0, y: 0 });
  removeBallFromWorld(geometry, ball);
}

export function simulate(world, steps, dt = 1) {
  const all = [];
  for (let i = 0; i < steps; i++) {
    all.push(...stepPhysics(world, dt));
  }
  return all;
}

/** Kick ball with velocity (no teleport) — scoop / kickout helper */
export function kickBall(ball, geometry, vx, vy) {
  if (!ball || !ball.active) return;
  ball.held = false;
  ball.vx = vx;
  ball.vy = vy;
  applyBallState(geometry, ball);
}

export { Matter, Engine, Body, Bodies, Composite };
