/**
 * SniperD — original 90s cyber homage (CRT grid + elite HUD).
 * Canvas 2D city/skyline + perspective grid. No film assets.
 * Mobile-first; Chrome + Safari.
 */

const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d', { alpha: false });
const bootEl = document.getElementById('boot');
const bootLog = document.getElementById('boot-log');
const skipBtn = document.getElementById('skip-boot');
const hud = document.getElementById('hud');
const term = document.getElementById('term');
const termForm = document.getElementById('term-form');
const termInput = document.getElementById('term-input');
const clockEl = document.getElementById('clock');
const eliteMeter = document.getElementById('elite-meter');
const elitePct = document.getElementById('elite-pct');

let w = 0;
let h = 0;
let dpr = 1;
let t0 = performance.now();
let elite = 0;
let pulseBurst = 0;
let jackUntil = 0;
let crackProgress = 0;
let crackActive = false;
let towers = [];
let packets = [];
let pointer = null;
let bootDone = false;
let reduceMotion = false;

try {
  reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
} catch (_) {
  /* ignore */
}

const BOOT_LINES = [
  'SNIPERD BIOS v2.0.0 — ORIGINAL NODE',
  'Checking memory banks .............. OK',
  'Mounting /cyber/grid ............... OK',
  'Loading neon firmware .............. OK',
  'CRT phosphor warm-up ............... OK',
  'Negotiating uplink ................. 28.8k*',
  'Handshake: cyan ↔ magenta .......... LOCKED',
  'Elite ACL probe .................... PASS',
  '',
  'Welcome to the grid, operator.',
  'Type HELP in the console. Tap toys.',
  'Homage mode — no film frames loaded.',
];

const HELP_TEXT = [
  'commands: help | status | scan | whoami | clear | about',
  'toys: Pulse Gate · Jack In · Glitch · Crack',
  'tap towers on the skyline for +elite',
].join('\n');

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
  spawnTowers();
}

function spawnTowers() {
  const count = Math.max(8, Math.floor(w / 42));
  towers = [];
  for (let i = 0; i < count; i++) {
    const tw = rand(10, 28);
    const th = rand(h * 0.12, h * 0.42);
    towers.push({
      x: (i + 0.5) * (w / count) + rand(-8, 8),
      w: tw,
      h: th,
      hue: Math.random() < 0.45 ? 185 : 320,
      blink: Math.random(),
      phase: Math.random() * Math.PI * 2,
      hit: 0,
    });
  }
}

function bumpElite(n) {
  elite = Math.min(100, elite + n);
  eliteMeter.style.width = elite + '%';
  elitePct.textContent = Math.round(elite) + '%';
}

function appendTerm(line) {
  term.textContent += (term.textContent ? '\n' : '') + line;
  term.scrollTop = term.scrollHeight;
}

function runCommand(raw) {
  const cmd = String(raw || '').trim().toLowerCase();
  if (!cmd) return;
  appendTerm('> ' + cmd);
  switch (cmd) {
    case 'help':
    case '?':
      appendTerm(HELP_TEXT);
      break;
    case 'status':
      appendTerm(
        `link=UP elite=${Math.round(elite)}% packets=${packets.length} towers=${towers.length}`
      );
      break;
    case 'scan':
      appendTerm('scanning sector…');
      setTimeout(() => {
        appendTerm(`found ${3 + Math.floor(Math.random() * 5)} open ports (demo)`);
        bumpElite(4);
      }, 280);
      break;
    case 'whoami':
      appendTerm('uid=sniperd  gid=elite  tty=crt0');
      bumpElite(2);
      break;
    case 'clear':
      term.textContent = '';
      break;
    case 'about':
      appendTerm(
        'SniperD — creative homage to 90s cyber cinema.\nOriginal layout/art. No scraped frames or logos.'
      );
      break;
    default:
      appendTerm(`unknown: ${cmd} — try help`);
  }
}

/* ---- Canvas scene: perspective grid + neon skyline ---- */
function drawSky(now) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#07071a');
  g.addColorStop(0.45, '#0a0a22');
  g.addColorStop(0.72, '#12081f');
  g.addColorStop(1, '#050510');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // soft aurora
  const ax = w * (0.35 + 0.1 * Math.sin(now * 0.0003));
  const ag = ctx.createRadialGradient(ax, h * 0.2, 10, ax, h * 0.25, w * 0.55);
  ag.addColorStop(0, 'rgba(126, 249, 255, 0.12)');
  ag.addColorStop(0.5, 'rgba(255, 79, 216, 0.06)');
  ag.addColorStop(1, 'transparent');
  ctx.fillStyle = ag;
  ctx.fillRect(0, 0, w, h * 0.7);
}

