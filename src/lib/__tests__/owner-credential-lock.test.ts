import { describe, expect, test, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  handleOwnerAuthRequest,
  isCredentialSignInRequest,
  withOwnerCredentialLock,
} from '@/lib/owner-credential-lock';

function signInRequest(): Request {
  return new Request('https://nokmel.tech/api/auth/sign-in/email', { method: 'POST' });
}

function fakePool(options: { failCommit?: boolean } = {}) {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: vi.fn(async (text: string, values?: unknown[]) => {
      queries.push({ text, values });
      if (text === 'commit' && options.failCommit) {
        throw new Error('commit failed');
      }
      return { rows: [{}] };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  return { pool, client, queries };
}

describe('owner credential sign-in lock', () => {
  test('recognizes only POST credential sign-in requests', () => {
    expect(isCredentialSignInRequest(signInRequest())).toBe(true);
    expect(
      isCredentialSignInRequest(
        new Request('https://nokmel.tech/api/auth/sign-in/email', { method: 'GET' }),
      ),
    ).toBe(false);
    expect(
      isCredentialSignInRequest(
        new Request('https://nokmel.tech/api/auth/get-session', { method: 'POST' }),
      ),
    ).toBe(false);
  });

  test('non-sign-in requests bypass the lock pool', async () => {
    const { pool } = fakePool();
    const handler = vi.fn(async () => new Response('ok', { status: 200 }));
    const response = await handleOwnerAuthRequest(
      new Request('https://nokmel.tech/api/auth/get-session', { method: 'GET' }),
      { handler },
      pool,
    );
    expect(response.status).toBe(200);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test('credential sign-in holds a transaction-scoped lock around the handler', async () => {
    const { pool, client, queries } = fakePool();
    const handler = vi.fn(async () => new Response('ok', { status: 200 }));
    const response = await handleOwnerAuthRequest(signInRequest(), { handler }, pool);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(queries[0].text).toBe('begin');
    expect(queries[1].text).toContain('set local lock_timeout');
    expect(queries[2].text).toContain('pg_advisory_xact_lock');
    expect(queries[2].values).toEqual(['nokmel.website.owner_credentials']);
    expect(queries[3].text).toContain('set local lock_timeout = 0');
    expect(queries[4].text).toBe('commit');
    expect(client.release).toHaveBeenCalledWith(false);
  });

  test('the transaction is rolled back when the handler fails', async () => {
    const { pool, client, queries } = fakePool();
    const handler = vi.fn(async () => {
      throw new Error('handler failed');
    });
    await expect(
      handleOwnerAuthRequest(signInRequest(), { handler }, pool),
    ).rejects.toThrow('handler failed');
    expect(queries.some((entry) => entry.text === 'rollback')).toBe(true);
    expect(client.release).toHaveBeenCalledWith(false);
  });

  test('a failed commit discards the lock connection', async () => {
    const { pool, client } = fakePool({ failCommit: true });
    await expect(
      withOwnerCredentialLock(async () => undefined, pool),
    ).rejects.toThrow('commit failed');
    expect(client.release).toHaveBeenCalledWith(true);
  });
});
