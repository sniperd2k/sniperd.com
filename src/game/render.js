/**
 * Canvas renderer — SniperD Arcade Neon: walnut woodrail deck,
 * chrome rails, magenta/cyan neon targets, amber DMD HUD.
 * Original vector art only (no third-party IP).
 */

import { TABLE_W, TABLE_H } from './physics.js';
import { drawParticles } from './particles.js';
import { formatScore } from './scoring.js';

const C = {
  cabinet0: '#0c0604',
  cabinet1: '#1a0e08',
  deck0: '#3a2214',
  deck1: '#5a3420',
  deck2: '#2a180e',
  deckGlow: '#6a4428',
  woodGrain: 'rgba(90,50,28,0.35)',
  rail: '#e8dcc8',
  chromeHi: '#fff6e8',
  chromeLo: '#8a7860',
  accent: '#ff4fd8',
  accentLit: '#ff9aec',
  neon: '#3dffc8',
  neonHot: '#b8ffe8',
  neonAmber: '#ffb020',
  neonAmberLit: '#ffd070',
  gunmetal: '#4a3830',
  steel: '#a89078',
  brass: '#c8a060',
  ink: '#100804',
  dmdBg: 'rgba(12,6,4,0.9)',
  dmdText: '#ffe0a8',
  dmdDim: '#6a5030',
  warning: '#ff9020',
  warningLit: '#ffc060',
  saucer: '#ff60c8',
  saucerLit: '#ffb0e8',
  jetCore: '#2a1810',
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
  g.addColorStop(0.45, C.cabinet1);
  g.addColorStop(1, '#080402');
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

  // Walnut woodrail deck with warm vignette
  const deck = ctx.createRadialGradient(
    TABLE_W * 0.5,
    TABLE_H * 0.35,
    40,
    TABLE_W * 0.5,
    TABLE_H * 0.5,
    TABLE_H * 0.7
  );
  deck.addColorStop(0, C.deckGlow);
  deck.addColorStop(0.35, C.deck1);
  deck.addColorStop(0.75, C.deck0);
  deck.addColorStop(1, C.deck2);
  roundRect(ctx, 12, 32, TABLE_W - 24, TABLE_H - 42, 18);
  ctx.fillStyle = deck;
  ctx.fill();

  // Subtle wood grain strokes (original procedural, not a texture rip)
  ctx.strokeStyle = C.woodGrain;
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const y = 55 + i * 32;
    ctx.beginPath();
    ctx.moveTo(28, y + (i % 3) * 2);
    ctx.quadraticCurveTo(TABLE_W * 0.5, y + 6, TABLE_W - 28, y - (i % 2) * 3);
    ctx.stroke();
  }

  // Chrome outer rail
  ctx.strokeStyle = C.chromeHi;
  ctx.lineWidth = 4;
  roundRect(ctx, 12, 32, TABLE_W - 24, TABLE_H - 42, 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200,160,96,0.45)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 16, 36, TABLE_W - 32, TABLE_H - 50, 14);
  ctx.stroke();

  // Soft neon wash upper PF
  const wash = ctx.createLinearGradient(40, 60, 320, 220);
  wash.addColorStop(0, 'rgba(255,79,216,0.07)');
  wash.addColorStop(0.5, 'rgba(61,255,200,0.05)');
  wash.addColorStop(1, 'rgba(255,176,32,0.06)');
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.moveTo(40, 210);
  ctx.lineTo(130, 60);
  ctx.lineTo(220, 190);
  ctx.lineTo(300, 70);
  ctx.lineTo(340, 200);
  ctx.closePath();
  ctx.fill();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const seg of geo.walls) {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    if (seg.kind === 'ramp') {
      ctx.strokeStyle = 'rgba(40,20,10,0.9)';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = C.neon;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = C.neon;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (seg.kind === 'lane') {
      ctx.strokeStyle = C.warning;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    } else if (seg.kind === 'sling') {
      ctx.strokeStyle = 'rgba(40,10,30,0.85)';
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = C.accentLit;
      ctx.lineWidth = 4.5;
      ctx.shadowColor = C.accent;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (seg.kind === 'orbit') {
      ctx.strokeStyle = C.chromeLo;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = C.chromeHi;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (seg.kind === 'guide') {
      ctx.strokeStyle = 'rgba(232,220,200,0.35)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      ctx.strokeStyle = C.brass;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.strokeStyle = 'rgba(255,246,232,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Jet bumpers — hot neon rings
  for (const b of geo.bumpers) {
    const glow = b.cooldown > 0;
    if (glow) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,154,236,0.28)';
      ctx.fill();
    }
    const grd = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, b.r);
    grd.addColorStop(0, glow ? '#ffffff' : C.accentLit);
    grd.addColorStop(0.45, glow ? C.accentLit : C.accent);
    grd.addColorStop(1, glow ? '#a02880' : '#601848');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = glow ? '#ffffff' : C.neonAmberLit;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = C.accent;
    ctx.shadowBlur = glow ? 16 : 7;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = C.jetCore;
    ctx.fill();
  }

  // SNIPE standup targets — lit neon
  for (const t of geo.targets) {
    const lit = isTargetLit(state, t);
    if (lit) {
      ctx.shadowColor = C.neon;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = lit ? C.neonHot : C.gunmetal;
    roundRect(ctx, t.x, t.y, t.w, t.h, 2);
    ctx.fill();
    ctx.strokeStyle = lit ? '#ffffff' : C.rail;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = lit ? C.ink : C.dmdText;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.letter, t.x + t.w / 2, t.y + t.h / 2 + 3);
  }

  drawScoop(ctx, geo.triggers.find((t) => t.id === 'skill_shot'), 'SKILL', C.warningLit, true);
  drawScoop(
    ctx,
    geo.triggers.find((t) => t.id === 'saucer'),
    state.treeWellLit ? 'SAUCER 5×' : 'SAUCER',
    state.treeWellLit ? C.saucerLit : C.saucer,
    true
  );
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'ramp_exit'), 'RAMP', C.neon, true);
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'loop_exit'), 'LOOP', C.accentLit, false);

  // Title ribbon — amber DMD-style
  ctx.fillStyle = 'rgba(12,6,4,0.82)';
  roundRect(ctx, 40, 44, TABLE_W - 80, 24, 4);
  ctx.fill();
  ctx.strokeStyle = C.neonAmber;
  ctx.lineWidth = 1.2;
  roundRect(ctx, 40, 44, TABLE_W - 80, 24, 4);
  ctx.stroke();
  ctx.fillStyle = C.dmdText;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SNIPERD  ·  ARCADE NEON', TABLE_W / 2, 60);
}

