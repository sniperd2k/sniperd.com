/**
 * Canvas renderer — SniperD PIXEL BRICK: chunky NES-era style pixel art,
 * cyan/magenta/black/white brick + pixel chrome. ORIGINAL sprites only
 * (no Nintendo / Mario / mushroom / star / coin / copyrighted characters).
 */

import { TABLE_W, TABLE_H } from './physics.js';
import { drawParticles } from './particles.js';
import { formatScore } from './scoring.js';

/** SniperD original 8-bit palette */
const C = {
  void: '#050508',
  brickDk: '#1a1020',
  brickMid: '#2a1830',
  brickLt: '#3a2840',
  mortar: '#0c0810',
  cyan: '#00e8ff',
  cyanHot: '#a8ffff',
  cyanDim: '#007a88',
  magenta: '#ff2eb8',
  magentaHot: '#ff9adf',
  magentaDim: '#880050',
  white: '#f4f4f8',
  chrome: '#c8d0e0',
  chromeHi: '#ffffff',
  chromeLo: '#687088',
  amber: '#ffd040',
  amberDim: '#886820',
  black: '#000000',
  hudBg: 'rgba(5,5,12,0.92)',
  warning: '#ff6040',
};

function px(n) {
  return Math.round(n);
}

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
  ctx.imageSmoothingEnabled = false;
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
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewW, viewH);

  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.translate(ox, oy);
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = false;

  drawPlayfield(ctx, state);
  drawFlippers(ctx, state.geometry.flippers);
  drawBalls(ctx, state.ballsList);
  drawParticles(ctx, state.particles);
  drawPlunger(ctx, state, input);
  drawCrtOverlay(ctx);

  ctx.restore();
  drawHud(ctx, state, viewW, viewH);
  drawTouchHints(ctx, viewW, viewH, input);
}

function drawBrickDeck(ctx) {
  // Solid brick midfield
  ctx.fillStyle = C.brickMid;
  ctx.fillRect(12, 32, TABLE_W - 24, TABLE_H - 42);

  // Chunky brick grid (original procedural tiles — not Mario blocks)
  const bw = 16;
  const bh = 10;
  for (let row = 0; row < 62; row++) {
    const y = 34 + row * bh;
    if (y > TABLE_H - 14) break;
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < 24; col++) {
      const x = 14 + col * bw + offset;
      if (x < 14 || x + bw > TABLE_W - 14) continue;
      const shade = (row + col) % 3;
      ctx.fillStyle = shade === 0 ? C.brickLt : shade === 1 ? C.brickMid : C.brickDk;
      ctx.fillRect(px(x), px(y), bw - 1, bh - 1);
      // Mortar lines
      ctx.fillStyle = C.mortar;
      ctx.fillRect(px(x), px(y + bh - 1), bw, 1);
      ctx.fillRect(px(x + bw - 1), px(y), 1, bh);
    }
  }

  // Outer pixel chrome rail (blocky)
  ctx.fillStyle = C.chromeLo;
  ctx.fillRect(10, 30, TABLE_W - 20, 4);
  ctx.fillRect(10, TABLE_H - 14, TABLE_W - 20, 4);
  ctx.fillRect(10, 30, 4, TABLE_H - 44);
  ctx.fillRect(TABLE_W - 14, 30, 4, TABLE_H - 44);
  ctx.fillStyle = C.chromeHi;
  ctx.fillRect(10, 30, TABLE_W - 20, 1);
  ctx.fillRect(10, 30, 1, TABLE_H - 44);
}

