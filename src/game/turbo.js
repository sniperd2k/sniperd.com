/**
 * Turbo / automated playthrough hunt for SniperD Pinball.
 * Default OFF (multiplier 1). Normal play unchanged.
 *
 * Two-pass hunt (≤30s wall budget for full suite):
 *  1) ~100× physics disaster sweep
 *  2) ~10–20× score sanity pass
 */

import { createGame, tick, tryLaunch, getHud, setFlippersFromInput } from './game.js';
import { createInputState } from './input.js';
import { TABLE_H } from './physics.js';

export const DEFAULT_TURBO = 1;
export const PHYSICS_TURBO = 100;
export const SCORE_TURBO = 15;
/** Soft ceiling so CI stays well under 30s wall for both passes */
export const HUNT_WALL_BUDGET_MS = 28_000;

/**
 * Create turbo controller bound to a live game + input (browser or tests).
 */
export function createTurbo(state, input) {
  let multiplier = DEFAULT_TURBO;
  let autoPlunge = false;
  let autoFlipL = false;
  let autoFlipR = false;
  let autoFlipPeriod = 18;
  let scripted = null;

  function setTurbo(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 1) {
      multiplier = DEFAULT_TURBO;
      return multiplier;
    }
    multiplier = Math.min(2000, Math.floor(v));
    return multiplier;
  }

  function getTurbo() {
    return multiplier;
  }

  function setAutoPlunge(on) {
    autoPlunge = !!on;
  }

  function setAutoFlip(left, right, period) {
    autoFlipL = !!left;
    autoFlipR = !!right;
    if (period != null && period > 0) autoFlipPeriod = period | 0;
  }

  function setScript(script) {
    scripted = script || null;
  }

  function applyAutos(frame) {
    if (scripted && Array.isArray(scripted.steps)) {
      for (const step of scripted.steps) {
        if (step.frame === frame) {
          if (step.left != null) input.left = !!step.left;
          if (step.right != null) input.right = !!step.right;
          if (step.plunge != null) tryLaunch(state, step.plunge);
        }
      }
    }
    if (autoFlipL || autoFlipR) {
      const on = Math.floor(frame / autoFlipPeriod) % 2 === 0;
      if (autoFlipL) input.left = on;
      if (autoFlipR) input.right = !on;
    }
    if (autoPlunge && !state.ballInPlay && !state.gameOver) {
      tryLaunch(state, 0.85);
    }
    if (autoPlunge && state.gameOver) {
      tryLaunch(state, 0.85);
    }
  }

  /** Advance `multiplier` (or override) ticks — used by rAF when turbo > 1. */
  function turboTick(overrideMult) {
    const n = overrideMult != null ? overrideMult : multiplier;
    let lastEvents = [];
    for (let i = 0; i < n; i++) {
      applyAutos(state.frame);
      lastEvents = tick(state, input) || [];
    }
    return lastEvents;
  }

  return {
    setTurbo,
    getTurbo,
    setAutoPlunge,
    setAutoFlip,
    setScript,
    applyAutos,
    turboTick,
    autoPlunge: () => autoPlunge,
    autoFlip: () => ({ left: autoFlipL, right: autoFlipR, period: autoFlipPeriod }),
  };
}

export function snapshotInvariants(state) {
  const balls = state.ballsList.map((b) => ({
    x: b.x,
    y: b.y,
    vx: b.vx,
    vy: b.vy,
    active: b.active,
    held: b.held,
  }));
  return {
    score: state.score,
    balls: state.balls,
    ballInPlay: state.ballInPlay,
    gameOver: state.gameOver,
    powderPlusHits: state.powderPlusHits,
    powderBankHits: state.powderBankHits,
    powderValue: state.powderValue,
    frame: state.frame,
    ballsList: balls,
    flippers: state.geometry.flippers.map((f) => ({
      side: f.side,
      pressed: f.pressed,
      angle: f.angle,
    })),
  };
}

function nearFlippers(ball, margin = 50) {
  // lower playfield around main flippers
  return ball.y > TABLE_H - 55 - margin;
}

