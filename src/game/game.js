/**
 * SniperD Pinball — main game controller (logic + HUD state).
 * Canvas-free core so tests can drive it without rendering.
 */

import {
  M,
  chairliftScoopValue,
  nextChairliftClimb,
  powderPlusRampValue,
  powderBumperValue,
  treeWellCollect,
  boardBonusValue,
  snowCollectValue,
  pipeRampValue,
  peakAwardByIndex,
  multiballJackpot,
  applyScore,
  formatScore,
} from './scoring.js';
import { createLetterBank, spotLetter, spotNext, litCount } from './letters.js';
import { plungerPower } from './plunger.js';
import {
  createModeState,
  lightPeakAward,
  tickPeakTimer,
  rotatePeakAward,
  openLodge,
  addLock,
  startMultiball,
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
  TABLE_W,
  TABLE_H,
} from './physics.js';
import { createParticleSystem, emitSnow, stepParticles } from './particles.js';

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
    chairliftClimb: 0,
    powderPlusHits: 0,
    powderBankHits: 0,
    powderValue: 1 * M,
    treeWellLit: false,
    snow: createLetterBank('SNOW'),
    board: createLetterBank('BOARD'),
    lodge: createLetterBank('LODGE'),
    modes: createModeState(),
    message: 'PULL PLUNGER — SniperD Pinball',
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
  };

  return state;
}

function msg(state, text, frames = 120) {
  state.message = text;
  state.messageTimer = frames;
}

function award(state, amount, reason) {
  const next = applyScore(state, amount, reason);
  state.score = next.score;
  state.lastAward = next.lastAward;
  state.lastReason = next.lastReason;
  msg(state, `${reason}  +${formatScore(amount)}`, 90);
}

function cooldownOk(state, id, frames = 20) {
  const until = state.triggerCooldown[id] || 0;
  if (state.frame < until) return false;
  state.triggerCooldown[id] = state.frame + frames;
  return true;
}

function handleEvents(state, events) {
  const heavy = state.modes.multiball;
  for (const ev of events) {
    if (ev.type === 'bumper') {
      if (!cooldownOk(state, ev.id, 10)) continue;
      const val = powderBumperValue(state.powderBankHits);
      state.powderBankHits += 1;
      state.powderValue = Math.min(4 * M, val);
      award(state, val, 'POWDER BANK');
      state.modes = rotatePeakAward(state.modes);
      if (ev.ball) emitSnow(state.particles, ev.ball.x, ev.ball.y, 8, heavy);
    }

    if (ev.type === 'target') {
      if (!cooldownOk(state, `tgt-${ev.id}`, 30)) continue;
      if (ev.bank === 'BOARD') {
        const r = spotLetter(state.board, ev.letter);
        state.board = r.bank;
        award(state, 250_000, `BOARD ${ev.letter}`);
        if (r.completed) {
          award(state, boardBonusValue(5), 'BOARD COMPLETE');
        }
      } else if (ev.bank === 'LODGE') {
        const r = spotLetter(state.lodge, ev.letter);
        state.lodge = r.bank;
        award(state, 250_000, `LODGE ${ev.letter}`);
        if (r.completed) {
          state.modes = openLodge(state.modes);
          msg(state, 'LODGE OPEN — LOCK BALLS AT VAULT', 180);
        }
      }
    }

    if (ev.type === 'trigger') {
      handleTrigger(state, ev);
    }

    if (ev.type === 'drain') {
      handleDrain(state, ev.ball);
    }

    if (ev.type === 'ramp_contact' && ev.ball) {
      emitSnow(state.particles, ev.ball.x, ev.ball.y, 4, heavy);
    }
  }
}

