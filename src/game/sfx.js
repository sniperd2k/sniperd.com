/**
 * Web Audio synth SFX — original SniperD Arcade Neon banks (no sampled assets).
 * Unlock on first user gesture. Mute/gate for headless tests.
 */

const PRESETS = {
  flipper: { type: 'square', freq: 210, freqEnd: 95, dur: 0.055, gain: 0.11 },
  bumper: { type: 'triangle', freq: 480, freqEnd: 160, dur: 0.08, gain: 0.13 },
  ramp: { type: 'sawtooth', freq: 240, freqEnd: 560, dur: 0.16, gain: 0.07 },
  plunger: { type: 'square', freq: 100, freqEnd: 45, dur: 0.11, gain: 0.15 },
  saucer: { type: 'sine', freq: 280, freqEnd: 140, dur: 0.2, gain: 0.13 },
  // Kept for API / hunt / older cues — Arcade Neon synth tones
  treeWell: { type: 'sine', freq: 280, freqEnd: 140, dur: 0.2, gain: 0.13 },
  multiball: { type: 'square', freq: 300, freqEnd: 600, dur: 0.28, gain: 0.1 },
  scoring: { type: 'sine', freq: 720, freqEnd: 960, dur: 0.09, gain: 0.08 },
  spark: { type: 'noise', freq: 0, freqEnd: 0, dur: 0.12, gain: 0.03 },
  snow: { type: 'noise', freq: 0, freqEnd: 0, dur: 0.12, gain: 0.03 },
  hum: { type: 'noise', freq: 0, freqEnd: 0, dur: 0.9, gain: 0.015 },
  wind: { type: 'noise', freq: 0, freqEnd: 0, dur: 0.9, gain: 0.015 },
};

export function createSfx(opts = {}) {
  const state = {
    muted: opts.muted === true || opts.gate === true || typeof window === 'undefined',
    unlocked: false,
    ctx: null,
    master: null,
    windNode: null,
    lastPlay: Object.create(null),
    playLog: [],
    maxLog: opts.maxLog || 64,
  };

  function ensureCtx() {
    if (state.ctx) return state.ctx;
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    state.ctx = new AC();
    state.master = state.ctx.createGain();
    state.master.gain.value = state.muted ? 0 : 0.7;
    state.master.connect(state.ctx.destination);
    return state.ctx;
  }

  function unlock() {
    const ctx = ensureCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    state.unlocked = true;
    startHum();
    return true;
  }

  function setMuted(m) {
    state.muted = !!m;
    if (state.master) state.master.gain.value = state.muted ? 0 : 0.7;
    if (state.muted) stopHum();
    else if (state.unlocked) startHum();
  }

  function isMuted() {
    return state.muted;
  }

  function isUnlocked() {
    return state.unlocked;
  }

  function logPlay(name) {
    state.playLog.push({ name, t: Date.now() });
    if (state.playLog.length > state.maxLog) state.playLog.shift();
  }

  function cooldownOk(name, ms = 30) {
    const now = Date.now();
    const last = state.lastPlay[name] || 0;
    if (now - last < ms) return false;
    state.lastPlay[name] = now;
    return true;
  }

  function makeNoiseBuffer(ctx, seconds = 0.3) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function playTone(name) {
    logPlay(name);
    if (state.muted) return false;
    const ctx = ensureCtx();
    if (!ctx || !state.unlocked) return false;
    const preset = PRESETS[name];
    if (!preset) return false;
    const coolMs =
      name === 'bumper' ? 40 : name === 'spark' || name === 'snow' ? 100 : 25;
    if (!cooldownOk(name, coolMs)) return false;

    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(preset.gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + preset.dur);
    g.connect(state.master);

    if (preset.type === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, preset.dur + 0.05);
      const filter = ctx.createBiquadFilter();
      filter.type = name === 'hum' || name === 'wind' ? 'lowpass' : 'highpass';
      filter.frequency.value = name === 'hum' || name === 'wind' ? 280 : 3200;
      src.connect(filter);
      filter.connect(g);
      src.start(now);
      src.stop(now + preset.dur + 0.02);
    } else {
      const osc = ctx.createOscillator();
      osc.type = preset.type;
      osc.frequency.setValueAtTime(preset.freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, preset.freqEnd), now + preset.dur);
      osc.connect(g);
      osc.start(now);
      osc.stop(now + preset.dur + 0.02);
    }
    return true;
  }

  function startHum() {
    if (state.muted || state.windNode || !state.ctx || !state.unlocked) return;
    const ctx = state.ctx;
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, 2);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 220;
    filter.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.014;
    src.connect(filter);
    filter.connect(g);
    g.connect(state.master);
    src.start();
    state.windNode = { src, g, filter };
  }

  function stopHum() {
    if (!state.windNode) return;
    try {
      state.windNode.src.stop();
    } catch (_) {
      /* already stopped */
    }
    state.windNode = null;
  }

  /** Map game events → SFX names */
  function onEvents(events = [], extras = {}) {
    for (const ev of events) {
      if (ev.type === 'flipper') play('flipper');
      else if (ev.type === 'bumper') play('bumper');
      else if (ev.type === 'sling') play('bumper');
      else if (ev.type === 'ramp_contact') play('ramp');
      else if (ev.type === 'trigger') {
        if (ev.id === 'saucer' || ev.id === 'tree_well') play('saucer');
        else if (
          ev.id === 'ramp_exit' ||
          ev.id === 'loop_exit' ||
          ev.id === 'skill_shot' ||
          ev.id === 'powder_plus_exit' ||
          ev.id === 'pipe_exit' ||
          ev.id === 'chairlift_scoop'
        )
          play('ramp');
      }
    }
    if (extras.launch) play('plunger');
    if (extras.score) play('scoring');
    if (extras.multiball) play('multiball');
    if (extras.snow || extras.spark) play('spark');
  }

  function play(name) {
    return playTone(name);
  }

  function getLog() {
    return state.playLog.slice();
  }

  function clearLog() {
    state.playLog.length = 0;
  }

  /** Bind unlock to first gesture on target (canvas/window). */
  function bindUnlock(target) {
    if (typeof window === 'undefined' || !target) return () => {};
    const once = () => {
      unlock();
      target.removeEventListener('pointerdown', once);
      target.removeEventListener('touchstart', once);
      target.removeEventListener('keydown', once);
    };
    target.addEventListener('pointerdown', once, { passive: true });
    target.addEventListener('touchstart', once, { passive: true });
    window.addEventListener('keydown', once, { passive: true });
    return () => {
      target.removeEventListener('pointerdown', once);
      target.removeEventListener('touchstart', once);
      window.removeEventListener('keydown', once);
    };
  }

  return {
    unlock,
    setMuted,
    isMuted,
    isUnlocked,
    play,
    onEvents,
    bindUnlock,
    getLog,
    clearLog,
    presets: Object.keys(PRESETS),
  };
}

export { PRESETS };
