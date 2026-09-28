/**
 * Canvas renderer — mustard / ice / lodge pinball machine look.
 */

import { TABLE_W, TABLE_H } from './physics.js';
import { drawParticles } from './particles.js';
import { formatScore } from './scoring.js';

const C = {
  cabinet0: '#1a1408',
  cabinet1: '#2a1f0e',
  deck0: '#3d4a38',
  deck1: '#5a6e52',
  deck2: '#2c3828',
  rail: '#d4c48a',
  mustard: '#d4a017',
  mustardLit: '#f0c84a',
  ice: '#a8d4e8',
  iceBright: '#e8f6ff',
  lodge: '#8b4513',
  lodgeLit: '#c4783a',
  ink: '#1a1208',
  dmdBg: 'rgba(10,8,4,0.72)',
  dmdText: '#f0e6c0',
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
  g.addColorStop(1, '#0c0a06');
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
  deck.addColorStop(0.4, C.deck1);
  deck.addColorStop(1, C.deck2);
  roundRect(ctx, 16, 36, TABLE_W - 32, TABLE_H - 48, 18);
  ctx.fillStyle = deck;
  ctx.fill();
  ctx.strokeStyle = C.rail;
  ctx.lineWidth = 4;
  ctx.stroke();

  // lodge wood grain hint
  ctx.strokeStyle = 'rgba(80,50,20,0.25)';
  ctx.lineWidth = 1;
  for (let y = 60; y < TABLE_H - 40; y += 28) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(TABLE_W - 28, y + 6);
    ctx.stroke();
  }

  // mountain / ice silhouette
  ctx.fillStyle = 'rgba(200,230,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(40, 210);
  ctx.lineTo(130, 75);
  ctx.lineTo(200, 190);
  ctx.lineTo(270, 90);
  ctx.lineTo(330, 210);
  ctx.closePath();
  ctx.fill();

  ctx.lineCap = 'round';
  for (const seg of geo.walls) {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    if (seg.kind === 'ramp') {
      ctx.strokeStyle = C.ice;
      ctx.lineWidth = 4;
    } else if (seg.kind === 'lane') {
      ctx.strokeStyle = C.mustard;
      ctx.lineWidth = 3;
    } else if (seg.kind === 'sling') {
      ctx.strokeStyle = '#e8b84a';
      ctx.lineWidth = 5;
    } else if (seg.kind === 'orbit') {
      ctx.strokeStyle = '#9ec8e0';
      ctx.lineWidth = 3;
    } else if (seg.kind === 'fan') {
      ctx.strokeStyle = 'rgba(212,192,138,0.7)';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = C.rail;
      ctx.lineWidth = 3;
    }
    ctx.stroke();
  }

  for (const b of geo.bumpers) {
    const glow = b.cooldown > 0;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = glow ? C.mustardLit : C.ice;
    ctx.fill();
    ctx.strokeStyle = C.iceBright;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❄', b.x, b.y + 3);
  }

  for (const t of geo.targets) {
    const lit = isTargetLit(state, t);
    ctx.fillStyle = lit ? C.mustardLit : (t.bank === 'LODGE' ? C.lodge : '#3a3420');
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = lit ? '#fff2b0' : C.rail;
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = lit ? C.ink : C.iceBright;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.letter, t.x + t.w / 2, t.y + 9);
  }

  drawScoop(ctx, geo.triggers.find((t) => t.id === 'chairlift_scoop'), 'CHAIRLIFT', C.mustard);
  drawScoop(
    ctx,
    geo.triggers.find((t) => t.id === 'tree_well'),
    state.treeWellLit ? 'TREE 5×' : 'TREE WELL',
    state.treeWellLit ? '#7dffb0' : C.ice
  );
  drawScoop(
    ctx,
    geo.triggers.find((t) => t.id === 'vault'),
    state.modes.lodgeOpen ? 'VAULT OPEN' : 'LODGE VAULT',
    state.modes.lodgeOpen ? C.lodgeLit : '#c9a0ff'
  );
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'powder_plus_exit'), 'POWDER+', C.iceBright);
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'pipe_exit'), 'PIPE', C.ice);

  // backglass-style title ribbon
  ctx.fillStyle = 'rgba(20,12,4,0.55)';
  ctx.fillRect(44, 48, TABLE_W - 88, 24);
  ctx.strokeStyle = C.mustard;
  ctx.lineWidth = 1;
  ctx.strokeRect(44, 48, TABLE_W - 88, 24);
  ctx.fillStyle = C.dmdText;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SNIPERD  ·  SNOWBOARD PINBALL', TABLE_W / 2, 65);
}