function drawPlayfield(ctx, state) {
  const geo = state.geometry;
  drawBrickDeck(ctx);

  // Decorative original 8-bit cast (SniperD-only — no Nintendo IP)
  drawPixelCritter(ctx, 48, 118, 'cyan'); // "Bit Scout"
  drawPixelCritter(ctx, 300, 200, 'magenta'); // "Pulse Dot"
  drawPixelSpike(ctx, 178, 108); // "Chrome Spike"

  // Walls as chunky pixel segments
  for (const seg of geo.walls) {
    drawPixelSeg(ctx, seg);
  }

  // Jet bumpers — blocky cyan/magenta rings
  for (let i = 0; i < geo.bumpers.length; i++) {
    drawPixelBumper(ctx, geo.bumpers[i], i % 2 === 0);
  }

  // SNIPE standup targets
  for (const t of geo.targets) {
    const lit = isTargetLit(state, t);
    ctx.fillStyle = lit ? C.cyan : C.chromeLo;
    ctx.fillRect(px(t.x), px(t.y), t.w, t.h);
    ctx.fillStyle = lit ? C.cyanHot : C.black;
    ctx.fillRect(px(t.x) + 2, px(t.y) + 2, t.w - 4, t.h - 4);
    ctx.fillStyle = lit ? C.black : C.white;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.letter, t.x + t.w / 2, t.y + t.h / 2 + 3);
  }

  drawPixelScoop(ctx, geo.triggers.find((t) => t.id === 'skill_shot'), 'SKILL', C.amber);
  drawPixelScoop(
    ctx,
    geo.triggers.find((t) => t.id === 'saucer'),
    state.treeWellLit ? '5X' : 'WELL',
    state.treeWellLit ? C.magentaHot : C.magenta
  );
  drawPixelScoop(ctx, geo.triggers.find((t) => t.id === 'ramp_exit'), 'RAMP', C.cyan);
  drawPixelScoop(ctx, geo.triggers.find((t) => t.id === 'loop_exit'), 'LOOP', C.magenta);

  // Title bar — pixel DMD
  ctx.fillStyle = C.black;
  ctx.fillRect(44, 44, TABLE_W - 88, 22);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(44, 44, TABLE_W - 88, 2);
  ctx.fillRect(44, 64, TABLE_W - 88, 2);
  ctx.fillStyle = C.magenta;
  ctx.fillRect(44, 46, 2, 18);
  ctx.fillRect(TABLE_W - 46, 46, 2, 18);
  ctx.fillStyle = C.white;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SNIPERD  PIXEL BRICK', TABLE_W / 2, 59);
}

/** Original 8-bit mascot: round-ish pixel blob with visor (not Mario) */
function drawPixelCritter(ctx, x, y, tone) {
  const body = tone === 'magenta' ? C.magenta : C.cyan;
  const hi = tone === 'magenta' ? C.magentaHot : C.cyanHot;
  // body 8x8
  ctx.fillStyle = body;
  ctx.fillRect(px(x), px(y + 2), 10, 8);
  ctx.fillRect(px(x + 2), px(y), 6, 2);
  ctx.fillRect(px(x + 2), px(y + 10), 2, 3);
  ctx.fillRect(px(x + 6), px(y + 10), 2, 3);
  // visor
  ctx.fillStyle = C.black;
  ctx.fillRect(px(x + 2), px(y + 3), 6, 3);
  ctx.fillStyle = hi;
  ctx.fillRect(px(x + 3), px(y + 4), 2, 1);
  // antenna
  ctx.fillStyle = C.chrome;
  ctx.fillRect(px(x + 4), px(y - 3), 2, 3);
  ctx.fillStyle = C.amber;
  ctx.fillRect(px(x + 3), px(y - 5), 4, 2);
}

/** Original chrome spike decoration */
function drawPixelSpike(ctx, x, y) {
  ctx.fillStyle = C.chromeLo;
  ctx.fillRect(px(x), px(y + 8), 12, 4);
  ctx.fillStyle = C.chrome;
  ctx.fillRect(px(x + 2), px(y + 4), 8, 4);
  ctx.fillStyle = C.chromeHi;
  ctx.fillRect(px(x + 4), px(y), 4, 4);
  ctx.fillStyle = C.magenta;
  ctx.fillRect(px(x + 5), px(y - 2), 2, 2);
}

function drawPixelSeg(ctx, seg) {
  const x1 = px(seg.x1);
  const y1 = px(seg.y1);
  const x2 = px(seg.x2);
  const y2 = px(seg.y2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.max(1, Math.ceil(len / 3));
  let color = C.chrome;
  let thick = 3;
  if (seg.kind === 'ramp') {
    color = C.cyan;
    thick = 4;
  } else if (seg.kind === 'lane') {
    color = C.amber;
    thick = 3;
  } else if (seg.kind === 'sling') {
    color = C.magenta;
    thick = 5;
  } else if (seg.kind === 'orbit') {
    color = C.chromeHi;
    thick = 3;
  } else if (seg.kind === 'guide') {
    color = C.cyanDim;
    thick = 2;
  } else {
    color = C.chrome;
    thick = 3;
  }
  // Under shadow
  ctx.fillStyle = C.black;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    ctx.fillRect(px(x) + 1, px(y) + 1, thick, thick);
  }
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    ctx.fillRect(px(x), px(y), thick, thick);
  }
  // Highlight row for chrome
  if (seg.kind === 'orbit' || seg.kind === 'wall') {
    ctx.fillStyle = C.white;
    for (let i = 0; i <= steps; i += 2) {
      const t = i / steps;
      ctx.fillRect(px(x1 + dx * t), px(y1 + dy * t), 1, 1);
    }
  }
}

