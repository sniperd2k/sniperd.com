/**
 * Mode / multiball state machines.
 */

export const ModeId = Object.freeze({
  IDLE: 'idle',
  PEAK_LIT: 'peak_lit',
  LODGE_OPEN: 'lodge_open',
  LOCKING: 'locking',
  MULTIBALL: 'multiball',
});

export function createModeState() {
  return {
    mode: ModeId.IDLE,
    peakLit: false,
    peakAwardIndex: 0,
    peakTimer: 0,
    lodgeOpen: false,
    locks: 0,
    locksNeeded: 3,
    multiball: false,
    ballsInPlay: 1,
    jackpotLit: false,
    modeProgress: 0,
    powderMultiballReady: false,
  };
}

export function lightPeakAward(state, durationFrames = 300) {
  return {
    ...state,
    mode: state.multiball ? state.mode : ModeId.PEAK_LIT,
    peakLit: true,
    peakTimer: durationFrames,
  };
}

export function tickPeakTimer(state) {
  if (!state.peakLit) return state;
  const t = state.peakTimer - 1;
  if (t <= 0) {
    return { ...state, peakLit: false, peakTimer: 0, mode: state.multiball ? ModeId.MULTIBALL : ModeId.IDLE };
  }
  return { ...state, peakTimer: t };
}

export function rotatePeakAward(state) {
  return {
    ...state,
    peakAwardIndex: (state.peakAwardIndex + 1) % 5,
  };
}

export function openLodge(state) {
  return {
    ...state,
    lodgeOpen: true,
    mode: ModeId.LODGE_OPEN,
    powderMultiballReady: true,
  };
}

export function addLock(state) {
  if (!state.lodgeOpen && !state.powderMultiballReady) return state;
  const locks = Math.min(state.locksNeeded, state.locks + 1);
  const ready = locks >= state.locksNeeded;
  return {
    ...state,
    locks,
    mode: ready ? ModeId.LOCKING : ModeId.LODGE_OPEN,
  };
}

export function startMultiball(state, ballCount = 3) {
  return {
    ...state,
    multiball: true,
    ballsInPlay: ballCount,
    locks: 0,
    jackpotLit: true,
    mode: ModeId.MULTIBALL,
    powderMultiballReady: false,
  };
}

export function endMultiball(state) {
  return {
    ...state,
    multiball: false,
    ballsInPlay: 1,
    jackpotLit: false,
    lodgeOpen: false,
    mode: ModeId.IDLE,
  };
}

export function onBallDrain(state) {
  if (!state.multiball) {
    return { ...state, ballsInPlay: Math.max(0, state.ballsInPlay - 1) };
  }
  const left = Math.max(0, state.ballsInPlay - 1);
  if (left <= 1) {
    return endMultiball({ ...state, ballsInPlay: 1 });
  }
  return { ...state, ballsInPlay: left };
}

export function bumpModeProgress(state, amount = 1) {
  return {
    ...state,
    modeProgress: (state.modeProgress | 0) + (amount | 0),
  };
}
