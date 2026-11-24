import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG } from '@/lib/contrast';
import { readTokens } from './brand-tokens.testing';

const { light, dark } = readTokens();

function hex(name: string, theme: 'light' | 'dark' = 'light'): string {
  const value = (theme === 'dark' ? dark[name] : light[name]) ?? light[name];
  const match = value.match(/#[0-9A-Fa-f]{6}/);
  if (!match) throw new Error(`token ${name} has no hex value: ${value}`);
  return match[0];
}

describe('WCAG contrast of brand token pairs used by the UI', () => {
  it('primary text on page background and surface passes AA (>= 4.5:1)', () => {
    const text = hex('--color-text-primary');
    expect(contrastRatio(text, hex('--color-background'))).toBeGreaterThanOrEqual(WCAG.textAA);
    expect(contrastRatio(text, hex('--color-surface'))).toBeGreaterThanOrEqual(WCAG.textAA);
  });

  it('secondary text passes AA on light surfaces', () => {
    const muted = hex('--color-text-secondary');
    expect(contrastRatio(muted, hex('--color-background'))).toBeGreaterThanOrEqual(WCAG.textAA);
    expect(contrastRatio(muted, hex('--color-surface'))).toBeGreaterThanOrEqual(WCAG.textAA);
  });

  it('secondary interaction (link) color passes AA as text on light surfaces', () => {
    const link = hex('--action-secondary');
    expect(contrastRatio(link, hex('--color-background'))).toBeGreaterThanOrEqual(WCAG.textAA);
    expect(contrastRatio(link, hex('--color-surface'))).toBeGreaterThanOrEqual(WCAG.textAA);
  });

  it('primary CTA contrast passes AA in both themes', () => {
    expect(
      contrastRatio(hex('--action-primary-fg'), hex('--action-primary-bg')),
    ).toBeGreaterThanOrEqual(WCAG.textAA);
    expect(
      contrastRatio(hex('--action-primary-fg', 'dark'), hex('--action-primary-bg', 'dark')),
    ).toBeGreaterThanOrEqual(WCAG.textAA);
  });

  it('focus ring is visible against page background and dark background (>= 3:1)', () => {
    expect(contrastRatio(hex('--color-focus-ring'), hex('--color-background'))).toBeGreaterThanOrEqual(
      WCAG.uiComponent,
    );
    expect(
      contrastRatio(hex('--color-focus-ring', 'dark'), hex('--color-background', 'dark')),
    ).toBeGreaterThanOrEqual(WCAG.uiComponent);
  });

  it('dark theme text on dark surfaces passes AA', () => {
    expect(
      contrastRatio(hex('--color-text-primary', 'dark'), hex('--color-background', 'dark')),
    ).toBeGreaterThanOrEqual(WCAG.textAA);
    expect(
      contrastRatio(hex('--color-text-secondary', 'dark'), hex('--color-surface', 'dark')),
    ).toBeGreaterThanOrEqual(WCAG.textAA);
  });

  it('documents the input-boundary accessibility adjustment', () => {
    const canonicalInputBorder = hex('--color-border-input');
    const surface = hex('--color-surface');
    expect(contrastRatio(canonicalInputBorder, surface)).toBeLessThan(WCAG.uiComponent);
    const adjusted = hex('--color-text-secondary');
    expect(contrastRatio(adjusted, surface)).toBeGreaterThanOrEqual(WCAG.uiComponent);
    const darkInputBorder = hex('--color-border-input', 'dark');
    const darkSurface = hex('--color-surface', 'dark');
    expect(contrastRatio(darkInputBorder, darkSurface)).toBeGreaterThanOrEqual(WCAG.uiComponent);
  });

  it('functional status colors pass AA as text on white', () => {
    for (const name of ['--color-success', '--color-warning', '--color-error', '--color-info']) {
      expect(contrastRatio(hex(name), '#FFFFFF')).toBeGreaterThanOrEqual(WCAG.textAA);
    }
  });
});