/**
 * Stuck ball: active, not held, near-zero velocity, position unchanged,
 * AND not resting on flippers (that is valid pinball).
 */
export function detectStuckBall(history, opts = {}) {
  const need = opts.samples || 40;
  const eps = opts.eps || 0.35;
  if (history.length < need) return null;
  const slice = history.slice(-need);
  for (let bi = 0; bi < (slice[0].ballsList || []).length; bi++) {
    let stuck = true;
    const first = slice[0].ballsList[bi];
    if (!first || !first.active || first.held) continue;
    if (nearFlippers(first)) continue;
    for (const snap of slice) {
      const b = snap.ballsList[bi];
      if (!b || !b.active || b.held) {
        stuck = false;
        break;
      }
      if (nearFlippers(b)) {
        stuck = false;
        break;
      }
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > eps) {
        stuck = false;
        break;
      }
      if (Math.hypot(b.x - first.x, b.y - first.y) > eps * 2) {
        stuck = false;
        break;
      }
    }
    if (stuck) {
      return {
        type: 'stuck_ball',
        ballIndex: bi,
        x: first.x,
        y: first.y,
        frames: need,
      };
    }
  }
  return null;
}

/**
 * Infinite trap: ball loops in a tiny mid-table region for a long window.
 * Excludes flipper rest zone and plunger lane.
 */
export function detectInfiniteTrap(history, opts = {}) {
  const need = opts.samples || 80;
  const region = opts.region || 12;
  if (history.length < need) return null;
  const slice = history.slice(-need);
  if (slice.some((s) => s.gameOver || !s.ballInPlay)) return null;
  for (let bi = 0; bi < (slice[0].ballsList || []).length; bi++) {
    const first = slice[0].ballsList[bi];
    if (!first || !first.active || first.held) continue;
    if (nearFlippers(first, 60)) continue;
    if (first.x > 300) continue; // plunger skill lane (Cadet right rail)
    let maxDist = 0;
    let minY = first.y;
    let maxY = first.y;
    for (const snap of slice) {
      const b = snap.ballsList[bi];
      if (!b || !b.active) {
        maxDist = Infinity;
        break;
      }
      maxDist = Math.max(maxDist, Math.hypot(b.x - first.x, b.y - first.y));
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y);
    }
    if (maxDist < region && maxY - minY < region) {
      return {
        type: 'infinite_loop_trap',
        ballIndex: bi,
        region: maxDist,
        y: first.y,
      };
    }
  }
  return null;
}

export function detectScoreSanity(snaps, opts = {}) {
  const findings = [];
  const maxReasonable = opts.maxScore ?? 500_000_000;
  let prevScore = snaps[0]?.score ?? 0;
  let prevBalls = snaps[0]?.balls ?? 3;
  let sawGameOver = false;

  for (let i = 0; i < snaps.length; i++) {
    const s = snaps[i];
    if (s.score < 0) {
      findings.push({ type: 'negative_score', frame: s.frame, score: s.score });
    }
    if (!Number.isFinite(s.score)) {
      findings.push({ type: 'nonfinite_score', frame: s.frame, score: s.score });
    }
    if (s.score > maxReasonable) {
      findings.push({ type: 'impossible_score', frame: s.frame, score: s.score });
    }
    if (s.powderValue < 0 || s.powderPlusHits < 0 || s.powderBankHits < 0) {
      findings.push({ type: 'negative_mode_counters', frame: s.frame });
    }

    // Legitimate new-game reset: balls back to 3 and score cleared (with or without
    // an intervening gameOver snapshot).
    const newGameReset =
      s.score === 0 &&
      s.balls === 3 &&
      !s.gameOver &&
      (sawGameOver || prevBalls === 0 || (prevScore > 0 && s.score < prevScore && prevBalls <= 1));

    if (s.gameOver) {
      sawGameOver = true;
    }

    if (newGameReset) {
      if (sawGameOver || prevBalls === 0 || prevScore > 0) {
        // expected reset — only flag if score failed to clear (handled below)
        if (s.score !== 0) {
          findings.push({
            type: 'score_not_reset_on_new_game',
            frame: s.frame,
            score: s.score,
          });
        }
      }
      sawGameOver = false;
      prevScore = 0;
      prevBalls = s.balls;
      continue;
    }

    if (s.score < prevScore && !sawGameOver) {
      findings.push({
        type: 'score_decreased',
        frame: s.frame,
        from: prevScore,
        to: s.score,
      });
    }
    if (s.balls < prevBalls && s.balls > 0) {
      if (s.powderPlusHits !== 0 || s.powderBankHits !== 0) {
        findings.push({
          type: 'powder_not_reset_on_new_ball',
          frame: s.frame,
          powderPlusHits: s.powderPlusHits,
          powderBankHits: s.powderBankHits,
        });
      }
    }
    if (sawGameOver && !s.gameOver && s.balls === 3 && s.score !== 0) {
      findings.push({
        type: 'score_not_reset_on_new_game',
        frame: s.frame,
        score: s.score,
      });
      sawGameOver = false;
    }
    prevScore = s.score;
    prevBalls = s.balls;
  }
  return findings;
}

