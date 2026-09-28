import { describe, it, expect } from 'vitest';
import { createSfx, PRESETS } from '../../src/game/sfx.js';
import { createGame, tick, tryLaunch, drainSfx, inject } from '../../src/game/game.js';

describe('SFX synth', () => {
  it('exposes expected Pixel Brick chiptune presets', () => {
    const sfx = createSfx({ muted: true });
    for (const name of [
      'flipper',
      'bumper',
      'ramp',
      'plunger',
      'saucer',
      'treeWell',
      'multiball',
      'scoring',
      'spark',
      'snow',
      'hum',
      'wind',
    ]) {
      expect(sfx.presets).toContain(name);
      expect(PRESETS[name]).toBeTruthy();
    }
  });

  it('is muted/gated by default in Node (headless)', () => {
    const sfx = createSfx();
    expect(sfx.isMuted()).toBe(true);
    expect(sfx.play('bumper')).toBe(false);
    expect(sfx.getLog().some((e) => e.name === 'bumper')).toBe(true);
  });

  it('respects setMuted gate', () => {
    const sfx = createSfx({ muted: true });
    sfx.setMuted(true);
    expect(sfx.isMuted()).toBe(true);
    sfx.play('flipper');
    expect(sfx.getLog().at(-1).name).toBe('flipper');
  });

  it('onEvents maps physics events without throwing when muted', () => {
    const sfx = createSfx({ muted: true });
    sfx.clearLog();
    sfx.onEvents(
      [
        { type: 'flipper', side: 'left' },
        { type: 'bumper', id: 'jet0' },
        { type: 'ramp_contact' },
        { type: 'trigger', id: 'saucer' },
      ],
      { launch: true, score: true, multiball: true, spark: true }
    );
    const names = sfx.getLog().map((e) => e.name);
    expect(names).toContain('flipper');
    expect(names).toContain('bumper');
    expect(names).toContain('plunger');
    expect(names).toContain('scoring');
    expect(names).toContain('multiball');
    expect(names).toContain('saucer');
  });

  it('game queues sfx cues on launch and score', () => {
    const g = createGame({ seed: 9 });
    tryLaunch(g, 1);
    const afterLaunch = drainSfx(g);
    expect(afterLaunch).toContain('plunger');
    const bumper = g.geometry.bumpers[0];
    inject(g, {
      ball: { x: bumper.x, y: bumper.y - bumper.r - 10, vx: 0, vy: 6, held: false, active: true },
    });
    for (let i = 0; i < 25; i++) tick(g);
    const cues = drainSfx(g);
    expect(cues.length).toBeGreaterThan(0);
    expect(cues.some((c) => c === 'scoring' || c === 'spark' || c === 'bumper')).toBe(true);
  });
});
