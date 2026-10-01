import { test, expect } from '@playwright/test';

test.describe('SniperD cyber homage', () => {
  test('page boots to HUD with GA4 and grid canvas', async ({ page }) => {
    await page.goto('/');

    // Skip boot quickly for the gate
    const skip = page.locator('#skip-boot');
    await expect(skip).toBeVisible();
    await skip.click();

    const canvas = page.locator('#grid');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const vp = page.viewportSize();
    expect(box.width).toBeGreaterThan(vp.width * 0.95);
    expect(box.height).toBeGreaterThan(vp.height * 0.95);

    const ga = await page.locator('script[src*="G-3Z1GXBW9W2"]').count();
    expect(ga).toBeGreaterThan(0);

    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('#game')).toHaveCount(0);
    const hasSniperHook = await page.evaluate(() => typeof window.__SNIPERD__ !== 'undefined');
    expect(hasSniperHook).toBe(false);

    const assetUrls = await page.evaluate(() => {
      const hrefs = [...document.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.getAttribute('href'));
      const scripts = [...document.querySelectorAll('script[src]')].map((el) => el.getAttribute('src'));
      return [...hrefs, ...scripts].filter((u) => u && !u.startsWith('http'));
    });
    expect(assetUrls.length).toBeGreaterThan(0);
    for (const u of assetUrls) {
      expect(u).not.toMatch(/\?v=/);
    }

    // Toys present
    await expect(page.locator('#toy-pulse')).toBeVisible();
    await expect(page.locator('#toy-jack')).toBeVisible();

    // Canvas paints (not blank)
    await page.waitForTimeout(250);
    const painted = await page.evaluate(() => {
      const c = document.getElementById('grid');
      const ctx = c.getContext('2d');
      const { width, height } = c;
      const sample = ctx.getImageData(
        Math.floor(width / 2),
        Math.floor(height / 2),
        1,
        1
      ).data;
      return sample[0] + sample[1] + sample[2] > 0 || sample[3] > 0;
    });
    expect(painted).toBe(true);

    // Terminal accepts a command
    await page.locator('#term-input').fill('help');
    await page.locator('#term-form').evaluate((form) => form.requestSubmit());
    await expect(page.locator('#term')).toContainText('commands');
  });
});
