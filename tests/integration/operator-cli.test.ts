import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  applyMigrations,
  emptyDatabase,
  getDisposablePostgres,
} from './helpers';

/**
 * Operator CLI regression coverage (stdin automation only — no interactive TTY
 * in CI). Verifies that provisioning requires DATABASE_URL_DIRECT, refuses
 * pooled/unsafe targets before connecting, and never prints the password.
 */

const pg = await getDisposablePostgres();
const repoRoot = path.resolve(__dirname, '../..');
const script = path.join(repoRoot, 'scripts/provision-owner.ts');
const cliOwnerEmail = 'cli-owner@w31-integration.test';
const cliOwnerPassword = 'cli-owner-password-123';

function runCli(
  env: NodeJS.ProcessEnv,
  args: string[],
  input: string,
): ReturnType<typeof spawnSync> {
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return spawnSync(command, ['exec', 'tsx', script, ...args], {
    cwd: repoRoot,
    env,
    input,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL_DIRECT;
  delete env.DATABASE_URL;
  return { ...env, ...overrides };
}

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

describe('operator provisioning CLI', () => {
  test('requires DATABASE_URL_DIRECT and never falls back to DATABASE_URL', () => {
    const env = baseEnv({
      DATABASE_URL: pg.url,
      OWNER_EMAIL: cliOwnerEmail,
    });
    const result = runCli(env, ['--yes'], `${cliOwnerPassword}\n`);
    expect(result.status).toBe(1);
    expect(String(result.stderr)).toContain('DATABASE_URL_DIRECT is required');
    expect(String(result.stdout)).not.toContain(cliOwnerPassword);
  });

  test('rejects pooled endpoints before connecting', () => {
    const env = baseEnv({
      DATABASE_URL_DIRECT:
        'postgresql://migrate:secret@ep-example-pooler.eu-central-1.aws.neon.tech/nokmel_website?sslmode=require',
      OWNER_EMAIL: cliOwnerEmail,
    });
    const result = runCli(env, ['--yes'], `${cliOwnerPassword}\n`);
    expect(result.status).toBe(1);
    expect(String(result.stderr)).toMatch(/pooled/i);
    expect(`${result.stdout}${result.stderr}`).not.toContain('secret');
  });

  test('rejects plaintext non-loopback targets before connecting', () => {
    const env = baseEnv({
      DATABASE_URL_DIRECT:
        'postgresql://migrate:secret@db.example.com:5432/nokmel_website?sslmode=disable',
      OWNER_EMAIL: cliOwnerEmail,
    });
    const result = runCli(env, ['--yes'], `${cliOwnerPassword}\n`);
    expect(result.status).toBe(1);
    expect(String(result.stderr)).toMatch(/loopback/i);
  });

  test('provisions the owner through stdin without leaking the password', async () => {
    const env = baseEnv({
      DATABASE_URL_DIRECT: pg.url,
      OWNER_EMAIL: cliOwnerEmail,
    });
    const result = runCli(env, ['--yes'], `${cliOwnerPassword}\n`);
    expect(result.status).toBe(0);
    const output = `${String(result.stdout)}${String(result.stderr)}`;
    expect(output).toContain('Owner account provisioned');
    expect(output).not.toContain(cliOwnerPassword);
    expect(output).not.toContain('nokmel_test:nokmel_test');

    const { rows } = await pg.pool.query(
      "select u.email, a.provider_id, a.password from \"user\" u join account a on a.user_id = u.id where u.email = $1",
      [cliOwnerEmail],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].provider_id).toBe('credential');
    expect(rows[0].password).not.toContain(cliOwnerPassword);
  });
});
