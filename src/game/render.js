/**
 * Canvas renderer — SniperD Cadet: cool blues / teals / gunmetal.
 * Original vector art only (no third-party sprites or palettes).
 */

import { TABLE_W, TABLE_H } from './physics.js';
import { drawParticles } from './particles.js';
import { formatScore } from './scoring.js';

const C = {
  cabinet0: '#0a1218',
  cabinet1: '#121c28',
  deck0: '#1a2836',
  deck1: '#243848',
  deck2: '#152030',
  rail: '#7ec8d8',
  accent: '#3ecfcf',
  accentLit: '#7ef0e8',
  gunmetal: '#4a5568',
  steel: '#8a9bb0',
  ink: '#061018',
  dmdBg: 'rgba(6,12,20,0.78)',
  dmdText: '#c8e8f0',
  warning: '#f0a060',
  saucer: '#6a90ff',
  saucerLit: '#a0c0ff',
};

export function resizeCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h, dpr, ctx };
}

function tableScale(viewW, viewH) {
  const sx = viewW / TABLE_W;
  const sy = viewH / TABLE_H;
  const s = Math.min(sx, sy);
  const ox = (viewW - TABLE_W * s) / 2;
  const oy = (viewH - TABLE_H * s) / 2;
  return { s, ox, oy };
}

export function drawFrame(ctx, state, viewW, viewH, input) {
  const { s, ox, oy } = tableScale(viewW, viewH);
  ctx.save();
  ctx.clearRect(0, 0, viewW, viewH);

  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, C.cabinet0);
  g.addColorStop(0.5, C.cabinet1);
  g.addColorStop(1, '#060a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.translate(ox, oy);
  ctx.scale(s, s);

  drawPlayfield(ctx, state);
  drawFlippers(ctx, state.geometry.flippers);
  drawBalls(ctx, state.ballsList);
  drawParticles(ctx, state.particles);
  drawPlunger(ctx, state, input);

  ctx.restore();
  drawHud(ctx, state, viewW, viewH);
  drawTouchHints(ctx, viewW, viewH, input);
}

function drawPlayfield(ctx, state) {
  const geo = state.geometry;
  const deck = ctx.createLinearGradient(0, 0, 0, TABLE_H);
  deck.addColorStop(0, C.deck0);
  deck.addColorStop(0.45, C.deck1);
  deck.addColorStop(1, C.deck2);
  roundRect(ctx, 14, 34, TABLE_W - 28, TABLE_H - 46, 16);
  ctx.fillStyle = deck;
  ctx.fill();
  ctx.strokeStyle = C.rail;
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Subtle panel lines (gunmetal)
  ctx.strokeStyle = 'rgba(80,110,140,0.18)';
  ctx.lineWidth = 1;
  for (let y = 70; y < TABLE_H - 50; y += 32) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(TABLE_W - 28, y + 4);
    ctx.stroke();
  }

  // Abstract upper constellation (original, not a logo rip)
  ctx.fillStyle = 'rgba(62,207,207,0.08)';
  ctx.beginPath();
  ctx.moveTo(50, 200);
  ctx.lineTo(140, 70);
  ctx.lineTo(210, 180);
  ctx.lineTo(280, 85);
  ctx.lineTo(330, 195);
  ctx.closePath();
  ctx.fill();

  ctx.lineCap = 'round';
  for (const seg of geo.walls) {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    if (seg.kind === 'ramp') {
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 4;
    } else if (seg.kind === 'lane') {
      ctx.strokeStyle = C.warning;
      ctx.lineWidth = 3;
    } else if (seg.kind === 'sling') {
      ctx.strokeStyle = '#5ee0d0';
      ctx.lineWidth = 5;
    } else if (seg.kind === 'orbit') {
      ctx.strokeStyle = '#6a9ec8';
      ctx.lineWidth = 3;
    } else if (seg.kind === 'guide') {
      ctx.strokeStyle = 'rgba(126,200,216,0.55)';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = C.steel;
      ctx.lineWidth = 3;
    }
    ctx.stroke();
  }

  for (const b of geo.bumpers) {
    const glow = b.cooldown > 0;
    const grd = ctx.createRadialGradient(b.x - 3, b.y - 3, 2, b.x, b.y, b.r);
    grd.addColorStop(0, glow ? C.accentLit : '#a8e8f0');
    grd.addColorStop(1, glow ? C.accent : '#3a6a88');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = C.accentLit;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = C.ink;
    ctx.fill();
  }

  for (const t of geo.targets) {
    const lit = isTargetLit(state, t);
    ctx.fillStyle = lit ? C.accentLit : C.gunmetal;
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = lit ? '#e0ffff' : C.rail;
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = lit ? C.ink : C.dmdText;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.letter, t.x + t.w / 2, t.y + 9);
  }

  drawScoop(ctx, geo.triggers.find((t) => t.id === 'skill_shot'), 'SKILL', C.warning);
  drawScoop(
    ctx,
    geo.triggers.find((t) => t.id === 'saucer'),
    state.treeWellLit ? 'SAUCER 5×' : 'SAUCER',
    state.treeWellLit ? C.saucerLit : C.saucer
  );
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'ramp_exit'), 'RAMP', C.accentLit);
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'loop_exit'), 'LOOP', C.rail);

  // Title ribbon
  ctx.fillStyle = 'rgba(6,16,28,0.65)';
  ctx.fillRect(48, 46, TABLE_W - 96, 22);
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(48, 46, TABLE_W - 96, 22);
  ctx.fillStyle = C.dmdText;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SNIPERD  ·  CADET PINBALL', TABLE_W / 2, 61);
}

