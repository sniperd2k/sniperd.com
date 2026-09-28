import { test, expect } from '@playwright/test';

test.describe('SniperD turbo + SFX API', () => {
  test('__SNIPERD__ exposes setTurbo / autoPlunge / autoFlip / sfx', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__SNIPERD__);
    const api = await page.evaluate(() => {
      const S = window.__SNIPERD__;
      const turboBefore = S.getTurbo();
      S.setTurbo(100);
      const turboAfter = S.getTurbo();
      S.setTurbo(1);
      S.autoPlunge(true);
      S.autoFlip(true, true, 10);
      S.sfx.mute(true);
      S.sfx.play('bumper');
      return {
        turboBefore,
        turboAfter,
        muted: S.sfx.isMuted(),
        presets: S.sfx.presets,
        hasRunHunt: typeof S.runHunt === 'function',
        hasScripted: typeof S.scriptedPlaythrough === 'function',
        version: S.version,
      };
    });
    expect(api.turboBefore).toBe(1);
    expect(api.turboAfter).toBe(100);
    expect(api.muted).toBe(true);
    expect(api.presets).toContain('flipper');
    expect(api.presets).toContain('plunger');
    expect(api.hasRunHunt).toBe(true);
    expect(api.hasScripted).toBe(true);
    expect(api.version).toMatch(/^1\./);
  });

  test('GA4 gtag still present', async ({ page }) => {
    await page.goto('/');
    const ga = await page.locator('script[src*="G-3Z1GXBW9W2"]').count();
    expect(ga).toBeGreaterThan(0);
  });
});