function drawStars(now) {
  ctx.save();
  for (let i = 0; i < 60; i++) {
    const x = ((i * 97) % w);
    const y = ((i * 53) % (h * 0.55));
    const a = 0.25 + 0.55 * Math.abs(Math.sin(now * 0.001 + i));
    ctx.fillStyle = i % 7 === 0 ? `rgba(255,79,216,${a})` : `rgba(126,249,255,${a})`;
    ctx.fillRect(x, y, i % 11 === 0 ? 2 : 1, i % 11 === 0 ? 2 : 1);
  }
  ctx.restore();
}

function drawHorizonGrid(now) {
  const horizon = h * 0.55;
  const vanishX = w * 0.5;
  const speed = reduceMotion ? 0 : (now * 0.04) % 40;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(w, horizon);
  ctx.strokeStyle = 'rgba(126, 249, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // floor horizontal lines
  for (let i = 0; i < 14; i++) {
    const t = i / 14;
    const y = horizon + Math.pow(t, 1.6) * (h - horizon);
    const alpha = 0.08 + t * 0.35;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = `rgba(255, 79, 216, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // perspective verticals
  for (let i = -10; i <= 10; i++) {
    const offset = i * 40 + speed;
    const x0 = vanishX + offset * 0.15;
    const x1 = vanishX + offset * 3.2;
    ctx.beginPath();
    ctx.moveTo(x0, horizon);
    ctx.lineTo(x1, h);
    ctx.strokeStyle = 'rgba(126, 249, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawTowers(now) {
  const baseY = h * 0.55;
  for (const tw of towers) {
    const glow = tw.hit > 0 ? 1 : 0;
    const top = baseY - tw.h;
    const x = tw.x - tw.w / 2;

    // tower body
    const grad = ctx.createLinearGradient(x, top, x + tw.w, baseY);
    grad.addColorStop(0, `hsla(${tw.hue}, 90%, 55%, 0.15)`);
    grad.addColorStop(1, `hsla(${tw.hue}, 80%, 35%, 0.55)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x, top, tw.w, tw.h);

    ctx.strokeStyle = `hsla(${tw.hue}, 100%, 65%, ${0.55 + glow * 0.4})`;
    ctx.lineWidth = 1 + glow;
    ctx.strokeRect(x + 0.5, top + 0.5, tw.w - 1, tw.h - 1);

    // windows
    const cols = Math.max(1, Math.floor(tw.w / 5));
    const rows = Math.max(2, Math.floor(tw.h / 10));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const on = ((Math.sin(now * 0.002 + tw.phase + r * 0.7 + c) + 1) * 0.5) > 0.35;
        if (!on && glow < 0.5) continue;
        ctx.fillStyle =
          tw.hue < 250
            ? `rgba(126,249,255,${0.35 + glow * 0.4})`
            : `rgba(255,79,216,${0.35 + glow * 0.4})`;
        ctx.fillRect(x + 2 + c * 5, top + 4 + r * 10, 2, 3);
      }
    }

    // antenna blink
    if ((Math.sin(now * 0.008 + tw.blink * 10) > 0.6) || glow) {
      ctx.fillStyle = '#b8ff4a';
      ctx.fillRect(tw.x - 1, top - 6, 2, 6);
    }

    if (tw.hit > 0) tw.hit -= 0.04;
  }
}

function drawPackets(now) {
  for (let i = packets.length - 1; i >= 0; i--) {
    const p = packets[i];
    p.y += p.vy;
    p.x += p.vx;
    p.life -= 0.016;
    if (p.life <= 0 || p.y < 0) {
      packets.splice(i, 1);
      continue;
    }
    ctx.fillStyle = p.magenta
      ? `rgba(255,79,216,${Math.min(1, p.life)})`
      : `rgba(126,249,255,${Math.min(1, p.life)})`;
    ctx.fillRect(p.x, p.y, 3, 8);
  }

  // ambient rising packets
  if (!reduceMotion && Math.random() < 0.08 + pulseBurst * 0.3) {
    packets.push({
      x: rand(0, w),
      y: h * 0.55 + rand(0, h * 0.3),
      vx: rand(-0.3, 0.3),
      vy: rand(-2.5, -1.2),
      life: rand(0.8, 1.6),
      magenta: Math.random() < 0.4,
    });
  }
}

