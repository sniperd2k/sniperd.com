import { test, expect } from '@playwright/test';

test.describe('SniperD stars page', () => {
  test('page loads fullscreen canvas and GA4 is present', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#stars');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const vp = page.viewportSize();
    expect(box.width).toBeGreaterThan(vp.width * 0.95);
    expect(box.height).toBeGreaterThan(vp.height * 0.95);

    const ga = await page.locator('script[src*="G-3Z1GXBW9W2"]').count();
    expect(ga).toBeGreaterThan(0);

    // No game UI / chrome
    await expect(page.locator('#game')).toHaveCount(0);
    const hasSniperHook = await page.evaluate(() => typeof window.__SNIPERD__ !== 'undefined');
    expect(hasSniperHook).toBe(false);

    // Canvas paints something (not blank black forever)
    await page.waitForTimeout(200);
    const painted = await page.evaluate(() => {
      const c = document.getElementById('stars');
      const ctx = c.getContext('2d');
      const { width, height } = c;
      const sample = ctx.getImageData(
        Math.floor(width / 2),
        Math.floor(height / 2),
        1,
        1
      ).data;
      // Background is deep navy, not pure black — any channel > 0 is fine
      return sample[0] + sample[1] + sample[2] > 0 || sample[3] > 0;
    });
    expect(painted).toBe(true);
  });
});
