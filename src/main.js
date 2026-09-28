/**
 * SniperD Pinball bootstrap — full-screen canvas + SFX + turbo debug API.
 */
import { createGame, tick, tryLaunch, getHud, inspectState, inject, drainSfx, TABLE_W, TABLE_H } from './game/game.js';
import { createInputState, bindInput, consumeLaunch } from './game/input.js';
import { resizeCanvas, drawFrame } from './game/render.js';
import { createSfx } from './game/sfx.js';
import { createTurbo, scriptedPlaythrough, runStandardHuntSuite, PHYSICS_TURBO, SCORE_TURBO } from './game/turbo.js';

const canvas = document.getElementById('game');
const state = createGame();
const input = createInputState();
const sfx = createSfx({ muted: false });
const turbo = createTurbo(state, input);

let view = resizeCanvas(canvas);
bindInput(canvas, input, { maxPullPx: 140 });
sfx.bindUnlock(canvas);

window.addEventListener('resize', () => {
  view = resizeCanvas(canvas);
});

function flushSfx(physEvents, extras = {}) {
  sfx.onEvents(physEvents || [], extras);
  for (const name of drainSfx(state)) {
    sfx.play(name);
  }
}

/** Public test/debug API */
window.__SNIPERD__ = {
  version: '1.5.0',
  getState: () => inspectState(state),
  getHud: () => getHud(state),
  inject: (patch) => inject(state, patch),
  tick: (n = 1) => {
    for (let i = 0; i < n; i++) {
      turbo.applyAutos(state.frame);
      const ev = tick(state, input);
      flushSfx(ev);
    }
  },
  launch: (pull = 0.8) => {
    tryLaunch(state, pull);
    flushSfx([], { launch: true });
  },
  setFlippers: (left, right) => {
    input.left = !!left;
    input.right = !!right;
  },
  // Turbo / playthrough hunt
  setTurbo: (n) => turbo.setTurbo(n),
  getTurbo: () => turbo.getTurbo(),
  autoPlunge: (on = true) => turbo.setAutoPlunge(on),
  autoFlip: (left = true, right = true, period) => turbo.setAutoFlip(left, right, period),
  scriptedPlaythrough: (opts) => scriptedPlaythrough(state, input, opts || {}),
  runHunt: (opts) => runStandardHuntSuite(opts || {}),
  PHYSICS_TURBO,
  SCORE_TURBO,
  // SFX
  sfx: {
    unlock: () => sfx.unlock(),
    mute: (m = true) => sfx.setMuted(m),
    isMuted: () => sfx.isMuted(),
    isUnlocked: () => sfx.isUnlocked(),
    play: (name) => sfx.play(name),
    getLog: () => sfx.getLog(),
    presets: sfx.presets,
  },
  table: { W: TABLE_W, H: TABLE_H },
  _state: state,
  _input: input,
  _sfx: sfx,
  _turbo: turbo,
};

let lastTs = performance.now();
let lagSamples = [];

function frame(ts) {
  const dt = ts - lastTs;
  lastTs = ts;
  lagSamples.push(dt);
  if (lagSamples.length > 120) lagSamples.shift();
  const avg = lagSamples.reduce((a, b) => a + b, 0) / lagSamples.length;
  state.rAFLagMs = avg;
  state.lastFrameTs = ts;

  const pull = consumeLaunch(input);
  if (pull != null) {
    tryLaunch(state, pull);
    flushSfx([], { launch: true });
  }

  // When turbo > 1, run N physics ticks per frame (default 1 = normal play).
  const n = turbo.getTurbo();
  let lastEv = [];
  for (let i = 0; i < n; i++) {
    turbo.applyAutos(state.frame);
    lastEv = tick(state, input) || [];
  }
  flushSfx(lastEv);

  drawFrame(view.ctx, state, view.w, view.h, input);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

document.title = 'SniperD Pinball';