export function detectFlipperFailure(state, input) {
  const findings = [];
  setFlippersFromInput(state, { left: true, right: false, mini: false });
  const left = state.geometry.flippers.find((f) => f.side === 'left');
  const right = state.geometry.flippers.find((f) => f.side === 'right');
  if (!left?.pressed) findings.push({ type: 'flipper_not_responding', side: 'left' });
  setFlippersFromInput(state, { left: false, right: true, mini: false });
  if (!right?.pressed) findings.push({ type: 'flipper_not_responding', side: 'right' });
  if (input) setFlippersFromInput(state, input);
  return findings;
}

export function detectPlungerFailure() {
  const findings = [];
  const g1 = createGame({ seed: 1 });
  tryLaunch(g1, 0.01);
  if (g1.ballInPlay) findings.push({ type: 'plunger_tiny_pull_launched' });
  const g2 = createGame({ seed: 2 });
  tryLaunch(g2, 1);
  if (!g2.ballInPlay) findings.push({ type: 'plunger_full_pull_failed' });
  if (g2.ballsList[0].vy >= 0) findings.push({ type: 'plunger_no_upward_velocity' });
  return findings;
}

/**
 * Run a scripted playthrough hunting invariants.
 * `turbo` is informational (speed class); wall/tick budgets gate runtime.
 */
export function runPlaythroughHunt(opts = {}) {
  const turbo = opts.turbo ?? PHYSICS_TURBO;
  const maxTicks = opts.maxTicks ?? 4000;
  const sampleEvery = opts.sampleEvery ?? 20;
  const seed = opts.seed ?? 42;
  const wallDeadline = opts.wallDeadline ?? Infinity;
  const mode = opts.mode || 'physics';

  const state = createGame({ seed });
  const input = createInputState();
  const ctl = createTurbo(state, input);
  ctl.setTurbo(Math.max(1, turbo));
  ctl.setAutoPlunge(true);
  ctl.setAutoFlip(true, true, 12);

  const history = [];
  const findings = [];
  const t0 = nowMs();
  let ticks = 0;
  let gamesCompleted = 0;

  findings.push(...detectPlungerFailure());
  findings.push(...detectFlipperFailure(state, input));

  // Batch ticks per loop iteration ≈ turbo class for wall-time efficiency
  const batch = Math.max(1, Math.min(turbo, 100));

  while (ticks < maxTicks) {
    if (nowMs() - t0 > (opts.maxWallMs ?? 12_000)) break;
    if (nowMs() > wallDeadline) break;

    for (let b = 0; b < batch && ticks < maxTicks; b++) {
      ctl.applyAutos(state.frame);
      tick(state, input);
      ticks += 1;

      if (ticks % sampleEvery === 0) {
        history.push(snapshotInvariants(state));
      }
    }

    if (mode === 'physics' && history.length >= 30) {
      const stuck = detectStuckBall(history, { samples: 30 });
      if (stuck) findings.push(stuck);
      const trap = detectInfiniteTrap(history, { samples: 50 });
      if (trap) findings.push(trap);
    }

    if (state.gameOver) {
      gamesCompleted += 1;
      history.push(snapshotInvariants(state)); // capture game-over score
      const scoreBefore = state.score;
      tryLaunch(state, 0.9);
      if (mode === 'score' && state.score !== 0) {
        findings.push({
          type: 'score_not_reset_on_new_game',
          frame: state.frame,
          score: state.score,
          scoreBefore,
        });
      }
      history.push(snapshotInvariants(state));
      if (gamesCompleted >= (opts.maxGames || 3)) break;
    }
  }

  if (mode === 'score' || opts.alwaysScoreCheck) {
    findings.push(...detectScoreSanity(history));
  }

  const deduped = dedupeFindings(findings);
  return {
    findings: deduped,
    samples: history.length,
    ticks,
    wallMs: nowMs() - t0,
    turbo,
    mode,
    gamesCompleted,
    ok: deduped.length === 0,
  };
}