function drawPixelBumper(ctx, b, cyanTone) {
  const glow = b.cooldown > 0;
  const r = Math.max(8, Math.round(b.r));
  const cx = px(b.x);
  const cy = px(b.y);
  const ring = glow ? (cyanTone ? C.cyanHot : C.magentaHot) : cyanTone ? C.cyan : C.magenta;
  const core = glow ? C.white : C.black;
  // Outer glow block
  if (glow) {
    ctx.fillStyle = cyanTone ? 'rgba(0,232,255,0.35)' : 'rgba(255,46,184,0.35)';
    ctx.fillRect(cx - r - 4, cy - r - 4, (r + 4) * 2, (r + 4) * 2);
  }
  // Chunky octagon-ish via concentric squares
  ctx.fillStyle = ring;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = C.black;
  ctx.fillRect(cx - r + 3, cy - r + 3, r * 2 - 6, r * 2 - 6);
  ctx.fillStyle = ring;
  ctx.fillRect(cx - r + 6, cy - r + 6, r * 2 - 12, r * 2 - 12);
  ctx.fillStyle = core;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);
  // Corner chrome pips
  ctx.fillStyle = C.chromeHi;
  ctx.fillRect(cx - r + 1, cy - r + 1, 2, 2);
  ctx.fillRect(cx + r - 3, cy - r + 1, 2, 2);
}

function drawPixelScoop(ctx, t, label, color) {
  if (!t) return;
  const r = Math.round(t.r);
  const cx = px(t.x);
  const cy = px(t.y);
  ctx.fillStyle = C.black;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = color;
  ctx.fillRect(cx - r, cy - r, r * 2, 2);
  ctx.fillRect(cx - r, cy + r - 2, r * 2, 2);
  ctx.fillRect(cx - r, cy - r, 2, r * 2);
  ctx.fillRect(cx + r - 2, cy - r, 2, r * 2);
  ctx.fillStyle = color;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, t.x, t.y - t.r - 4);
}

function isTargetLit(state, t) {
  if (t.bank !== 'SNIPE' || !state.snipe) return false;
  const same = state.geometry.targets.filter((x) => x.bank === t.bank);
  const idx = same.indexOf(t);
  return idx >= 0 && !!state.snipe.lit[idx];
}

function drawFlippers(ctx, flippers) {
  for (const f of flippers) {
    const tipX = f.pivotX + Math.cos(f.angle) * f.length;
    const tipY = f.pivotY + Math.sin(f.angle) * f.length;
    const thick = f.side === 'mini' ? 8 : 12;
    const steps = Math.max(6, Math.ceil(f.length / 4));
    // Shadow
    ctx.fillStyle = C.black;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = f.pivotX + (tipX - f.pivotX) * t;
      const y = f.pivotY + (tipY - f.pivotY) * t;
      ctx.fillRect(px(x) + 2, px(y) + 2, thick, thick - 2);
    }
    // Bat body — chrome when idle, amber when pressed
    const col = f.pressed ? C.amber : C.chrome;
    const hi = f.pressed ? C.white : C.chromeHi;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = f.pivotX + (tipX - f.pivotX) * t;
      const y = f.pivotY + (tipY - f.pivotY) * t;
      ctx.fillStyle = i < 2 ? (f.pressed ? C.magenta : C.cyan) : col;
      ctx.fillRect(px(x), px(y), thick, thick - 2);
      if (i % 2 === 0) {
        ctx.fillStyle = hi;
        ctx.fillRect(px(x), px(y), thick, 1);
      }
    }
    // Pivot block
    ctx.fillStyle = C.magenta;
    ctx.fillRect(px(f.pivotX) - 5, px(f.pivotY) - 5, 10, 10);
    ctx.fillStyle = C.white;
    ctx.fillRect(px(f.pivotX) - 2, px(f.pivotY) - 2, 4, 4);
  }
}

function drawBalls(ctx, balls) {
  for (const b of balls) {
    if (!b.active) continue;
    const r = Math.max(6, Math.round(b.r));
    const cx = px(b.x);
    const cy = px(b.y);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(cx - r + 2, cy - r + 3, r * 2, r * 2);
    // Pixel chrome ball (blocky square with highlight)
    ctx.fillStyle = C.chromeLo;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = C.chrome;
    ctx.fillRect(cx - r + 2, cy - r + 2, r * 2 - 4, r * 2 - 4);
    ctx.fillStyle = C.white;
    ctx.fillRect(cx - r + 3, cy - r + 3, 4, 4);
    ctx.fillStyle = C.cyan;
    ctx.fillRect(cx + 1, cy + 1, 2, 2);
  }
}

