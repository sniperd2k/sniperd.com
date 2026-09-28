/**
 * SniperD — calm cinematic starfield: gentle swirl + rare drifting bodies.
 * Canvas 2D, ~60fps, mobile-friendly (Chrome + Safari).
 * Pointer proximity gently repels nearby stars; they keep drifting away.
 */

const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d', { alpha: false });

const STAR_LAYERS = [
  { count: 90,  depth: 0.25, size: [0.4, 1.0], alpha: [0.25, 0.55], swirl: 0.012 },
  { count: 140, depth: 0.55, size: [0.6, 1.6], alpha: [0.35, 0.75], swirl: 0.022 },
  { count: 70,  depth: 1.0,  size: [0.9, 2.2], alpha: [0.5, 0.95],  swirl: 0.035 },
];

/** Soft nebula wisps for depth (subtle, not UI). */
const NEBULAE = 4;

/** How often a body (planet/galaxy) may spawn, in seconds (mean-ish). */
const BODY_MEAN_INTERVAL = 28;
const BODY_MIN_GAP = 14;

/** Proximity mouse/touch repulsion (stars only; persist drift only). */
const REPEL_RADIUS = 120;
const REPEL_IMPULSE = 320; // base px/s added per second of contact at center
const REPEL_VEL_DECAY = 0.55; // exponential decay rate (1/s) — slow drift fade
const REPEL_DEPTH_BOOST = 0.35; // high-depth stars get a bit more push

let w = 0;
let h = 0;
let dpr = 1;
let cx = 0;
let cy = 0;
let stars = [];
let nebulae = [];
let bodies = [];
let t0 = performance.now();
let lastBodyAt = -BODY_MIN_GAP;
let nextBodyIn = BODY_MEAN_INTERVAL * (0.6 + Math.random() * 0.8);
let driftX = 0;
let driftY = 0;
let swirlAngle = 0;

/** Active pointer in CSS pixels, or null when no pointer (idle / left). */
let pointer = null;

function rand(a, b) {
  return a + Math.random() * (b - a);
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = Math.max(1, window.innerWidth);
  h = Math.max(1, window.innerHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx = w * 0.5;
  cy = h * 0.5;
}

function spawnStars() {
  stars = [];
  const span = Math.max(w, h) * 1.35;
  for (const layer of STAR_LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * span;
      stars.push({
        angle,
        radius,
        size: rand(layer.size[0], layer.size[1]),
        alpha: rand(layer.alpha[0], layer.alpha[1]),
        twinkle: rand(0.4, 1.6),
        twPhase: Math.random() * Math.PI * 2,
        depth: layer.depth,
        swirl: layer.swirl,
        hue: Math.random() < 0.12 ? rand(190, 230) : rand(0, 40),
        warm: Math.random() < 0.18,
        // Free-flight after proximity impulse (do not return to swirl)
        free: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      });
    }
  }
}

function spawnNebulae() {
  nebulae = [];
  for (let i = 0; i < NEBULAE; i++) {
    nebulae.push({
      x: rand(-0.2, 1.2) * w,
      y: rand(-0.2, 1.2) * h,
      r: rand(80, 220) * (Math.min(w, h) / 400),
      hue: rand(220, 280),
      alpha: rand(0.03, 0.08),
      vx: rand(-3, 3),
      vy: rand(-2, 2),
    });
  }
}

function spawnBody(nowSec) {
  const kind = Math.random() < 0.55 ? 'planet' : 'galaxy';
  const fromLeft = Math.random() < 0.5;
  const y = rand(h * 0.15, h * 0.85);
  const speed = rand(8, 18);
  const scale = Math.min(w, h) / 390;

  if (kind === 'planet') {
    bodies.push({
      kind: 'planet',
      x: fromLeft ? -60 * scale : w + 60 * scale,
      y,
      vx: (fromLeft ? 1 : -1) * speed,
      vy: rand(-2.5, 2.5),
      r: rand(10, 22) * scale,
      hue: rand(15, 50),
      sat: rand(35, 70),
      light: rand(40, 62),
      ring: Math.random() < 0.35,
      alpha: rand(0.55, 0.85),
      born: nowSec,
    });
  } else {
    bodies.push({
      kind: 'galaxy',
      x: fromLeft ? -90 * scale : w + 90 * scale,
      y,
      vx: (fromLeft ? 1 : -1) * speed * 0.7,
      vy: rand(-1.5, 1.5),
      rx: rand(28, 48) * scale,
      ry: rand(10, 18) * scale,
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.08, 0.08),
      hue: rand(200, 280),
      alpha: rand(0.35, 0.6),
      born: nowSec,
    });
  }
  lastBodyAt = nowSec;
  nextBodyIn = BODY_MEAN_INTERVAL * (0.55 + Math.random() * 0.9);
}