function handleTrigger(state, ev) {
  const id = ev.id;
  if (!cooldownOk(state, id, 40)) return;
  const ball = ev.ball;
  const heavy = state.modes.multiball;

  switch (id) {
    case 'chairlift_scoop': {
      if (state.modes.multiball && state.modes.jackpotLit) {
        award(state, multiballJackpot(5 * M, 1), 'CHAIRLIFT JACKPOT');
      } else if (state._skillShotArmed) {
        const v = chairliftScoopValue(state.chairliftClimb);
        award(state, v, 'SKILL SHOT CHAIRLIFT');
        state.chairliftClimb = nextChairliftClimb(state.chairliftClimb);
        state._skillShotArmed = false;
      } else if (litCount(state.snow) === 0 && state.snow.completions > 0) {
        // just completed elsewhere — ignore
      }
      // SNOW collect when all lit... actually collect when completing SNOW at scoop
      // If player has been spotting SNOW and completes via ramp, scoop pays
      if (state.snow._readyCollect) {
        const v = snowCollectValue(state.snow.completions);
        award(state, v, 'SNOW COLLECT');
        state.snow._readyCollect = false;
      }
      // hold briefly then kick left
      if (ball) {
        ball.vx = -6;
        ball.vy = 2;
        emitSnow(state.particles, ball.x, ball.y, 12, heavy);
      }
      if (state.modes.peakLit) {
        const peak = peakAwardByIndex(state.modes.peakAwardIndex);
        if (peak.value > 0) award(state, peak.value, peak.label);
        state.modes = { ...state.modes, peakLit: false, peakTimer: 0 };
      }
      break;
    }
    case 'powder_plus_exit': {
      const v = powderPlusRampValue(state.powderPlusHits);
      state.powderPlusHits += 1;
      award(state, v, 'POWDER PLUS');
      const r = spotNext(state.snow);
      state.snow = r.bank;
      if (r.completed) {
        state.snow._readyCollect = true;
        msg(state, 'SNOW LIT — COLLECT AT CHAIRLIFT', 150);
      }
      // feed mini-flipper
      if (ball) {
        ball.x = 100;
        ball.y = 145;
        ball.vx = 3;
        ball.vy = 1;
      }
      emitSnow(state.particles, ball?.x || 70, ball?.y || 95, 10, heavy);
      break;
    }
    case 'pipe_exit': {
      state.modes = bumpModeProgress(state.modes, 1);
      award(state, pipeRampValue(state.modes.modeProgress), 'CENTER PIPE');
      if (ball) {
        // may divert to mini-flipper
        if (state.modes.modeProgress % 2 === 0) {
          ball.x = 110;
          ball.y = 155;
          ball.vx = 2;
          ball.vy = 0;
        }
      }
      emitSnow(state.particles, ball?.x || 190, ball?.y || 70, 8, heavy);
      break;
    }
    case 'tree_well': {
      const v = treeWellCollect(state.powderValue, state.treeWellLit);
      award(state, v || state.powderValue, state.treeWellLit ? 'TREE WELL 5×' : 'TREE WELL');
      state.treeWellLit = false;
      if (ball) {
        // kickout to right flipper
        ball.x = 230;
        ball.y = TABLE_H - 100;
        ball.vx = 2;
        ball.vy = 3;
      }
      break;
    }
    case 'vault': {
      if (state.modes.lodgeOpen || state.modes.powderMultiballReady) {
        state.modes = addLock(state.modes);
        award(state, 1 * M, `LOCK ${state.modes.locks}`);
        if (state.modes.locks >= state.modes.locksNeeded) {
          state.modes = startMultiball(state.modes, 3);
          // spawn extra balls
          for (let i = state.ballsList.length; i < 3; i++) {
            const b = createBall(180 + i * 10, 200, (i - 1) * 2, -8);
            b.held = false;
            state.ballsList.push(b);
          }
          msg(state, 'POWDER MULTIBALL!', 200);
        } else if (ball) {
          ball.active = false;
          ball.held = true;
          state._vaultKickAt = state.frame + 24;
          state._vaultKickBall = ball;
        }
      } else if (state.modes.multiball && state.modes.jackpotLit) {
        award(state, multiballJackpot(10 * M, state.modes.ballsInPlay), 'VAULT JACKPOT');
      } else {
        award(state, 100_000, 'VAULT');
      }
      break;
    }
    case 'inlane_left':
    case 'inlane_right':
      state.modes = lightPeakAward(state.modes, 300);
      msg(state, 'PEAK AWARD LIT', 90);
      break;
    case 'outlane_left':
    case 'outlane_right':
      state.modes = lightPeakAward(state.modes, 180);
      break;
    default:
      break;
  }

  // Mini-flipper path lights tree well
  if (id === 'powder_plus_exit' || id === 'pipe_exit') {
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
  // end ball
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
    // reset extra balls
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
    // restart
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
  msg(state, 'SKILL SHOT — CHAIRLIFT!', 100);
}

/**
 * Fixed-timestep game tick (no rAF). Safe for tests.
 */
export function tick(state, input = null) {
  state.frame += 1;
  if (state.messageTimer > 0) state.messageTimer -= 1;
  state.modes = tickPeakTimer(state.modes);

  if (input) setFlippersFromInput(state, input);

  if (state._vaultKickAt && state.frame >= state._vaultKickAt && state._vaultKickBall) {
    const ball = state._vaultKickBall;
    state._vaultKickAt = 0;
    state._vaultKickBall = null;
    if (!state.modes.multiball) {
      placeBallInPlunger(ball, state.geometry);
      ball.held = false;
      launchFromPlunger(ball, state.geometry, 0.6, plungerPower);
      state.ballInPlay = true;
    }
  }

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
  if (patch.ball) {
    const b = state.ballsList[0];
    Object.assign(b, patch.ball);
    b.held = false;
    b.active = true;
    state.ballInPlay = true;
  }
  return state;
}

export { TABLE_W, TABLE_H, formatScore, plungerPower };