function isTargetLit(state, t) {
  if (t.bank !== 'CADET' || !state.cadet) return false;
  const same = state.geometry.targets.filter((x) => x.bank === t.bank);
  const idx = same.indexOf(t);
  return idx >= 0 && !!state.cadet.lit[idx];
}

function drawScoop(ctx, t, label, color) {
  if (!t) return;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, t.x, t.y - t.r - 4);
}

function drawFlippers(ctx, flippers) {
  for (const f of flippers) {
    const tipX = f.pivotX + Math.cos(f.angle) * f.length;
    const tipY = f.pivotY + Math.sin(f.angle) * f.length;
    ctx.strokeStyle = f.pressed ? C.accentLit : C.steel;
    ctx.lineWidth = f.side === 'mini' ? 7 : 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.pivotX, f.pivotY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(f.pivotX, f.pivotY, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBalls(ctx, balls) {
  for (const b of balls) {
    if (!b.active) continue;
    const grd = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.55, '#d0e4f0');
    grd.addColorStop(1, '#7a90a0');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = '#e8f4ff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlunger(ctx, state, input) {
  const p = state.geometry.plunger;
  const pull = input?.plungerPulling ? input.plungerPull : input?._launch || 0;
  const travel = pull * 50;
  ctx.fillStyle = C.gunmetal;
  ctx.fillRect(p.x - 4, p.y - 20 + travel, 8, 50);
  ctx.fillStyle = C.warning;
  ctx.fillRect(p.x - 7, p.y + 28 + travel, 14, 10);
  ctx.fillStyle = C.accentLit;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PULL', p.x, p.y + 52 + travel);
}

function drawHud(ctx, state, viewW, viewH) {
  const hud = {
    score: formatScore(state.score),
    balls: state.balls,
    msg: state.messageTimer > 0 ? state.message : '',
  };

  ctx.fillStyle = C.dmdBg;
  ctx.fillRect(0, 0, viewW, 52);
  ctx.strokeStyle = 'rgba(62,207,207,0.35)';
  ctx.strokeRect(0, 0, viewW, 52);

  ctx.fillStyle = C.dmdText;
  ctx.font = `bold ${Math.max(16, Math.floor(viewW * 0.055))}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(hud.score, 12, 26);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = C.accent;
  ctx.fillText(`BALLS ${hud.balls}`, 12, 44);

  if (state.cadet) {
    drawLetters(ctx, 'CADET', state.cadet.lit, viewW - 12, 28, true);
  }

  if (hud.msg) {
    ctx.fillStyle = 'rgba(6,16,28,0.75)';
    const tw = Math.min(viewW - 24, 360);
    ctx.fillRect((viewW - tw) / 2, viewH * 0.42, tw, 36);
    ctx.strokeStyle = C.accent;
    ctx.strokeRect((viewW - tw) / 2, viewH * 0.42, tw, 36);
    ctx.fillStyle = C.accentLit;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hud.msg, viewW / 2, viewH * 0.42 + 23);
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(4,8,14,0.8)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = C.dmdText;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', viewW / 2, viewH / 2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = C.accent;
    ctx.fillText(hud.score, viewW / 2, viewH / 2 + 20);
    ctx.fillText('Pull plunger / Space to restart', viewW / 2, viewH / 2 + 48);
  }
}

function drawLetters(ctx, word, lit, right, y) {
  const chars = word.split('');
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  let x = right;
  for (let i = chars.length - 1; i >= 0; i--) {
    ctx.fillStyle = lit[i] ? C.accentLit : '#3a4858';
    ctx.fillText(chars[i], x, y);
    x -= 13;
  }
}

function drawTouchHints(ctx, viewW, viewH, input) {
  const leftLo = viewW * 0.12;
  const leftHi = viewW * 0.45;
  const rightLo = viewW * 0.55;
  const rightHi = viewW * 0.88;
  ctx.strokeStyle = 'rgba(200,232,240,0.08)';
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(leftLo, viewH * 0.62, leftHi - leftLo, viewH * 0.35);
  ctx.strokeRect(rightLo, viewH * 0.62, rightHi - rightLo, viewH * 0.35);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(200,232,240,0.22)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEFT', (leftLo + leftHi) / 2, viewH - 10);
  ctx.fillText('RIGHT', (rightLo + rightHi) / 2, viewH - 10);
  if (input?.left) {
    ctx.fillStyle = 'rgba(62,207,207,0.12)';
    ctx.fillRect(leftLo, viewH * 0.55, leftHi - leftLo, viewH * 0.45);
  }
  if (input?.right) {
    ctx.fillStyle = 'rgba(62,207,207,0.12)';
    ctx.fillRect(rightLo, viewH * 0.55, rightHi - rightLo, viewH * 0.45);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
