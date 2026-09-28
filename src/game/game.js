/**
 * SniperD Pinball — Arcade Neon game controller (logic + HUD state).
 * Canvas-free core so tests can drive it without rendering.
 * Missions / multiball deferred; basic score + N-ball only.
 */

import {
  M,
  chairliftScoopValue,
  nextChairliftClimb,
  powderPlusRampValue,
  powderBumperValue,
  treeWellCollect,
  boardBonusValue,
  pipeRampValue,
  peakAwardByIndex,
  applyScore,
  formatScore,
} from './scoring.js';
import { createLetterBank, spotLetter, litCount } from './letters.js';
import { plungerPower } from './plunger.js';
import {
  createModeState,
  lightPeakAward,
  tickPeakTimer,
  rotatePeakAward,
  onBallDrain,
  bumpModeProgress,
  ModeId,
} from './modes.js';
import {
  createTableGeometry,
  createBall,
  placeBallInPlunger,
  launchFromPlunger,
  stepPhysics,
  setFlipperPressed,
  applyBallState,
  kickBall,
  TABLE_W,
  TABLE_H,
  PHYSICS_HZ,
} from './physics.js';
import { createParticleSystem, emitSparks, stepParticles } from './particles.js';

export function createGame(opts = {}) {
  const geometry = createTableGeometry();
  const ball = createBall(0, 0);
  placeBallInPlunger(ball, geometry);

  const state = {
    score: 0,
    balls: 3,
    ballInPlay: false,
    gameOver: false,
    lastAward: 0,
    lastReason: '',
    // Counters kept for turbo hunt invariants / scoring helpers
    chairliftClimb: 0,
    powderPlusHits: 0,
    powderBankHits: 0,
    powderValue: 1 * M,
    treeWellLit: false,
    snipe: createLetterBank('SNIPE'),
    // Stub banks so older HUD helpers / inject don't explode
    snow: createLetterBank('SNOW'),
    board: createLetterBank('BOARD'),
    lodge: createLetterBank('LODGE'),
    modes: createModeState(),
    message: 'PULL PLUNGER — Arcade Neon',
    messageTimer: 180,
    triggerCooldown: Object.create(null),
    frame: 0,
    rAFLagMs: 0,
    lastFrameTs: 0,
    particles: createParticleSystem(),
    geometry,
    ballsList: [ball],
    seed: opts.seed ?? 1,
    _skillShotArmed: true,
    sfxEvents: [],
  };

  return state;
}

function msg(state, text, frames = 120) {
  state.message = text;
  state.messageTimer = frames;
}

function pushSfx(state, name) {
  if (!state.sfxEvents) state.sfxEvents = [];
  state.sfxEvents.push(name);
}

/** Drain queued SFX cue names (for audio layer). */
export function drainSfx(state) {
  const q = state.sfxEvents || [];
  state.sfxEvents = [];
  return q;
}

function award(state, amount, reason) {
  const next = applyScore(state, amount, reason);
  state.score = next.score;
  state.lastAward = next.lastAward;
  state.lastReason = next.lastReason;
  msg(state, `${reason}  +${formatScore(amount)}`, 90);
  pushSfx(state, 'scoring');
}

function cooldownOk(state, id, frames = 20) {
  const until = state.triggerCooldown[id] || 0;
  if (state.frame < until) return false;
  state.triggerCooldown[id] = state.frame + frames;
  return true;
}

