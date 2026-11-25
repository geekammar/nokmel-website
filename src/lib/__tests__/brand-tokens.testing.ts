import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Test-tooling-only token inspection. Filesystem access is safe in tests and
 * build tooling; the deployed application runtime never reads source files
 * (enforced by the runtime-safety regression in `viewport-theme.test.ts`).
 */
export type TokenMap = Record<string, string>;

export function parseBlock(css: string, selector: string): TokenMap {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) return {};
  const map: TokenMap = {};
  for (const decl of match[1].split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const name = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (name.startsWith('--')) map[name] = value;
  }
  return map;
}

export function readTokens(): { light: TokenMap; dark: TokenMap } {
  const css = readFileSync(path.join(process.cwd(), 'src/styles/brand-tokens.css'), 'utf8');
  return {
    light: parseBlock(css, ':root'),
    dark: parseBlock(css, '[data-theme="dark"]'),
  };
}
