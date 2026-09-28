/**
 * Deterministic 2D pinball physics (no rendering).
 * Fixed-dt stepper; pure enough for unit/physics tests.
 */

export const TABLE_W = 360;
export const TABLE_H = 640;
export const BALL_R = 8;
export const GRAVITY = 0.18;
export const FRICTION = 0.995;
export const WALL_RESTITUTION = 0.72;
export const BUMPER_RESTITUTION = 1.35;
export const FLIPPER_POWER = 14;

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

export function createBall(x, y, vx = 0, vy = 0) {
  return { x, y, vx, vy, r: BALL_R, active: true, held: false };
}

export function createFlipper(pivotX, pivotY, length, restAngle, swing, side) {
  return {
    pivotX,
    pivotY,
    length,
    restAngle,
    swing,
    side, // 'left' | 'right'
    angle: restAngle,
    pressed: false,
    angularVel: 0,
  };
}

export function createBumper(x, y, r = 16, id = 'bumper') {
  return { x, y, r, id, cooldown: 0 };
}

export function createSegment(x1, y1, x2, y2, kind = 'wall') {
  return { x1, y1, x2, y2, kind };
}

export function createCircleTrigger(x, y, r, id) {
  return { x, y, r, id };
}

/** Default snowboard table geometry (portrait phone) */
export function createTableGeometry() {
  const W = TABLE_W;
  const H = TABLE_H;
  const walls = [
    // outer rails
    createSegment(20, 40, 20, H - 20, 'wall'),
    createSegment(W - 20, 40, W - 20, H - 80, 'wall'),
    createSegment(20, 40, W - 20, 40, 'wall'),
    // bottom drain funnel
    createSegment(20, H - 20, 110, H - 8, 'wall'),
    createSegment(W - 90, H - 8, W - 50, H - 80, 'wall'),
    // left sling / inlane
    createSegment(40, H - 120, 100, H - 40, 'wall'),
    // right sling / outlane near plunger
    createSegment(W - 100, H - 40, W - 50, H - 100, 'wall'),
    // chairlift lane (right plunge lane)
    createSegment(W - 48, H - 80, W - 48, 120, 'lane'),
    createSegment(W - 22, H - 80, W - 22, 120, 'lane'),
    // powder plus ramp guide (left)
    createSegment(40, 180, 90, 100, 'ramp'),
    createSegment(50, 190, 100, 110, 'ramp'),
    // center pipe
    createSegment(140, 160, 180, 80, 'ramp'),
    createSegment(180, 160, 200, 80, 'ramp'),
  ];

  const bumpers = [
    createBumper(120, 250, 18, 'powder0'),
    createBumper(170, 220, 18, 'powder1'),
    createBumper(220, 250, 18, 'powder2'),
    createBumper(145, 300, 16, 'powder3'),
    createBumper(195, 300, 16, 'powder4'),
  ];

  const triggers = [
    createCircleTrigger(W - 35, 100, 18, 'chairlift_scoop'),
    createCircleTrigger(70, 95, 20, 'powder_plus_exit'),
    createCircleTrigger(190, 70, 18, 'pipe_exit'),
    createCircleTrigger(280, 360, 22, 'tree_well'),
    createCircleTrigger(180, 140, 20, 'vault'),
    createCircleTrigger(55, H - 160, 14, 'inlane_left'),
    createCircleTrigger(W - 110, H - 160, 14, 'inlane_right'),
    createCircleTrigger(35, H - 60, 14, 'outlane_left'),
    createCircleTrigger(W - 70, H - 50, 14, 'outlane_right'),
  ];

  const targets = [
    { x: 60, y: 340, w: 18, h: 10, id: 'B', letter: 'B', bank: 'BOARD' },
    { x: 85, y: 340, w: 18, h: 10, id: 'O', letter: 'O', bank: 'BOARD' },
    { x: 110, y: 340, w: 18, h: 10, id: 'A', letter: 'A', bank: 'BOARD' },
    { x: 135, y: 340, w: 18, h: 10, id: 'R', letter: 'R', bank: 'BOARD' },
    { x: 160, y: 340, w: 18, h: 10, id: 'D', letter: 'D', bank: 'BOARD' },
    { x: 70, y: 400, w: 18, h: 10, id: 'L', letter: 'L', bank: 'LODGE' },
    { x: 95, y: 400, w: 18, h: 10, id: 'O2', letter: 'O', bank: 'LODGE' },
    { x: 120, y: 400, w: 18, h: 10, id: 'D2', letter: 'D', bank: 'LODGE' },
    { x: 145, y: 400, w: 18, h: 10, id: 'G', letter: 'G', bank: 'LODGE' },
    { x: 170, y: 400, w: 18, h: 10, id: 'E', letter: 'E', bank: 'LODGE' },
  ];

  const flippers = [
    createFlipper(115, H - 55, 56, 0.55, -0.9, 'left'),
    createFlipper(245, H - 55, 56, Math.PI - 0.55, 0.9, 'right'),
    createFlipper(100, 150, 36, 0.4, -0.7, 'mini'), // upper mini-flipper
  ];

  const plunger = {
    x: W - 35,
    y: H - 40,
    laneTop: 120,
    laneBottom: H - 40,
  };

  const drainY = H - 5;

  return { W, H, walls, bumpers, triggers, targets, flippers, plunger, drainY };
}