function handleEvents(state, events) {
  const heavy = false;
  for (const ev of events) {
    if (ev.type === 'bumper') {
      if (!cooldownOk(state, ev.id, 10)) continue;
      const val = powderBumperValue(state.powderBankHits);
      state.powderBankHits += 1;
      state.powderValue = Math.min(4 * M, val);
      award(state, val, 'JET BUMPER');
      state.modes = rotatePeakAward(state.modes);
      if (ev.ball) emitSparks(state.particles, ev.ball.x, ev.ball.y, 8, heavy);
      pushSfx(state, 'spark');
    }

    if (ev.type === 'sling') {
      if (!cooldownOk(state, 'sling', 12)) continue;
      award(state, 25_000, 'SLING');
      pushSfx(state, 'bumper');
    }

    if (ev.type === 'target') {
      if (!cooldownOk(state, `tgt-${ev.id}`, 30)) continue;
      if (ev.bank === 'SNIPE') {
        const r = spotLetter(state.snipe, ev.letter);
        state.snipe = r.bank;
        award(state, 250_000, `SNIPE ${ev.letter}`);
        if (r.completed) {
          award(state, boardBonusValue(5), 'SNIPE COMPLETE');
          msg(state, 'SNIPE COMPLETE — BONUS', 150);
        }
      } else {
        award(state, 100_000, 'TARGET');
      }
    }

    if (ev.type === 'trigger') {
      handleTrigger(state, ev);
    }

    if (ev.type === 'drain') {
      handleDrain(state, ev.ball);
    }

    if (ev.type === 'ramp_contact' && ev.ball) {
      emitSparks(state.particles, ev.ball.x, ev.ball.y, 4, heavy);
    }

    if (ev.type === 'flipper') {
      pushSfx(state, 'flipper');
    }
  }
}

function handleTrigger(state, ev) {
  const id = ev.id;
  if (!cooldownOk(state, id, 40)) return;
  const ball = ev.ball;

  switch (id) {
    case 'skill_shot': {
      if (state._skillShotArmed) {
        const v = chairliftScoopValue(state.chairliftClimb);
        award(state, v, 'SKILL SHOT');
        state.chairliftClimb = nextChairliftClimb(state.chairliftClimb);
        state._skillShotArmed = false;
      } else {
        award(state, 150_000, 'LANE');
      }
      if (ball) {
        kickBall(ball, state.geometry, -7, 8);
        emitSparks(state.particles, ball.x, ball.y, 10, false);
      }
      if (state.modes.peakLit) {
        const peak = peakAwardByIndex(state.modes.peakAwardIndex);
        if (peak.value > 0) award(state, peak.value, peak.label);
        state.modes = { ...state.modes, peakLit: false, peakTimer: 0 };
      }
      break;
    }
    case 'ramp_exit': {
      const v = powderPlusRampValue(state.powderPlusHits);
      state.powderPlusHits += 1;
      award(state, v, 'RAMP');
      state.modes = bumpModeProgress(state.modes, 1);
      if (ball) kickBall(ball, state.geometry, 4, 2);
      emitSparks(state.particles, ball?.x || 78, ball?.y || 96, 10, false);
      pushSfx(state, 'ramp');
      break;
    }
    case 'loop_exit': {
      state.modes = bumpModeProgress(state.modes, 1);
      award(state, pipeRampValue(state.modes.modeProgress), 'LOOP');
      if (ball) kickBall(ball, state.geometry, -3, 3);
      emitSparks(state.particles, ball?.x || 268, ball?.y || 148, 8, false);
      pushSfx(state, 'ramp');
      break;
    }
    case 'saucer': {
      const v = treeWellCollect(state.powderValue, state.treeWellLit);
      award(state, v || state.powderValue, state.treeWellLit ? 'SAUCER 5×' : 'SAUCER');
      pushSfx(state, 'saucer');
      state.treeWellLit = false;
      if (ball) kickBall(ball, state.geometry, -4, 5);
      break;
    }
    case 'inlane_left':
    case 'inlane_right':
      state.modes = lightPeakAward(state.modes, 300);
      state.treeWellLit = true;
      msg(state, 'BONUS LIT', 90);
      break;
    case 'outlane_left':
    case 'outlane_right':
      state.modes = lightPeakAward(state.modes, 180);
      break;
    default:
      break;
  }

  if (id === 'ramp_exit' || id === 'loop_exit') {
    state.treeWellLit = true;
  }
}

