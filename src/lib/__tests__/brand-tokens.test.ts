import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readTokens } from './brand-tokens.testing';

const repoRoot = process.cwd();

describe('brand tokens traceability (Brand Kit v2.0, canonical 04_DESIGN_TOKENS/nokmel.css)', () => {
  const { light, dark } = readTokens();

  it('matches the approved core token values in light mode', () => {
    expect(light).toMatchObject({
      '--brand-primary': '#192B50',
      '--action-secondary': '#526CB5',
      '--brand-highlight': '#A9BCE5',
      '--color-background': '#F5F7FB',
      '--color-surface': '#FFFFFF',
      '--color-text-primary': '#1C2940',
      '--color-text-secondary': '#606D80',
      '--color-border-subtle': '#DCE3EE',
      '--color-border-input': '#9CAEC9',
      '--color-focus-ring': '#526CB5',
      '--action-primary-bg': '#192B50',
      '--action-primary-fg': '#FFFFFF',
      '--corner-card': '16px',
      '--corner-control': '12px',
      '--control-min-height': '44px',
    });
  });

  it('matches the approved dark token values', () => {
    expect(dark).toMatchObject({
      '--color-background': '#111B2D',
      '--color-surface': '#202D44',
      '--color-text-primary': '#F1F4FB',
      '--color-text-secondary': '#B7C6DC',
      '--color-border-subtle': '#344665',
      '--color-border-input': '#7188AE',
      '--action-primary-bg': '#A9BCE5',
      '--action-primary-fg': '#192B50',
      '--color-focus-ring': '#A9BCE5',
    });
  });

  it('keeps canonical functional status colors', () => {
    expect(light).toMatchObject({
      '--color-success': '#16734C',
      '--color-warning': '#9A6200',
      '--color-error': '#B43D42',
      '--color-info': '#245DB0',
    });
  });

  it('specifies the brand UI font families', () => {
    expect(light['--font-ar']).toContain('IBM Plex Sans Arabic');
    expect(light['--font-en']).toContain('Geist');
  });

  it('does not import the parallel 04_TOKENS_AND_CODE token set', () => {
    const globals = readFileSync(path.join(repoRoot, 'src/app/globals.css'), 'utf8');
    const layout = readFileSync(path.join(repoRoot, 'src/app/layout.tsx'), 'utf8');
    for (const source of [globals, layout]) {
      expect(source).not.toContain('nokmel.tokens.css');
    }
    expect(layout).toContain('brand-tokens.css');
  });

  it('ships the committed brand assets referenced by components', () => {
    const logos = [
      'nokmel-mark-primary-color.svg',
      'nokmel-mark-dark-surface.svg',
      'nokmel-mark-light-surface.svg',
      'nokmel-mark-single-navy.svg',
      'nokmel-mark-single-white.svg',
      'nokmel-mark-transparent-512.png',
      'nokmel-mark-transparent-1024.png',
    ];
    for (const file of logos) {
      expect(existsSync(path.join(repoRoot, 'public/brand/logos', file))).toBe(true);
    }
    const icons = [
      'favicon.ico',
      'app-icon-light.svg',
      'app-icon-dark.svg',
      'app-icon-light-180.png',
      'app-icon-light-192.png',
      'app-icon-light-512.png',
      'app-icon-dark-192.png',
      'app-icon-dark-512.png',
    ];
    for (const file of icons) {
      expect(existsSync(path.join(repoRoot, 'public/brand/icons', file))).toBe(true);
    }
  });
});
