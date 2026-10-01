import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('hackers homage smoke', () => {
  it('index.html loads grid HUD with GA4 and no query-string cache bust', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toContain('G-3Z1GXBW9W2');
    expect(html).toContain('gtag');
    expect(html).toContain('id="grid"');
    expect(html).toContain('id="hud"');
    expect(html).toContain('id="boot"');
    expect(html).toContain('href="src/styles.css"');
    expect(html).toContain('src="src/main.js"');
    expect(html).not.toMatch(/styles\.css\?/);
    expect(html).not.toMatch(/main\.js\?/);
    expect(html).not.toContain('?v=stars-v1');
    expect(html).not.toContain('matter');
    expect(html).not.toContain('__SNIPERD__');
    expect(html).not.toContain('id="game"');
    expect(html).not.toContain('id="stars"');
  });

  it('web.config defaultDocument is index.html and DisableCache stays on', () => {
    const cfg = readFileSync(join(root, 'web.config'), 'utf8');
    expect(cfg).toContain('DisableCache');
    expect(cfg).toContain('<defaultDocument>');
    expect(cfg).toContain('<add value="index.html" />');
  });

  it('no Matter.js / pinball / playfield / game paths remain in tree', () => {
    expect(existsSync(join(root, 'assets/vendor/matter.min.js'))).toBe(false);
    expect(existsSync(join(root, 'assets'))).toBe(false);
    expect(existsSync(join(root, 'src/game'))).toBe(false);
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.['matter-js']).toBeUndefined();
    expect(pkg.devDependencies?.['matter-js']).toBeUndefined();

    const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' });
    const banned = /matter|pinball|playfield|__SNIPERD__|arcade|cadet|pixel.?brick|src\/game/i;
    const hits = tracked.split('\n').filter((f) => f && banned.test(f));
    expect(hits).toEqual([]);
  });

  it('main module is cyber homage with rAF and no game hooks', () => {
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    expect(main).toMatch(/requestAnimationFrame/);
    expect(main).toMatch(/drawTowers|spawnTowers/);
    expect(main).toMatch(/BOOT_LINES|boot/);
    expect(main).not.toContain('__SNIPERD__');
    expect(main).not.toContain('matter');
    expect(main).not.toContain('flipper');
    expect(main).not.toContain('playfield');
  });

  it('styles include CRT/scanline cyber vibe', () => {
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
    expect(css).toMatch(/scanlines/);
    expect(css).toMatch(/#7ef9ff|--cyan/);
    expect(css).toMatch(/#ff4fd8|--magenta/);
    expect(css).toMatch(/#crt|vignette/);
  });

  it('homage copy avoids trademarked logo-mark phrase as branding asset', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const main = readFileSync(join(root, 'src/main.js'), 'utf8');
    const css = readFileSync(join(root, 'src/styles.css'), 'utf8');
    const blob = html + main + css;
    // Allow homage vibe; block using the exact film catchphrase as a logo/mark string
    expect(blob).not.toMatch(/Hack the Planet/i);
  });
});
