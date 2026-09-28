/**
 * PIXEL BRICK spark / pixel-dust FX (chunky squares, not soft blobs).
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
    // Alternate cyan / magenta pixel dust
    const tone = Math.random() > 0.5 ? 'cyan' : 'magenta';
    sys.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (heavy ? 1.2 : 0.4),
      life: 20 + Math.random() * 28,
      r: 1 + Math.random() * (heavy ? 2.2 : 1.6),
      a: 0.85 + Math.random() * 0.15,
      tone,
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
    p.a *= 0.95;
    if (p.life > 0 && p.a > 0.05) next.push(p);
  }
  sys.particles = next;
}

export function drawParticles(ctx, sys) {
  for (const p of sys.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
    ctx.fillStyle = p.tone === 'magenta' ? '#ff2eb8' : '#00e8ff';
    const s = Math.max(1, Math.round(p.r * 2));
    ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
  }
  ctx.globalAlpha = 1;
}