export function setFlipperPressed(flipper, pressed) {
  flipper.pressed = !!pressed;
}

export function stepFlipper(flipper, dt = 1) {
  const target = flipper.pressed
    ? flipper.restAngle + flipper.swing
    : flipper.restAngle;
  const speed = flipper.pressed ? 0.45 : 0.25;
  const diff = target - flipper.angle;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
  const prev = flipper.angle;
  flipper.angle += step;
  flipper.angularVel = flipper.angle - prev;
}

function closestPointOnSeg(px, py, seg) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - seg.x1) * dx + (py - seg.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: seg.x1 + t * dx, y: seg.y1 + t * dy, t };
}

function resolveWall(ball, seg, restitution = WALL_RESTITUTION) {
  const c = closestPointOnSeg(ball.x, ball.y, seg);
  const dx = ball.x - c.x;
  const dy = ball.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= ball.r || dist < 1e-6) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = ball.r - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + restitution) * vn * nx;
    ball.vy -= (1 + restitution) * vn * ny;
  }
  return true;
}

function resolveBumper(ball, bumper) {
  if (bumper.cooldown > 0) return null;
  const dx = ball.x - bumper.x;
  const dy = ball.y - bumper.y;
  const dist = Math.hypot(dx, dy);
  const min = ball.r + bumper.r;
  if (dist >= min || dist < 1e-6) return null;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const speed = Math.max(8, len({ x: ball.vx, y: ball.vy }));
  ball.vx = nx * speed * BUMPER_RESTITUTION;
  ball.vy = ny * speed * BUMPER_RESTITUTION;
  bumper.cooldown = 8;
  return bumper.id;
}

function flipperTip(flipper) {
  return {
    x: flipper.pivotX + Math.cos(flipper.angle) * flipper.length,
    y: flipper.pivotY + Math.sin(flipper.angle) * flipper.length,
  };
}

function resolveFlipper(ball, flipper) {
  const tip = flipperTip(flipper);
  const seg = { x1: flipper.pivotX, y1: flipper.pivotY, x2: tip.x, y2: tip.y };
  const c = closestPointOnSeg(ball.x, ball.y, seg);
  const dx = ball.x - c.x;
  const dy = ball.y - c.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= ball.r + 2 || dist < 1e-6) return false;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = ball.r + 2 - dist;
  ball.x += nx * overlap;
  ball.y += ny * overlap;
  const impulse = flipper.pressed ? FLIPPER_POWER * (0.5 + Math.abs(flipper.angularVel) * 8) : 2;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < impulse) {
    ball.vx += nx * (impulse - vn);
    ball.vy += ny * (impulse - vn);
  }
  // slight upward bias when flipping
  if (flipper.pressed && flipper.angularVel !== 0) {
    ball.vy -= Math.abs(flipper.angularVel) * 6;
  }
  return true;
}

