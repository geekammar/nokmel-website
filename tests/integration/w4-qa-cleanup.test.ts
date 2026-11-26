import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { applyMigrations, emptyDatabase, getDisposablePostgres } from './helpers';

/**
 * Operator-only W4 QA cleanup regression (disposable loopback PostgreSQL only).
 * Proves exact-ID/marker validation, transaction abort behavior, dry-run safety
 * and that unrelated records are never touched.
 */

const pg = await getDisposablePostgres();
const repoRoot = path.resolve(__dirname, '../..');
const script = path.join(repoRoot, 'scripts/cleanup-w4-qa-requests.ts');

function runCleanup(args: string[]): ReturnType<typeof spawnSync> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.DATABASE_URL;
  delete env.JOIN_INTAKE_ENABLED;
  env.DATABASE_URL_DIRECT = pg.url;
  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  return spawnSync(command, ['exec', 'tsx', script, ...args], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    timeout: 30_000,
  });
}

async function insertRequest(id: string, name: string): Promise<void> {
  await pg.pool.query(
    `insert into join_requests (id, name, phone, source, status, submission_token)
     values ($1, $2, $3, 'direct', 'new', $4)`,
    [id, name, '+201000000000', `token-${id}`],
  );
}

async function remainingIds(): Promise<string[]> {
  const result = await pg.pool.query('select id from join_requests order by id');
  return result.rows.map((row) => row.id);
}

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
});

afterAll(async () => {
  await pg.stop();
});

describe('W4 QA request cleanup operator procedure', () => {
  test('dry-run reports the exact count and confirmation deletes only marked IDs', async () => {
    await insertRequest('qa-request-a', 'QA-W4- synthetic alpha');
    await insertRequest('qa-request-b', 'QA-W4- synthetic beta');
    await insertRequest('real-request', 'Real Merchant');

    const dryRun = runCleanup([
      '--marker',
      'QA-W4-',
      '--request-id',
      'qa-request-a',
      '--request-id',
      'qa-request-b',
    ]);
    expect(dryRun.status).toBe(0);
    expect(dryRun.stdout).toContain('"matched":2');
    expect(dryRun.stdout).toContain('Dry run only');
    expect(await remainingIds()).toEqual(['qa-request-a', 'qa-request-b', 'real-request']);

    const confirmed = runCleanup([
      '--marker',
      'QA-W4-',
      '--request-id',
      'qa-request-a',
      '--request-id',
      'qa-request-b',
      '--confirm',
    ]);
    expect(confirmed.status).toBe(0);
    expect(confirmed.stdout).toContain('Deleted 2');
    expect(await remainingIds()).toEqual(['real-request']);
  });

  test('aborts without deleting when a marker does not match', async () => {
    await insertRequest('qa-request-c', 'Not a QA marker');
    await insertRequest('real-request-2', 'Real Merchant');

    const result = runCleanup([
      '--marker',
      'QA-W4-',
      '--request-id',
      'qa-request-c',
      '--confirm',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('synthetic test marker');
    expect(await remainingIds()).toEqual(['qa-request-c', 'real-request-2']);
  });

  test('aborts the whole transaction when any requested ID is missing', async () => {
    await insertRequest('qa-request-d', 'QA-W4- synthetic delta');

    const result = runCleanup([
      '--marker',
      'QA-W4-',
      '--request-id',
      'qa-request-d',
      '--request-id',
      'missing-request-id',
      '--confirm',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('do not exist');
    expect(await remainingIds()).toEqual(['qa-request-d']);
  });

  test('refuses requests without exact IDs or without a marker', async () => {
    await insertRequest('qa-request-e', 'QA-W4- synthetic epsilon');

    const noIds = runCleanup(['--marker', 'QA-W4-', '--confirm']);
    expect(noIds.status).toBe(1);
    expect(noIds.stderr).toContain('request-id');

    const noMarker = runCleanup(['--request-id', 'qa-request-e', '--confirm']);
    expect(noMarker.status).toBe(1);
    expect(noMarker.stderr).toContain('marker');
    expect(await remainingIds()).toEqual(['qa-request-e']);
  });

  test('does not modify plans or unrelated auth/public data', async () => {
    await insertRequest('qa-request-f', 'QA-W4- synthetic zeta');
    await pg.pool.query(
      `insert into plans (id, slug, draft_name, draft_description, draft_currency, draft_cta_label, draft_revision)
       values ('qa-plan', 'qa-plan', 'QA Plan', 'synthetic', 'EGP', 'اطلب الانضمام', 1)`,
    );
    await pg.pool.query(
      `insert into "user" (id, name, email, email_verified)
       values ('qa-user', 'Synthetic QA', 'qa-user@example.test', true)`,
    );

    const result = runCleanup([
      '--marker',
      'QA-W4-',
      '--request-id',
      'qa-request-f',
      '--confirm',
    ]);
    expect(result.status).toBe(0);
    const plan = await pg.pool.query("select count(*)::int as count from plans where id = 'qa-plan'");
    const user = await pg.pool.query("select count(*)::int as count from \"user\" where id = 'qa-user'");
    expect(plan.rows[0].count).toBe(1);
    expect(user.rows[0].count).toBe(1);
    expect(await remainingIds()).toEqual([]);
  });
});