function drawPlunger(ctx, state, input) {
  const p = state.geometry.plunger;
  const pull = input?.plungerPulling ? input.plungerPull : input?._launch || 0;
  const travel = pull * 56;
  const x = px(p.x);
  const y = px(p.y + travel);
  ctx.fillStyle = C.chromeLo;
  ctx.fillRect(x - 5, y - 22, 10, 54);
  ctx.fillStyle = C.chrome;
  ctx.fillRect(x - 3, y - 20, 6, 50);
  ctx.fillStyle = C.amber;
  ctx.fillRect(x - 8, y + 28, 16, 10);
  ctx.fillStyle = C.black;
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PULL', p.x, p.y + 50 + travel);
}

function drawCrtOverlay(ctx) {
  // Soft scanlines for CRT-ish vibe (still chunky pixels underneath)
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 32; y < TABLE_H - 10; y += 4) {
    ctx.fillRect(12, y, TABLE_W - 24, 1);
  }
  // Subtle vignette corners
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(12, 32, 8, 8);
  ctx.fillRect(TABLE_W - 20, 32, 8, 8);
  ctx.fillRect(12, TABLE_H - 22, 8, 8);
  ctx.fillRect(TABLE_W - 20, TABLE_H - 22, 8, 8);
}

function drawHud(ctx, state, viewW, viewH) {
  const hud = {
    score: formatScore(state.score),
    balls: state.balls,
    msg: state.messageTimer > 0 ? state.message : '',
  };

  ctx.fillStyle = C.hudBg;
  ctx.fillRect(0, 0, viewW, 52);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(0, 50, viewW, 2);
  ctx.fillStyle = C.magenta;
  ctx.fillRect(0, 0, viewW, 2);

  // Fake scanlines on HUD
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 2; y < 50; y += 3) ctx.fillRect(0, y, viewW, 1);

  ctx.fillStyle = C.white;
  ctx.font = `bold ${Math.max(16, Math.floor(viewW * 0.055))}px monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(hud.score, 12, 26);
  ctx.fillStyle = C.cyan;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`BALL ${hud.balls}`, 12, 44);

  if (state.snipe) {
    drawLetters(ctx, 'SNIPE', state.snipe.lit, viewW - 12, 28);
  }

  if (hud.msg) {
    const tw = Math.min(viewW - 24, 360);
    ctx.fillStyle = C.black;
    ctx.fillRect((viewW - tw) / 2, viewH * 0.4, tw, 36);
    ctx.fillStyle = C.magenta;
    ctx.fillRect((viewW - tw) / 2, viewH * 0.4, tw, 2);
    ctx.fillRect((viewW - tw) / 2, viewH * 0.4 + 34, tw, 2);
    ctx.fillStyle = C.cyanHot;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(hud.msg, viewW / 2, viewH * 0.4 + 23);
  }

  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.fillStyle = C.magenta;
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', viewW / 2, viewH / 2 - 12);
    ctx.fillStyle = C.cyan;
    ctx.font = '16px monospace';
    ctx.fillText(hud.score, viewW / 2, viewH / 2 + 20);
    ctx.fillStyle = C.chrome;
    ctx.font = '12px monospace';
    ctx.fillText('PULL / SPACE TO RESTART', viewW / 2, viewH / 2 + 46);
  }
}

function drawLetters(ctx, word, lit, right, y) {
  const chars = word.split('');
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'right';
  let x = right;
  for (let i = chars.length - 1; i >= 0; i--) {
    ctx.fillStyle = lit[i] ? C.cyanHot : C.amberDim;
    ctx.fillText(chars[i], x, y);
    x -= 14;
  }
}

function drawTouchHints(ctx, viewW, viewH, input) {
  const leftLo = viewW * 0.12;
  const leftHi = viewW * 0.45;
  const rightLo = viewW * 0.55;
  const rightHi = viewW * 0.88;
  ctx.strokeStyle = 'rgba(0,232,255,0.15)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
  ctx.strokeRect(leftLo, viewH * 0.62, leftHi - leftLo, viewH * 0.35);
  ctx.strokeStyle = 'rgba(255,46,184,0.15)';
  ctx.strokeRect(rightLo, viewH * 0.62, rightHi - rightLo, viewH * 0.35);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(244,244,248,0.35)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LEFT', (leftLo + leftHi) / 2, viewH - 10);
  ctx.fillText('RIGHT', (rightLo + rightHi) / 2, viewH - 10);
  if (input?.left) {
    ctx.fillStyle = 'rgba(0,232,255,0.12)';
    ctx.fillRect(leftLo, viewH * 0.55, leftHi - leftLo, viewH * 0.45);
  }
  if (input?.right) {
    ctx.fillStyle = 'rgba(255,46,184,0.12)';
    ctx.fillRect(rightLo, viewH * 0.55, rightHi - rightLo, viewH * 0.45);
  }
}
