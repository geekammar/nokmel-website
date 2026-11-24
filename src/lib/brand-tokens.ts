import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS_PATH = path.resolve(process.cwd(), 'src/styles/brand-tokens.css');

export type TokenMap = Record<string, string>;

function parseBlock(css: string, selector: string): TokenMap {
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

export function readBrandTokensCss(): string {
  return readFileSync(TOKENS_PATH, 'utf8');
}

export function readTokens(): { light: TokenMap; dark: TokenMap } {
  const css = readBrandTokensCss();
  return {
    light: parseBlock(css, ':root'),
    dark: parseBlock(css, '[data-theme="dark"]'),
  };
}
