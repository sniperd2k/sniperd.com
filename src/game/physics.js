/**
 * SniperD Pinball physics — Matter.js, fixed 60 Hz.
 * Original "Arcade Neon" woodrail playfield (Italian-bottom classic).
 * No third-party IP: no Williams/Bally/Gottlieb/Stern/MS Space Cadet assets.
 */

import Matter from '../../assets/vendor/matter.mjs';

const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;

export const TABLE_W = 360;
export const TABLE_H = 640;
export const BALL_R = 8;

/**
 * Fixed timestep. Matter.js uses per-step velocities (px/tick), so we align
 * the engine update to 60 Hz (Matter base delta).
 */
export const PHYSICS_HZ = 60;
export const FIXED_DT_MS = 1000 / PHYSICS_HZ;
export const FIXED_DT = FIXED_DT_MS / 1000;

/**
 * Playable Arcade Neon feel:
 * strong hinged flippers (cradle/aim), punchy jets/slings,
 * lively ball that still drains cleanly.
 */
export const TUNING = {
  gravityX: 0,
  gravityY: 1,
  gravityScale: 0.00098,
  flipperPower: 1.05,
  flipperReturn: 0.38,
  flipperMaxOmega: 0.95,
  flipperBatImpulse: 0.12,
  rubberRestitution: 0.92,
  wallRestitution: 0.65,
  bumperKick: 0.22,
  bumperRestitution: 1.35,
  ballFriction: 0.002,
  ballFrictionAir: 0.012,
  ballRestitution: 0.55,
  ballDensity: 0.0035,
  slingKick: 0.16,
  flipperDensity: 0.14,
  flipperRestitution: 0.55,
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
    thickness: side === 'mini' ? 9 : 13,
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
  const thickness =
    seg.kind === 'lane' ? 10 : seg.kind === 'ramp' ? 8 : seg.kind === 'sling' ? 10 : 8;
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
 * Original Arcade Neon woodrail layout — portrait Italian-bottom classic.
 * OPEN plunger exit (no dead-end cap), dual flippers + mini,
 * out/inlanes, slings, jet cluster, standup SNIPE bank,
 * left ramp + upper orbit / loop.
 */
export function createTableGeometry() {
  const W = TABLE_W;
  const H = TABLE_H;

  const walls = [
    // Outer woodrails
    createSegment(18, 40, 18, H - 24, 'wall'),
    createSegment(W - 18, 40, W - 18, H - 40, 'wall'),
    createSegment(18, 40, W - 18, 40, 'wall'),

    // Italian-bottom drain gutters (gap between flippers)
    createSegment(18, H - 24, 108, H - 6, 'wall'),
    createSegment(W - 108, H - 6, W - 56, H - 88, 'wall'),

    // Left outlane / inlane guides
    createSegment(18, H - 168, 54, H - 78, 'wall'),
    createSegment(60, H - 158, 112, H - 62, 'sling'),

    // Right sling + outlane toward plunger
    createSegment(W - 122, H - 62, W - 60, H - 152, 'sling'),
    createSegment(W - 56, H - 96, W - 40, H - 54, 'wall'),

    // Plunger skill lane — open left exit (no dead-end bounce-back).
    // Floor shelf keeps failed plunges from draining. Crest-exit kick
    // sends strong shots into the upper PF / skill corridor.
    createSegment(W - 54, H - 52, W - 54, 95, 'lane'),
    createSegment(W - 18, H - 52, W - 18, 42, 'lane'),
    createSegment(W - 54, H - 52, W - 18, H - 52, 'lane'),

    // Left neon ramp (two rails)
    createSegment(36, 220, 102, 78, 'ramp'),
    createSegment(52, 228, 118, 88, 'ramp'),
    createSegment(102, 78, 118, 88, 'ramp'),

    // Upper loop / orbit (chrome circuit)
    createSegment(36, 78, 110, 58, 'orbit'),
    createSegment(110, 58, 230, 58, 'orbit'),
    createSegment(230, 58, 290, 75, 'orbit'),
    createSegment(290, 75, 290, 160, 'orbit'),
    createSegment(290, 160, 255, 185, 'orbit'),

    // Mid guides — short, open (avoid dead pockets)
    createSegment(88, H - 250, 100, H - 200, 'guide'),
    createSegment(250, H - 250, 262, H - 200, 'guide'),
  ];

  const bumpers = [
    createBumper(130, 220, 18, 'jet0'),
    createBumper(200, 198, 19, 'jet1'),
    createBumper(168, 268, 17, 'jet2'),
    createBumper(238, 258, 16, 'jet3'),
    createBumper(112, 288, 15, 'jet4'),
  ];

  const triggers = [
    createCircleTrigger(W - 100, 70, 20, 'skill_shot'),
    createCircleTrigger(82, 90, 16, 'ramp_exit'),
    createCircleTrigger(270, 145, 14, 'loop_exit'),
    createCircleTrigger(180, 150, 17, 'saucer'),
    createCircleTrigger(54, H - 165, 12, 'inlane_left'),
    createCircleTrigger(W - 112, H - 165, 12, 'inlane_right'),
    createCircleTrigger(34, H - 58, 11, 'outlane_left'),
    createCircleTrigger(W - 72, H - 52, 11, 'outlane_right'),
  ];

  // Standup bank — SNIPE letters as vertical posts
  const targets = [
    { x: 42, y: 300, w: 10, h: 28, id: 'S', letter: 'S', bank: 'SNIPE' },
    { x: 66, y: 292, w: 10, h: 28, id: 'N', letter: 'N', bank: 'SNIPE' },
    { x: 90, y: 286, w: 10, h: 28, id: 'I', letter: 'I', bank: 'SNIPE' },
    { x: 114, y: 292, w: 10, h: 28, id: 'P', letter: 'P', bank: 'SNIPE' },
    { x: 138, y: 300, w: 10, h: 28, id: 'E', letter: 'E', bank: 'SNIPE' },
  ];

  // Longer flippers, tight gap for cradle / aim
  const flippers = [
    createFlipper(114, H - 56, 58, 0.52, -1.05, 'left'),
    createFlipper(246, H - 56, 58, Math.PI - 0.52, 1.05, 'right'),
    createFlipper(92, 162, 34, 0.38, -0.78, 'mini'),
  ];

  const plunger = {
    x: W - 35,
    y: H - 62,
    laneTop: 55,
    laneBottom: H - 52,
  };

  const engine = Engine.create({
    gravity: {
      x: TUNING.gravityX,
      y: TUNING.gravityY,
      scale: TUNING.gravityScale,
    },
  });
  engine.enableSleeping = false;
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

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
  const bodies = [];

  for (const seg of geo.walls) {
    const rest =
      seg.kind === 'sling'
        ? TUNING.rubberRestitution
        : seg.kind === 'ramp'
          ? 0.5
          : seg.kind === 'lane'
            ? 0.55
            : TUNING.wallRestitution;
    bodies.push(segBody(seg, rest));
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
    bodies.push(b);
  }

  for (const t of geo.triggers) {
    const b = Bodies.circle(t.x, t.y, t.r, {
      isStatic: true,
      isSensor: true,
      label: `trigger:${t.id}`,
    });
    t.body = b;
    b.plugin = { trigger: t };
    bodies.push(b);
  }

  for (const target of geo.targets) {
    const b = Bodies.rectangle(
      target.x + target.w / 2,
      target.y + target.h / 2,
      target.w,
      target.h,
      {
        isStatic: true,
        restitution: 0.75,
        friction: 0,
        frictionStatic: 0,
        label: `target:${target.id}`,
      }
    );
    target.body = b;
    b.plugin = { target };
    bodies.push(b);
  }

  for (const f of geo.flippers) {
    const w = f.length;
    const h = f.thickness;
    const cx = f.pivotX + Math.cos(f.restAngle) * (w / 2);
    const cy = f.pivotY + Math.sin(f.restAngle) * (w / 2);
    const body = Bodies.rectangle(cx, cy, w, h, {
      restitution: TUNING.flipperRestitution,
      friction: 0.04,
      density: TUNING.flipperDensity,
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
      damping: 0.02,
    });
    f.body = body;
    f.constraint = constraint;
    body.plugin = { flipper: f, isFlipper: true };
    bodies.push(body);
    Composite.add(engine.world, constraint);
  }

  Composite.add(engine.world, bodies);

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
      bumper.cooldown = 6;
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
      y: (ny / d) * TUNING.slingKick * 0.45 - TUNING.slingKick * 0.35,
    });
    events.push({ type: 'sling', ball: ballBody.plugin?.ball });
  }

  const flip = pick(pair, (b) => b.plugin?.isFlipper);
  if (flip && isBallLabel(flip.other) && isStart) {
    const flipper = flip.hit.plugin.flipper;
    const ballBody = flip.other;
    const omega = flipper.body?.angularVelocity || 0;
    if (Math.abs(omega) > 0.06) {
      const power = Math.min(1.8, Math.abs(omega) * 3.0) * TUNING.flipperBatImpulse;
      const outward = flipper.side === 'right' || flipper.swing > 0 ? -1 : 1;
      Body.applyForce(ballBody, ballBody.position, {
        x: outward * power * 0.3,
        y: -power * 1.15,
      });
    }
    events.push({
      type: 'flipper',
      side: flipper.side,
      ball: ballBody.plugin?.ball,
    });
  }

  const ramp = pick(pair, (b) => b.plugin?.kind === 'ramp');
  if (ramp && isBallLabel(ramp.other) && isStart) {
    events.push({ type: 'ramp_contact', ball: ramp.other.plugin?.ball });
  }

  const tgt = pick(pair, (b) => b.plugin?.target);
  if (tgt && isBallLabel(tgt.other) && isStart) {
    const target = tgt.hit.plugin.target;
    const ballBody = tgt.other;
    Body.applyForce(ballBody, ballBody.position, { x: 0.012, y: 0.018 });
    if (!target._hit) {
      target._hit = true;
      events.push({
        type: 'target',
        id: target.id,
        letter: target.letter,
        bank: target.bank,
        ball: ballBody.plugin?.ball,
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
  let omega = diff * gain * 2.2;
  const maxO = TUNING.flipperMaxOmega * (flipper.pressed ? 1.25 : 0.85);
  omega = Math.max(-maxO, Math.min(maxO, omega));

  if (Math.abs(diff) < 0.018) {
    Body.setAngle(body, target);
    Body.setAngularVelocity(body, 0);
  } else {
    Body.setAngularVelocity(body, omega);
  }

  if (body.angle < minA - 0.012) {
    Body.setAngle(body, minA);
    Body.setAngularVelocity(body, Math.max(0, body.angularVelocity));
  } else if (body.angle > maxA + 0.012) {
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
    const speed = flipper.pressed ? 0.55 : 0.3;
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
 * Step physics one or more fixed ticks.
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

      // Crest exit (one-shot gate): launch into PF left of the lane wall
      if (ball.body && ball.x > TABLE_W - 60 && ball.y < 160 && ball.y > 40) {
        if (!ball._crestExited && ball.vy >= -1.2) {
          ball._crestExited = true;
          Body.setPosition(ball.body, {
            x: TABLE_W - 95,
            y: Math.max(70, Math.min(ball.y, 120)),
          });
          Body.setVelocity(ball.body, { x: -7, y: 6.5 });
          syncBallFromBody(ball);
        } else if (!ball._crestExited && ball.vy < -1.2) {
          Body.setVelocity(ball.body, {
            x: Math.min(ball.vx, -2.5),
            y: ball.vy,
          });
          syncBallFromBody(ball);
        } else if (ball._crestExited) {
          Body.setPosition(ball.body, {
            x: Math.min(ball.x, TABLE_W - 70),
            y: ball.y,
          });
          if (ball.vx > -2) {
            Body.setVelocity(ball.body, {
              x: -5,
              y: Math.max(ball.vy, 3),
            });
          }
          syncBallFromBody(ball);
        }
      }

      const spd = Math.hypot(ball.vx, ball.vy);
      if (spd > 28 && ball.body) {
        const s = 28 / spd;
        Body.setVelocity(ball.body, { x: ball.vx * s, y: ball.vy * s });
        syncBallFromBody(ball);
      }

      // Anti-stick: break micro-stalls against standups / seams
      if (
        ball.body &&
        Math.hypot(ball.vx, ball.vy) < 0.35 &&
        ball.y > 180 &&
        ball.y < TABLE_H - 100 &&
        ball.x > 28 &&
        ball.x < TABLE_W - 65
      ) {
        ball._stall = (ball._stall || 0) + 1;
        if (ball._stall > 8) {
          ball._stall = 0;
          const dir = ball.x < TABLE_W / 2 ? 1 : -1;
          Body.setPosition(ball.body, {
            x: ball.x + dir * 10,
            y: ball.y + 8,
          });
          Body.setVelocity(ball.body, { x: dir * 3.5, y: 4.5 });
          syncBallFromBody(ball);
        }
      } else if (ball) {
        ball._stall = 0;
      }

      if (ball.y > geo.drainY) {
        ball.active = false;
        removeBallFromWorld(geo, ball);
        events.push({ type: 'drain', ball });
      }
    }

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
  const matterVy = -speed;
  ball.vx = 0;
  ball.vy = matterVy;
  ball._crestExited = false;
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
  ball._crestExited = false;
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

/** Kick ball with velocity (no teleport) — saucer / kickout helper */
export function kickBall(ball, geometry, vx, vy) {
  if (!ball || !ball.active) return;
  ball.held = false;
  ball.vx = vx;
  ball.vy = vy;
  applyBallState(geometry, ball);
}

export { Matter, Engine, Body, Bodies, Composite };