/**
 * Two-pass standard suite: physics @100× then score @15×.
 * Total wall ≤ HUNT_WALL_BUDGET_MS (~28s).
 */
export function runStandardHuntSuite(opts = {}) {
  const budget = opts.budgetMs ?? HUNT_WALL_BUDGET_MS;
  const t0 = nowMs();
  const deadline = t0 + budget;

  const physics = runPlaythroughHunt({
    mode: 'physics',
    turbo: opts.physicsTurbo ?? PHYSICS_TURBO,
    maxTicks: opts.physicsMaxTicks ?? 10_000,
    sampleEvery: opts.physicsSampleEvery ?? 40,
    maxWallMs: Math.min(14_000, budget * 0.55),
    wallDeadline: deadline,
    maxGames: 5,
    seed: opts.seed ?? 42,
  });

  const remaining = Math.max(1000, deadline - nowMs());
  const score = runPlaythroughHunt({
    mode: 'score',
    turbo: opts.scoreTurbo ?? SCORE_TURBO,
    maxTicks: opts.scoreMaxTicks ?? 6_000,
    sampleEvery: opts.scoreSampleEvery ?? 15,
    maxWallMs: Math.min(12_000, remaining),
    wallDeadline: deadline,
    maxGames: 4,
    seed: (opts.seed ?? 42) + 7,
    alwaysScoreCheck: true,
  });

  const wallMs = nowMs() - t0;
  const findings = [...physics.findings, ...score.findings];
  return {
    physics,
    score,
    wallMs,
    budgetMs: budget,
    findings,
    ok: findings.length === 0,
    withinBudget: wallMs <= budget + 2000,
  };
}

function dedupeFindings(list) {
  const seen = new Set();
  const out = [];
  for (const f of list) {
    const softKey =
      f.type === 'stuck_ball' ||
      f.type === 'infinite_loop_trap' ||
      f.type.startsWith('plunger_') ||
      f.type.startsWith('flipper_')
        ? `${f.type}|${f.side || ''}`
        : `${f.type}|${f.side || ''}|${f.ballIndex ?? ''}|${Math.floor((f.frame || 0) / 100)}`;
    if (seen.has(softKey)) continue;
    seen.add(softKey);
    out.push(f);
  }
  return out;
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();
}

export function scriptedPlaythrough(state, input, opts = {}) {
  const ctl = createTurbo(state, input);
  ctl.setTurbo(opts.turbo ?? 1);
  ctl.setAutoPlunge(opts.autoPlunge !== false);
  ctl.setAutoFlip(opts.autoFlipL !== false, opts.autoFlipR !== false, opts.period ?? 14);
  if (opts.script) ctl.setScript(opts.script);
  const ticks = opts.ticks ?? 500;
  for (let i = 0; i < ticks; i++) {
    ctl.applyAutos(state.frame);
    tick(state, input);
  }
  return getHud(state);
}