function drawBackground() {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
  g.addColorStop(0, '#0a0a1c');
  g.addColorStop(0.45, '#050512');
  g.addColorStop(1, '#02020a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawNebulae(dt) {
  for (const n of nebulae) {
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    if (n.x < -n.r) n.x = w + n.r;
    if (n.x > w + n.r) n.x = -n.r;
    if (n.y < -n.r) n.y = h + n.r;
    if (n.y > h + n.r) n.y = -n.r;

    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, `hsla(${n.hue}, 55%, 55%, ${n.alpha})`);
    g.addColorStop(0.55, `hsla(${n.hue}, 50%, 35%, ${n.alpha * 0.35})`);
    g.addColorStop(1, 'hsla(240, 40%, 10%, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function softWrap(x, y) {
  const pad = 40;
  let wx = x;
  let wy = y;
  if (wx < -pad) wx += w + pad * 2;
  if (wx > w + pad) wx -= w + pad * 2;
  if (wy < -pad) wy += h + pad * 2;
  if (wy > h + pad) wy -= h + pad * 2;
  return { x: wx, y: wy };
}

function swirlPosition(s) {
  const a = s.angle + swirlAngle * s.depth * 0.15;
  const ox = Math.cos(a) * s.radius + driftX * s.depth;
  const oy = Math.sin(a) * s.radius + driftY * s.depth;
  return softWrap(cx + ox, cy + oy);
}

function drawStars(time, dt) {
  swirlAngle += dt * 0.015;
  driftX += Math.sin(time * 0.03) * 0.15 * dt * 60;
  driftY += Math.cos(time * 0.022) * 0.12 * dt * 60;

  const r2 = REPEL_RADIUS * REPEL_RADIUS;
  const decay = Math.exp(-REPEL_VEL_DECAY * dt);
  const hasPtr = pointer != null;

  for (const s of stars) {
    let x;
    let y;

    if (s.free) {
      s.vx *= decay;
      s.vy *= decay;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const wrapped = softWrap(s.x, s.y);
      s.x = wrapped.x;
      s.y = wrapped.y;
      x = s.x;
      y = s.y;
    } else {
      s.angle += s.swirl * dt;
      const pos = swirlPosition(s);
      x = pos.x;
      y = pos.y;
    }

    // Proximity-only impulse: stars near pointer get pushed and keep drifting
    if (hasPtr) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const falloff = 1 - d / REPEL_RADIUS;
        const boost = 1 + s.depth * REPEL_DEPTH_BOOST;
        const impulse = REPEL_IMPULSE * falloff * falloff * boost * dt;
        const nx = dx / d;
        const ny = dy / d;
        if (!s.free) {
          s.free = true;
          s.x = x;
          s.y = y;
          s.vx = 0;
          s.vy = 0;
        }
        s.vx += nx * impulse;
        s.vy += ny * impulse;
        x = s.x;
        y = s.y;
      }
    }

    const tw = 0.65 + 0.35 * Math.sin(time * s.twinkle + s.twPhase);
    const alpha = s.alpha * tw;
    if (s.warm) {
      ctx.fillStyle = `hsla(${s.hue}, 70%, 78%, ${alpha})`;
    } else {
      ctx.fillStyle = `hsla(210, 40%, 92%, ${alpha})`;
    }
    ctx.beginPath();
    ctx.arc(x, y, s.size, 0, Math.PI * 2);
    ctx.fill();

    // Occasional soft glow on brighter stars (star glow only — no cursor chrome)
    if (s.size > 1.4 && alpha > 0.55) {
      ctx.fillStyle = `hsla(210, 60%, 80%, ${alpha * 0.12})`;
      ctx.beginPath();
      ctx.arc(x, y, s.size * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlanet(b) {
  ctx.save();
  ctx.globalAlpha = b.alpha;
  // Atmosphere glow
  const glow = ctx.createRadialGradient(b.x, b.y, b.r * 0.2, b.x, b.y, b.r * 2.2);
  glow.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${b.light}%, 0.25)`);
  glow.addColorStop(1, `hsla(${b.hue}, 40%, 20%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const body = ctx.createRadialGradient(
    b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1,
    b.x, b.y, b.r
  );
  body.addColorStop(0, `hsl(${b.hue}, ${b.sat}%, ${b.light + 18}%)`);
  body.addColorStop(0.55, `hsl(${b.hue}, ${b.sat}%, ${b.light}%)`);
  body.addColorStop(1, `hsl(${b.hue + 20}, ${b.sat - 10}%, ${b.light - 22}%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();

  if (b.ring) {
    ctx.strokeStyle = `hsla(${b.hue + 10}, 40%, 70%, 0.45)`;
    ctx.lineWidth = Math.max(1, b.r * 0.12);
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.r * 1.7, b.r * 0.45, -0.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGalaxy(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.globalAlpha = b.alpha;

  // Soft halo
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx * 1.4);
  halo.addColorStop(0, `hsla(${b.hue}, 70%, 70%, 0.35)`);
  halo.addColorStop(0.4, `hsla(${b.hue}, 60%, 50%, 0.12)`);
  halo.addColorStop(1, 'hsla(240, 40%, 20%, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(0, 0, b.rx * 1.4, b.ry * 1.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Disk
  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, b.rx);
  disk.addColorStop(0, `hsla(${b.hue + 20}, 80%, 85%, 0.85)`);
  disk.addColorStop(0.25, `hsla(${b.hue}, 70%, 65%, 0.45)`);
  disk.addColorStop(0.7, `hsla(${b.hue - 10}, 55%, 45%, 0.18)`);
  disk.addColorStop(1, 'hsla(240, 40%, 20%, 0)');
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.ellipse(0, 0, b.rx, b.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Faint spiral suggestion
  ctx.strokeStyle = `hsla(${b.hue}, 60%, 75%, 0.2)`;
  ctx.lineWidth = 1;
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const t = i / 40;
      const ang = t * Math.PI * 2.2 + arm * Math.PI;
      const rr = t * b.rx;
      const x = Math.cos(ang) * rr;
      const y = Math.sin(ang) * rr * (b.ry / b.rx);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function updateBodies(dt, nowSec) {
  if (nowSec - lastBodyAt >= nextBodyIn && bodies.length < 2) {
    spawnBody(nowSec);
  }

  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.kind === 'galaxy') b.rot += b.spin * dt;

    const margin = 120;
    if (b.x < -margin || b.x > w + margin || b.y < -margin || b.y > h + margin) {
      bodies.splice(i, 1);
    }
  }
}

function drawBodies() {
  for (const b of bodies) {
    if (b.kind === 'planet') drawPlanet(b);
    else drawGalaxy(b);
  }
}

function setPointerFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  pointer = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

function clearPointer() {
  pointer = null;
}

canvas.addEventListener('pointerdown', setPointerFromEvent);
canvas.addEventListener('pointermove', setPointerFromEvent);
canvas.addEventListener('pointerup', (e) => {
  // Touch lift ends force; mouse hover keeps tracking until leave
  if (e.pointerType !== 'mouse') clearPointer();
});
canvas.addEventListener('pointercancel', clearPointer);
canvas.addEventListener('pointerleave', clearPointer);

let lastTs = performance.now();

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  const time = (ts - t0) / 1000;

  drawBackground();
  drawNebulae(dt);
  drawStars(time, dt);
  updateBodies(dt, time);
  drawBodies();

  requestAnimationFrame(frame);
}

function init() {
  resize();
  spawnStars();
  spawnNebulae();
  lastTs = performance.now();
  t0 = lastTs;
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  resize();
  spawnStars();
  spawnNebulae();
});

init();
