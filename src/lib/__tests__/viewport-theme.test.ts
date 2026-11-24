import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_COLOR_LIGHT } from '@/lib/viewport-theme';

const repoRoot = process.cwd();

/**
 * Root cause of NKW-W2-001 (deployed ENOENT on /join):
 * the application dependency graph must never read source-token files at
 * runtime. `viewport-theme.ts` holds the only literal values needed outside
 * CSS (viewport theming); its correctness is pinned to the canonical CSS
 * tokens here, at test time, where filesystem access is safe.
 */
describe('build-safe viewport theme constants', () => {
  it('keeps theme colors identical to the canonical CSS token values', () => {
    const css = readFileSync(path.join(repoRoot, 'src/styles/brand-tokens.css'), 'utf8');
    const rootBlock = css.match(/:root\s*\{([^}]*)\}/);
    expect(rootBlock).toBeTruthy();
    const lightPrimary = rootBlock![1].match(/--brand-primary:\s*(#[0-9A-Fa-f]{6})/);
    expect(lightPrimary?.[1]?.toUpperCase()).toBe(THEME_COLOR_LIGHT.toUpperCase());
  });

  it('imports no build-time-only modules that read the filesystem', () => {
    const source = readFileSync(path.join(repoRoot, 'src/lib/viewport-theme.ts'), 'utf8');
    expect(source).not.toMatch(/node:fs|readFileSync|process\.cwd/);
  });

  it('no application module in the runtime dependency graph uses node:fs', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name === '__tests__' || name === 'node_modules') continue;
          walk(full);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
          const text = readFileSync(full, 'utf8');
          if (/(from|require\()\s*'node:fs'|readFileSync|readdirSync|statSync/.test(text)) {
            offenders.push(path.relative(repoRoot, full));
          }
        }
      }
    };
    walk(path.join(repoRoot, 'src'));
    expect(offenders).toEqual([]);
  });
});
