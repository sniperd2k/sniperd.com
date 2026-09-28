/**
 * Snow particle FX — heavier during multiball.
 */

export function createParticleSystem() {
  return { particles: [] };
}

export function emitSnow(sys, x, y, count = 6, heavy = false) {
  const n = heavy ? count * 3 : count;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 0.5 + Math.random() * (heavy ? 3.5 : 2);
    sys.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - (heavy ? 1.5 : 0.5),
      life: 30 + Math.random() * 40,
      r: 1 + Math.random() * (heavy ? 3 : 2),
      a: 0.7 + Math.random() * 0.3,
    });
  }
}

export function stepParticles(sys) {
  const next = [];
  for (const p of sys.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.04;
    p.life -= 1;
    p.a *= 0.97;
    if (p.life > 0 && p.a > 0.05) next.push(p);
  }
  sys.particles = next;
}

export function drawParticles(ctx, sys) {
  for (const p of sys.particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