function isTargetLit(state, t) {
  if (t.bank !== 'SNIPE' || !state.snipe) return false;
  const same = state.geometry.targets.filter((x) => x.bank === t.bank);
  const idx = same.indexOf(t);
  return idx >= 0 && !!state.snipe.lit[idx];
}

function drawScoop(ctx, t, label, color, deep) {
  if (!t) return;
  const grd = ctx.createRadialGradient(t.x, t.y, 1, t.x, t.y, t.r);
  grd.addColorStop(0, deep ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.4)');
  grd.addColorStop(1, 'rgba(40,20,10,0.35)');
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r * 0.55, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, t.x, t.y - t.r - 5);
}

function drawFlippers(ctx, flippers) {
  for (const f of flippers) {
    const tipX = f.pivotX + Math.cos(f.angle) * f.length;
    const tipY = f.pivotY + Math.sin(f.angle) * f.length;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = (f.side === 'mini' ? 8 : 13) + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.pivotX + 1, f.pivotY + 2);
    ctx.lineTo(tipX + 1, tipY + 2);
    ctx.stroke();
    const bat = ctx.createLinearGradient(f.pivotX, f.pivotY, tipX, tipY);
    bat.addColorStop(0, f.pressed ? C.neonAmberLit : C.chromeHi);
    bat.addColorStop(1, f.pressed ? C.neonAmber : C.steel);
    ctx.strokeStyle = bat;
    ctx.lineWidth = f.side === 'mini' ? 8 : 12;
    ctx.beginPath();
    ctx.moveTo(f.pivotX, f.pivotY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(f.pivotX, f.pivotY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.chromeHi;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawBalls(ctx, balls) {
  for (const b of balls) {
    if (!b.active) continue;
    ctx.beginPath();
    ctx.arc(b.x + 1.5, b.y + 2, b.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    const grd = ctx.createRadialGradient(b.x - 2.5, b.y - 2.5, 1, b.x, b.y, b.r);
    grd.addColorStop(0, '#ffffff');
    grd.addColorStop(0.4, '#f0e8e0');
    grd.addColorStop(0.85, '#a89888');
    grd.addColorStop(1, '#685848');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlunger(ctx, state, input) {
  const p = state.geometry.plunger;
  const pull = input?.plungerPulling ? input.plungerPull : input?._launch || 0;
  const travel = pull * 56;
  ctx.fillStyle = C.gunmetal;
  ctx.fillRect(p.x - 5, p.y - 22 + travel, 10, 54);
  ctx.fillStyle = C.chromeLo;
  ctx.fillRect(p.x - 3, p.y - 20 + travel, 6, 50);
  ctx.fillStyle = C.warning;
  roundRect(ctx, p.x - 9, p.y + 28 + travel, 18, 12, 3);
  ctx.fill();
  ctx.strokeStyle = C.warningLit;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = C.neonAmberLit;
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PULL', p.x, p.y + 54 + travel);
}

function drawHud(ctx, state, viewW, viewH) {
  const hud = {
    score: formatScore(state.score),
    balls: state.balls,
    msg: state.messageTimer > 0 ? state.message : '',
  };

  ctx.fillStyle = C.dmdBg;
  ctx.fillRect(0, 0, viewW, 56);
  const bezel = ctx.createLinearGradient(0, 0, viewW, 0);
  bezel.addColorStop(0, 'rgba(255,79,216,0.18)');
  bezel.addColorStop(0.5, 'rgba(255,176,32,0.4)');
  bezel.addColorStop(1, 'rgba(61,255,200,0.18)');
  ctx.strokeStyle = bezel;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, viewW - 2, 54);

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = 2; y < 54; y += 3) {
    ctx.fillRect(0, y, viewW, 1);
  }

  ctx.fillStyle = C.dmdText;
  ctx.font = `bold ${Math.max(17, Math.floor(viewW * 0.058))}px monospace`;
  ctx.textAlign = 'left';
  ctx.shadowColor = C.neonAmber;
  ctx.shadowBlur = 6;
  ctx.fillText(hud.score, 14, 28);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = C.neonAmber;
  ctx.fillText(`BALL  ${hud.balls}`, 14, 46);

  if (state.snipe) {
    drawLetters(ctx, 'SNIPE', state.snipe.lit, viewW - 14, 30);
  }

  if (hud.msg) {
    ctx.fillStyle = 'rgba(12,6,4,0.85)';
    const tw = Math.min(viewW - 24, 380);
    roundRect(ctx, (viewW - tw) / 2, viewH * 0.4, tw, 40, 6);
    ctx.fill();
    ctx.strokeStyle = C.neonAmber;
    ctx.lineWidth = 1.5;
    roundRect(ctx, (viewW - tw) / 2, viewH * 0.4, tw, 40, 6);
    ctx.stroke();
    ctx.fillStyle = C.neonAmberLit;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = C.neonAmber;
    ctx.shadowBlur = 8;
    ctx.fillText(hud.msg, viewW / 2, viewH * 0.4 + 26);
    ctx.shadowBlur = 0;
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(8,4,2,0.88)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = C.dmdText;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = C.accent;
    ctx.shadowBlur = 12;
    ctx.fillText('GAME OVER', viewW / 2, viewH / 2 - 12);
    ctx.shadowBlur = 0;
    ctx.font = '16px monospace';
    ctx.fillStyle = C.neonAmber;
    ctx.fillText(hud.score, viewW / 2, viewH / 2 + 22);
    ctx.fillStyle = C.dmdDim;
    ctx.font = '13px sans-serif';
    ctx.fillText('Pull plunger / Space to restart', viewW / 2, viewH / 2 + 50);
  }
}

function drawLetters(ctx, word, lit, right, y) {
  const chars = word.split('');
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  let x = right;
  for (let i = chars.length - 1; i >= 0; i--) {
    ctx.fillStyle = lit[i] ? C.neonHot : C.dmdDim;
    if (lit[i]) {
      ctx.shadowColor = C.neon;
      ctx.shadowBlur = 8;
    }
    ctx.fillText(chars[i], x, y);
    ctx.shadowBlur = 0;
    x -= 14;
  }
}

function drawTouchHints(ctx, viewW, viewH, input) {
  const leftLo = viewW * 0.12;
  const leftHi = viewW * 0.45;
  const rightLo = viewW * 0.55;
  const rightHi = viewW * 0.88;
  ctx.strokeStyle = 'rgba(255,220,160,0.12)';
  ctx.setLineDash([5, 7]);
  ctx.lineWidth = 1;
  ctx.strokeRect(leftLo, viewH * 0.62, leftHi - leftLo, viewH * 0.35);
  ctx.strokeRect(rightLo, viewH * 0.62, rightHi - rightLo, viewH * 0.35);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,220,160,0.3)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEFT', (leftLo + leftHi) / 2, viewH - 10);
  ctx.fillText('RIGHT', (rightLo + rightHi) / 2, viewH - 10);
  if (input?.left) {
    ctx.fillStyle = 'rgba(255,79,216,0.14)';
    ctx.fillRect(leftLo, viewH * 0.55, leftHi - leftLo, viewH * 0.45);
  }
  if (input?.right) {
    ctx.fillStyle = 'rgba(61,255,200,0.14)';
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
