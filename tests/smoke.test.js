import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('stars page smoke', () => {
  it('index.html loads and includes GA4 measurement id', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toContain('G-3Z1GXBW9W2');
    expect(html).toContain('gtag');
    expect(html).toContain('id="stars"');
    expect(html).toContain('?v=stars-v1');
    expect(html).not.toContain('matter');
    expect(html).not.toContain('__SNIPERD__');
    expect(html).not.toContain('id="game"');
  });

  it('web.config keeps DisableCache', () => {
    const cfg = readFileSync(join(root, 'web.config'), 'utf8');
    expect(cfg).toContain('DisableCache');
  });

  it('no Matter.js vendor or game modules remain', () => {
    expect(existsSync(join(root, 'assets/vendor/matter.min.js'))).toBe(false);
    expect(existsSync(join(root, 'src/game'))).toBe(false);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.['matter-js']).toBeUndefined();
  });

  it('main starfield module exists and has no game hooks', () => {
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    expect(main).toMatch(/requestAnimationFrame/);
    expect(main).not.toContain('__SNIPERD__');
    expect(main).not.toContain('matter');
    expect(main).not.toContain('flipper');
  });
});