function handleDrain(state, ball) {
  state.modes = onBallDrain(state.modes);
  const active = state.ballsList.filter((b) => b.active && !b.held).length;
  if (state.modes.multiball && active > 0) {
    msg(state, 'BALL DRAINED', 60);
    return;
  }
  state.ballInPlay = false;
  state.powderPlusHits = 0;
  state.powderBankHits = 0;
  state.powderValue = 1 * M;
  state.treeWellLit = false;
  state._skillShotArmed = true;
  state.balls -= 1;
  if (state.balls <= 0) {
    state.gameOver = true;
    msg(state, `GAME OVER — ${formatScore(state.score)}`, 9999);
  } else {
    msg(state, `BALL ${4 - state.balls} — PULL PLUNGER`, 180);
    placeBallInPlunger(ball || state.ballsList[0], state.geometry);
    state.ballsList = [state.ballsList[0]];
    state.ballsList[0].active = true;
  }
}

export function setFlippersFromInput(state, input) {
  for (const f of state.geometry.flippers) {
    if (f.side === 'left') setFlipperPressed(f, input.left);
    else if (f.side === 'right') setFlipperPressed(f, input.right);
    else if (f.side === 'mini') setFlipperPressed(f, input.mini || input.left);
  }
}

export function tryLaunch(state, pullNorm) {
  if (state.gameOver) {
    Object.assign(state, createGame({ seed: state.seed }));
    return;
  }
  if (state.ballInPlay) return;
  const ball = state.ballsList.find((b) => b.held) || state.ballsList[0];
  if (!ball) return;
  const speed = launchFromPlunger(ball, state.geometry, pullNorm, plungerPower);
  if (speed <= 0) {
    placeBallInPlunger(ball, state.geometry);
    return;
  }
  state.ballInPlay = true;
  msg(state, 'SKILL SHOT — AIM THE LANE!', 100);
  pushSfx(state, 'plunger');
}

/**
 * Fixed-timestep game tick (no rAF). Safe for tests.
 */
export function tick(state, input = null) {
  state.frame += 1;
  if (state.messageTimer > 0) state.messageTimer -= 1;
  state.modes = tickPeakTimer(state.modes);

  if (input) setFlippersFromInput(state, input);

  const world = { balls: state.ballsList, geometry: state.geometry };
  const events = stepPhysics(world, 1);
  handleEvents(state, events);
  stepParticles(state.particles);

  return events;
}

export function getHud(state) {
  return {
    score: state.score,
    scoreLabel: formatScore(state.score),
    balls: state.balls,
    message: state.messageTimer > 0 ? state.message : '',
    snipe: state.snipe.lit.slice(),
    snow: state.snow.lit.slice(),
    board: state.board.lit.slice(),
    lodge: state.lodge.lit.slice(),
    powderValue: state.powderValue,
    powderLabel: formatScore(state.powderValue),
    mode: state.modes.mode,
    multiball: state.modes.multiball,
    peakLit: state.modes.peakLit,
    peakAward: peakAwardByIndex(state.modes.peakAwardIndex),
    treeWellLit: state.treeWellLit,
    lodgeOpen: state.modes.lodgeOpen,
    locks: state.modes.locks,
    gameOver: state.gameOver,
    ballInPlay: state.ballInPlay,
    chairliftClimb: state.chairliftClimb,
    snipeLit: litCount(state.snipe),
  };
}

export function inspectState(state) {
  return {
    hud: getHud(state),
    frame: state.frame,
    ballCount: state.ballsList.filter((b) => b.active).length,
    balls: state.ballsList.map((b) => ({
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      active: b.active,
      held: b.held,
    })),
    modes: { ...state.modes },
    score: state.score,
  };
}

/** Test helper: inject score / letters / mode */
export function inject(state, patch = {}) {
  if (patch.score != null) state.score = patch.score;
  if (patch.balls != null) state.balls = patch.balls;
  if (patch.mode) state.modes.mode = patch.mode;
  if (patch.multiball != null) {
    state.modes.multiball = patch.multiball;
    if (patch.multiball) state.modes.mode = ModeId.MULTIBALL;
  }
  if (patch.snowLit) state.snow.lit = patch.snowLit;
  if (patch.snipeLit) state.snipe.lit = patch.snipeLit;
  if (patch.ball) {
    const b = state.ballsList[0];
    Object.assign(b, patch.ball);
    b.held = false;
    b.active = true;
    state.ballInPlay = true;
    applyBallState(state.geometry, b);
  }
  return state;
}

export { TABLE_W, TABLE_H, PHYSICS_HZ, formatScore, plungerPower };
