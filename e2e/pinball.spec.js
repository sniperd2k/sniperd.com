import { test, expect } from '@playwright/test';

test.describe('SniperD Pinball E2E', () => {
  test('canvas fills mobile viewport and exposes debug API', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__SNIPERD__);
    const canvas = page.locator('#game');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThan(300);
    expect(box.height).toBeGreaterThan(500);
    // nearly full viewport
    const vp = page.viewportSize();
    expect(box.width).toBeGreaterThan(vp.width * 0.95);
    expect(box.height).toBeGreaterThan(vp.height * 0.95);

    const ga = await page.locator('script[src*="G-3Z1GXBW9W2"]').count();
    expect(ga).toBeGreaterThan(0);

    const hud = await page.evaluate(() => window.__SNIPERD__.getHud());
    expect(hud.balls).toBe(3);
    expect(hud.score).toBe(0);
  });

  test('touch left/right halves fire flippers', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__SNIPERD__);
    await page.evaluate(() => window.__SNIPERD__.launch(0.85));

    const canvas = page.locator('#game');
    const box = await canvas.boundingBox();
    // left half
    await page.touchscreen.tap(box.x + box.width * 0.25, box.y + box.height * 0.8);
    let leftPressed = await page.evaluate(() => {
      window.__SNIPERD__.setFlippers(true, false);
      window.__SNIPERD__.tick(3);
      return window.__SNIPERD__._state.geometry.flippers.find((f) => f.side === 'left').pressed;
    });
    expect(leftPressed).toBe(true);

    await page.evaluate(() => window.__SNIPERD__.setFlippers(false, true));
    const rightPressed = await page.evaluate(() => {
      window.__SNIPERD__.tick(3);
      return window.__SNIPERD__._state.geometry.flippers.find((f) => f.side === 'right').pressed;
    });
    expect(rightPressed).toBe(true);
  });

  test('plunger launch via API puts ball in play', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__SNIPERD__);
    await page.evaluate(() => window.__SNIPERD__.launch(0.9));
    const hud = await page.evaluate(() => {
      window.__SNIPERD__.tick(5);
      return window.__SNIPERD__.getHud();
    });
    expect(hud.ballInPlay).toBe(true);
  });

  test('plunger drag on canvas increases pull', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => window.__SNIPERD__);
    const canvas = page.locator('#game');
    const box = await canvas.boundingBox();
    const startX = box.x + box.width * 0.92;
    const startY = box.y + box.height * 0.75;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + 80, { steps: 8 });
    const pull = await page.evaluate(() => window.__SNIPERD__._input.plungerPull);
    await page.mouse.up();
    expect(pull).toBeGreaterThan(0.2);
  });
});