function hitTarget(ball, target) {
  return (
    ball.x + ball.r > target.x &&
    ball.x - ball.r < target.x + target.w &&
    ball.y + ball.r > target.y &&
    ball.y - ball.r < target.y + target.h
  );
}

function inTrigger(ball, t) {
  return Math.hypot(ball.x - t.x, ball.y - t.y) < t.r + ball.r * 0.5;
}

/**
 * Step physics one frame. Returns event list.
 * @param {object} world
 * @param {number} dt - fixed timestep multiplier (1 = one frame)
 */
export function stepPhysics(world, dt = 1) {
  const events = [];
  const { balls, geometry } = world;

  for (const f of geometry.flippers) stepFlipper(f, dt);

  for (const bumper of geometry.bumpers) {
    if (bumper.cooldown > 0) bumper.cooldown -= dt;
  }

  for (const ball of balls) {
    if (!ball.active || ball.held) continue;

    ball.vy += GRAVITY * dt;
    ball.vx *= Math.pow(FRICTION, dt);
    ball.vy *= Math.pow(FRICTION, dt);
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // soft clamp to table
    if (ball.x < ball.r + 18) {
      ball.x = ball.r + 18;
      ball.vx = Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    if (ball.x > geometry.W - ball.r - 18) {
      ball.x = geometry.W - ball.r - 18;
      ball.vx = -Math.abs(ball.vx) * WALL_RESTITUTION;
    }
    if (ball.y < ball.r + 38) {
      ball.y = ball.r + 38;
      ball.vy = Math.abs(ball.vy) * WALL_RESTITUTION;
    }

    for (const seg of geometry.walls) {
      if (resolveWall(ball, seg)) {
        if (seg.kind === 'ramp') events.push({ type: 'ramp_contact', ball });
      }
    }

    for (const bumper of geometry.bumpers) {
      const id = resolveBumper(ball, bumper);
      if (id) events.push({ type: 'bumper', id, ball });
    }

    for (const flipper of geometry.flippers) {
      if (resolveFlipper(ball, flipper)) {
        events.push({ type: 'flipper', side: flipper.side, ball });
      }
    }

    for (const target of geometry.targets) {
      if (!target._hit && hitTarget(ball, target)) {
        target._hit = true;
        // bounce down a bit
        ball.vy = Math.abs(ball.vy) * 0.6 + 2;
        events.push({
          type: 'target',
          id: target.id,
          letter: target.letter,
          bank: target.bank,
          ball,
        });
      }
    }
    // clear one-frame target locks when ball leaves
    for (const target of geometry.targets) {
      if (target._hit && !hitTarget(ball, target)) target._hit = false;
    }

    for (const t of geometry.triggers) {
      if (inTrigger(ball, t)) {
        events.push({ type: 'trigger', id: t.id, ball });
      }
    }

    if (ball.y > geometry.drainY) {
      ball.active = false;
      events.push({ type: 'drain', ball });
    }
  }

  return events;
}

/** Launch ball from plunger with given pull 0..1 */
export function launchFromPlunger(ball, geometry, pullNorm, powerFn) {
  const p = geometry.plunger;
  ball.x = p.x;
  ball.y = p.y - 10;
  ball.held = false;
  ball.active = true;
  const speed = powerFn(pullNorm);
  ball.vx = 0;
  ball.vy = -speed;
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
}

/** Run N fixed steps; return final balls + all events */
export function simulate(world, steps, dt = 1) {
  const all = [];
  for (let i = 0; i < steps; i++) {
    const ev = stepPhysics(world, dt);
    all.push(...ev);
  }
  return all;
}