function isTargetLit(state, t) {
  const bank = t.bank === 'BOARD' ? state.board : state.lodge;
  const same = state.geometry.targets.filter((x) => x.bank === t.bank);
  const idx = same.indexOf(t);
  return idx >= 0 && !!bank.lit[idx];
}

function drawScoop(ctx, t, label, color) {
  if (!t) return;
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
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
    ctx.strokeStyle = f.pressed ? C.mustardLit : C.iceBright;
    ctx.lineWidth = f.side === 'mini' ? 7 : 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.pivotX, f.pivotY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = C.mustard;
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
    grd.addColorStop(1, '#c0d0d8');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = '#eef6ff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlunger(ctx, state, input) {
  const p = state.geometry.plunger;
  const pull = input?.plungerPulling ? input.plungerPull : input?._launch || 0;
  const travel = pull * 50;
  ctx.fillStyle = '#6a6050';
  ctx.fillRect(p.x - 4, p.y - 20 + travel, 8, 50);
  ctx.fillStyle = '#c45a2a';
  ctx.fillRect(p.x - 7, p.y + 28 + travel, 14, 10);
  ctx.fillStyle = C.mustardLit;
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

  // DMD-style score strip
  ctx.fillStyle = C.dmdBg;
  ctx.fillRect(0, 0, viewW, 58);
  ctx.strokeStyle = 'rgba(212,160,23,0.35)';
  ctx.strokeRect(0, 0, viewW, 58);

  ctx.fillStyle = C.dmdText;
  ctx.font = `bold ${Math.max(16, Math.floor(viewW * 0.055))}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(hud.score, 12, 28);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = C.mustard;
  ctx.fillText(`BALLS ${hud.balls}`, 12, 48);

  drawLetters(ctx, 'SNOW', state.snow.lit, viewW - 12, 18, true);
  drawLetters(ctx, 'BOARD', state.board.lit, viewW - 12, 34, true);
  drawLetters(ctx, 'LODGE', state.lodge.lit, viewW - 12, 50, true);

  if (state.modes.multiball) {
    ctx.fillStyle = C.lodgeLit;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❄ POWDER MULTIBALL ❄', viewW / 2, 74);
  }

  if (hud.msg) {
    ctx.fillStyle = 'rgba(20,12,4,0.7)';
    const tw = Math.min(viewW - 24, 360);
    ctx.fillRect((viewW - tw) / 2, viewH * 0.42, tw, 36);
    ctx.strokeStyle = C.mustard;
    ctx.strokeRect((viewW - tw) / 2, viewH * 0.42, tw, 36);
    ctx.fillStyle = C.mustardLit;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hud.msg, viewW / 2, viewH * 0.42 + 23);
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(10,8,4,0.75)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = C.dmdText;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', viewW / 2, viewH / 2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = C.mustard;
    ctx.fillText(hud.score, viewW / 2, viewH / 2 + 20);
    ctx.fillText('Pull plunger / Space to restart', viewW / 2, viewH / 2 + 48);
  }
}

function drawLetters(ctx, word, lit, right, y) {
  const chars = word.split('');
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  let x = right;
  for (let i = chars.length - 1; i >= 0; i--) {
    ctx.fillStyle = lit[i] ? C.mustardLit : '#4a4030';
    ctx.fillText(chars[i], x, y);
    x -= 12;
  }
}

function drawTouchHints(ctx, viewW, viewH, input) {
  // Inset flipper zones (match input.js)
  const leftLo = viewW * 0.12;
  const leftHi = viewW * 0.45;
  const rightLo = viewW * 0.55;
  const rightHi = viewW * 0.88;
  ctx.strokeStyle = 'rgba(240,230,192,0.08)';
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(leftLo, viewH * 0.62, leftHi - leftLo, viewH * 0.35);
  ctx.strokeRect(rightLo, viewH * 0.62, rightHi - rightLo, viewH * 0.35);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(240,230,192,0.22)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEFT', (leftLo + leftHi) / 2, viewH - 10);
  ctx.fillText('RIGHT', (rightLo + rightHi) / 2, viewH - 10);
  if (input?.left) {
    ctx.fillStyle = 'rgba(212,160,23,0.12)';
    ctx.fillRect(leftLo, viewH * 0.55, leftHi - leftLo, viewH * 0.45);
  }
  if (input?.right) {
    ctx.fillStyle = 'rgba(212,160,23,0.12)';
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
