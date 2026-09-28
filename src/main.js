/**
 * SniperD Pinball bootstrap — full-screen canvas + debug hook.
 */
import { createGame, tick, tryLaunch, getHud, inspectState, inject, TABLE_W, TABLE_H } from './game/game.js';
import { createInputState, bindInput, consumeLaunch } from './game/input.js';
import { resizeCanvas, drawFrame } from './game/render.js';

const canvas = document.getElementById('game');
const state = createGame();
const input = createInputState();

let view = resizeCanvas(canvas);
bindInput(canvas, input, { maxPullPx: 140 });

window.addEventListener('resize', () => {
  view = resizeCanvas(canvas);
});

/** Public test/debug API */
window.__SNIPERD__ = {
  version: '1.0.0',
  getState: () => inspectState(state),
  getHud: () => getHud(state),
  inject: (patch) => inject(state, patch),
  tick: (n = 1) => {
    for (let i = 0; i < n; i++) tick(state, input);
  },
  launch: (pull = 0.8) => tryLaunch(state, pull),
  setFlippers: (left, right) => {
    input.left = !!left;
    input.right = !!right;
  },
  table: { W: TABLE_W, H: TABLE_H },
  _state: state,
  _input: input,
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
  if (pull != null) tryLaunch(state, pull);

  // fixed step — one physics tick per frame (cap spiral)
  tick(state, input);

  drawFrame(view.ctx, state, view.w, view.h, input);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Attract message
document.title = 'SniperD Pinball';
