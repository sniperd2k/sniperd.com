/**
 * Spark / plasma particle FX for Cadet table.
 */

export function createParticleSystem() {
  return { particles: [] };
}

/** @deprecated alias — prefer emitSparks */
export function emitSnow(sys, x, y, count = 6, heavy = false) {
  return emitSparks(sys, x, y, count, heavy);
}

export function emitSparks(sys, x, y, count = 6, heavy = false) {
  const n = heavy ? count * 3 : count;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.6 + Math.random() * (heavy ? 3.5 : 2.2);
    sys.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (heavy ? 1.2 : 0.4),
      life: 24 + Math.random() * 36,
      r: 1 + Math.random() * (heavy ? 2.5 : 1.8),
      a: 0.75 + Math.random() * 0.25,
      hue: 160 + Math.random() * 40,
    });
  }
}

export function stepParticles(sys) {
  const next = [];
  for (const p of sys.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.035;
    p.life -= 1;
    p.a *= 0.96;
    if (p.life > 0 && p.a > 0.05) next.push(p);
  }
  sys.particles = next;
}

export function drawParticles(ctx, sys) {
  for (const p of sys.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
    ctx.fillStyle = `hsl(${p.hue || 180}, 70%, 70%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