function drawJackRing(now) {
  if (now > jackUntil) return;
  const t = 1 - (jackUntil - now) / 900;
  const r = 20 + t * Math.min(w, h) * 0.35;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.55, r, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,79,216,${1 - t})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.55, r * 0.7, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(126,249,255,${0.8 - t})`;
  ctx.stroke();
}

function drawCrackBar() {
  if (!crackActive) return;
  const bw = Math.min(220, w * 0.7);
  const bx = (w - bw) / 2;
  const by = h * 0.42;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(bx - 4, by - 18, bw + 8, 36);
  ctx.strokeStyle = 'rgba(126,249,255,0.6)';
  ctx.strokeRect(bx - 4, by - 18, bw + 8, 36);
  ctx.fillStyle = '#7ef9ff';
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText('CRACKING ACCESS…', bx, by - 6);
  ctx.fillStyle = 'rgba(255,79,216,0.25)';
  ctx.fillRect(bx, by + 2, bw, 8);
  ctx.fillStyle = '#ff4fd8';
  ctx.fillRect(bx, by + 2, bw * crackProgress, 8);
}

function hitTowerAt(x, y) {
  const baseY = h * 0.55;
  for (const tw of towers) {
    const left = tw.x - tw.w / 2;
    const top = baseY - tw.h;
    if (x >= left && x <= left + tw.w && y >= top && y <= baseY) {
      tw.hit = 1;
      bumpElite(3);
      appendTerm(`tower ping @ ${Math.round(tw.x)},${Math.round(tw.h)}h  +3 elite`);
      for (let i = 0; i < 6; i++) {
        packets.push({
          x: tw.x,
          y: top + rand(0, tw.h * 0.4),
          vx: rand(-1.2, 1.2),
          vy: rand(-3, -1),
          life: 1.2,
          magenta: true,
        });
      }
      return true;
    }
  }
  return false;
}

function frame(now) {
  const t = now - t0;
  drawSky(t);
  drawStars(t);
  drawHorizonGrid(t);
  drawTowers(t);
  drawPackets(t);
  drawJackRing(now);
  drawCrackBar();

  if (pulseBurst > 0) pulseBurst = Math.max(0, pulseBurst - 0.02);
  if (crackActive) {
    crackProgress = Math.min(1, crackProgress + (reduceMotion ? 0.08 : 0.025));
    if (crackProgress >= 1) {
      crackActive = false;
      crackProgress = 0;
      bumpElite(8);
      appendTerm('ACCESS GRANTED (demo). password=********');
    }
  }

  requestAnimationFrame(frame);
}

/* ---- Boot sequence ---- */
function typeBoot(done) {
  let i = 0;
  bootLog.textContent = '';

  function next() {
    if (bootDone) {
      done();
      return;
    }
    if (i >= BOOT_LINES.length) {
      done();
      return;
    }
    bootLog.textContent += (bootLog.textContent ? '\n' : '') + BOOT_LINES[i];
    i += 1;
    const delay = reduceMotion ? 20 : 90 + Math.floor(Math.random() * 70);
    setTimeout(next, delay);
  }
  next();
}

function finishBoot() {
  if (bootDone) return;
  bootDone = true;
  bootEl.classList.add('done');
  hud.hidden = false;
  hud.classList.remove('hidden');
  requestAnimationFrame(() => hud.classList.add('visible'));
  appendTerm('uplink ready. type help — or mash the toys.');
  bumpElite(5);
  try {
    termInput.focus({ preventScroll: true });
  } catch (_) {
    /* ignore */
  }
}

function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  clockEl.textContent = `${hh}:${mm}:${ss}`;
}

/* ---- Toys ---- */
function toyPulse() {
  pulseBurst = 1;
  bumpElite(5);
  appendTerm('pulse gate fired — traffic spike');
  for (let i = 0; i < 18; i++) {
    packets.push({
      x: rand(0, w),
      y: h * 0.7,
      vx: rand(-0.8, 0.8),
      vy: rand(-4, -2),
      life: 1.4,
      magenta: Math.random() < 0.5,
    });
  }
}

function toyJack() {
  jackUntil = performance.now() + 900;
  bumpElite(6);
  appendTerm('jacking in… neural handshake (fake)');
}

function toyGlitch() {
  document.body.classList.add('glitching');
  bumpElite(4);
  appendTerm('glitch overlay — phosphor smear');
  setTimeout(() => document.body.classList.remove('glitching'), 380);
}

function toyCrack() {
  if (crackActive) return;
  crackActive = true;
  crackProgress = 0;
  appendTerm('launching cracker…');
}

/* ---- Wire up ---- */
resize();
window.addEventListener('resize', resize);

skipBtn.addEventListener('click', finishBoot);
typeBoot(finishBoot);
setTimeout(() => {
  if (!bootDone) finishBoot();
}, reduceMotion ? 400 : 4200);

termForm.addEventListener('submit', (e) => {
  e.preventDefault();
  runCommand(termInput.value);
  termInput.value = '';
});

document.querySelectorAll('.toy').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-toy');
    if (id === 'pulse') toyPulse();
    else if (id === 'jack') toyJack();
    else if (id === 'glitch') toyGlitch();
    else if (id === 'crack') toyCrack();
  });
});

canvas.addEventListener(
  'pointerdown',
  (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    pointer = { x, y };
    hitTowerAt(x, y);
  },
  { passive: true }
);

canvas.addEventListener(
  'pointermove',
  (e) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  },
  { passive: true }
);

canvas.addEventListener('pointerleave', () => {
  pointer = null;
});

tickClock();
setInterval(tickClock, 1000);
requestAnimationFrame(frame);
