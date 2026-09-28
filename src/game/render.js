/**
 * Canvas renderer for SniperD Pinball — snowboard machine look.
 */

import { TABLE_W, TABLE_H } from './physics.js';
import { drawParticles } from './particles.js';
import { formatScore } from './scoring.js';

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

  // cabinet backdrop
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#0a1628');
  g.addColorStop(0.5, '#12304a');
  g.addColorStop(1, '#071018');
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
  // wood/snow deck
  const deck = ctx.createLinearGradient(0, 0, 0, TABLE_H);
  deck.addColorStop(0, '#1a3a55');
  deck.addColorStop(0.35, '#24506e');
  deck.addColorStop(1, '#152838');
  roundRect(ctx, 16, 36, TABLE_W - 32, TABLE_H - 48, 18);
  ctx.fillStyle = deck;
  ctx.fill();
  ctx.strokeStyle = '#8ec8e8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // mountain art
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(40, 200);
  ctx.lineTo(120, 80);
  ctx.lineTo(200, 180);
  ctx.lineTo(260, 100);
  ctx.lineTo(320, 200);
  ctx.closePath();
  ctx.fill();

  // walls
  ctx.strokeStyle = '#cfefff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const seg of geo.walls) {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    if (seg.kind === 'ramp') ctx.strokeStyle = '#7fd0ff';
    else if (seg.kind === 'lane') ctx.strokeStyle = '#ffd27a';
    else ctx.strokeStyle = '#b8dceb';
    ctx.stroke();
  }

  // bumpers
  for (const b of geo.bumpers) {
    const glow = b.cooldown > 0;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = glow ? '#fff6a8' : '#5ec8ff';
    ctx.fill();
    ctx.strokeStyle = '#eaf8ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0a2030';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❄', b.x, b.y + 3);
  }

  // targets BOARD / LODGE
  for (const t of geo.targets) {
    const bank = t.bank === 'BOARD' ? state.board : state.lodge;
    const idx = bank.letters.indexOf(t.letter);
    // find matching unlit index roughly by id order — use letter lit map
    let lit = false;
    for (let i = 0; i < bank.letters.length; i++) {
      if (bank.letters[i] === t.letter && bank.lit[i]) {
        // approximate: light if any matching letter lit; fine for visual
        lit = true;
        break;
      }
    }
    // better: map by position in bank via target order
    lit = isTargetLit(state, t);
    ctx.fillStyle = lit ? '#ffe566' : '#2a4a62';
    ctx.fillRect(t.x, t.y, t.w, t.h);
    ctx.strokeStyle = '#dff3ff';
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    ctx.fillStyle = lit ? '#203040' : '#d6eefc';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.letter, t.x + t.w / 2, t.y + 8);
  }

  // feature labels / scoops
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'chairlift_scoop'), 'CHAIRLIFT', '#ffcc66');
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'tree_well'), state.treeWellLit ? 'TREE 5×' : 'TREE WELL', state.treeWellLit ? '#7dffb0' : '#8ecfff');
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'vault'), state.modes.lodgeOpen ? 'VAULT OPEN' : 'VAULT', state.modes.lodgeOpen ? '#ff8ad8' : '#c9a0ff');
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'powder_plus_exit'), 'POWDER+', '#a8e6ff');
  drawScoop(ctx, geo.triggers.find((t) => t.id === 'pipe_exit'), 'PIPE', '#9ad0ff');

  // title ribbon
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(50, 48, TABLE_W - 100, 22);
  ctx.fillStyle = '#e8f7ff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SNIPERD  ·  PINBALL', TABLE_W / 2, 64);
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
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
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
    ctx.strokeStyle = f.pressed ? '#fff1a0' : '#f0f6ff';
    ctx.lineWidth = f.side === 'mini' ? 7 : 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(f.pivotX, f.pivotY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.fillStyle = '#8ecfff';
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
    grd.addColorStop(1, '#9ec4d8');
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = '#dfefff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawPlunger(ctx, state, input) {
  const p = state.geometry.plunger;
  const pull = input?.plungerPulling ? input.plungerPull : input?._launch || 0;
  const travel = pull * 50;
  ctx.fillStyle = '#8899aa';
  ctx.fillRect(p.x - 4, p.y - 20 + travel, 8, 50);
  ctx.fillStyle = '#ff6b4a';
  ctx.fillRect(p.x - 7, p.y + 28 + travel, 14, 10);
  ctx.fillStyle = '#ffd7cc';
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

  ctx.fillStyle = 'rgba(0,10,20,0.55)';
  ctx.fillRect(0, 0, viewW, 56);
  ctx.fillStyle = '#eaf8ff';
  ctx.font = `bold ${Math.max(16, Math.floor(viewW * 0.055))}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(hud.score, 12, 28);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#9ad0ff';
  ctx.fillText(`BALLS ${hud.balls}`, 12, 46);

  // letter banks
  drawLetters(ctx, 'SNOW', state.snow.lit, viewW - 12, 18, true);
  drawLetters(ctx, 'BOARD', state.board.lit, viewW - 12, 34, true);
  drawLetters(ctx, 'LODGE', state.lodge.lit, viewW - 12, 50, true);

  if (state.modes.multiball) {
    ctx.fillStyle = '#ff8ad8';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('❄ POWDER MULTIBALL ❄', viewW / 2, 72);
  }

  if (hud.msg) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = Math.min(viewW - 24, 360);
    ctx.fillRect((viewW - tw) / 2, viewH * 0.42, tw, 36);
    ctx.fillStyle = '#fff6c8';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(hud.msg, viewW / 2, viewH * 0.42 + 23);
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', viewW / 2, viewH / 2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#9ad0ff';
    ctx.fillText(hud.score, viewW / 2, viewH / 2 + 20);
    ctx.fillText('Pull plunger / Space to restart', viewW / 2, viewH / 2 + 48);
  }
}

function drawLetters(ctx, word, lit, right, y, alignRight) {
  const chars = word.split('');
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = alignRight ? 'right' : 'left';
  let x = right;
  for (let i = chars.length - 1; i >= 0; i--) {
    ctx.fillStyle = lit[i] ? '#ffe566' : '#3a5568';
    ctx.fillText(chars[i], x, y);
    x -= 12;
  }
}

function drawTouchHints(ctx, viewW, viewH, input) {
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(viewW / 2, viewH * 0.7);
  ctx.lineTo(viewW / 2, viewH - 8);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LEFT', viewW * 0.25, viewH - 10);
  ctx.fillText('RIGHT', viewW * 0.65, viewH - 10);
  if (input?.left) {
    ctx.fillStyle = 'rgba(255,230,120,0.12)';
    ctx.fillRect(0, viewH * 0.55, viewW / 2, viewH * 0.45);
  }
  if (input?.right) {
    ctx.fillStyle = 'rgba(255,230,120,0.12)';
    ctx.fillRect(viewW / 2, viewH * 0.55, viewW / 2, viewH * 0.45);
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
