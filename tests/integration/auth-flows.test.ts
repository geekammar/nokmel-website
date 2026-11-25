import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import {
  applyMigrations,
  authRequest,
  createTestAuth,
  emptyDatabase,
  getDisposablePostgres,
  sessionCookieFrom,
  TEST_BAD_ORIGIN,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
  type DisposablePostgres,
} from './helpers';
import { account, session, user } from '@/lib/db/schema';
import { resetOwnerPassword } from '@/lib/admin-provisioning';
import { isOwnerEmail } from '@/lib/owner-identity';

const pg = await getDisposablePostgres() as DisposablePostgres;
const auth = createTestAuth(pg.db);

beforeAll(async () => {
  await applyMigrations(pg);
  await emptyDatabase(pg);
  await provisionOwnerFixture();
});

afterAll(async () => {
  await pg.stop();
});

async function provisionOwnerFixture(): Promise<void> {
  const userId = 'test-owner-user';
  await pg.db.insert(user).values({
    id: userId,
    name: 'Integration Owner',
    email: TEST_OWNER_EMAIL,
    emailVerified: true,
  });
  await pg.db.insert(account).values({
    id: 'test-owner-account',
    accountId: userId,
    providerId: 'credential',
    userId,
    password: await hashPassword(TEST_OWNER_PASSWORD),
  });
}

async function createUserFixture(email: string, password: string): Promise<string> {
  const userId = `user-${email.replace(/[^a-z0-9]/g, '')}`;
  await pg.db.insert(user).values({
    id: userId,
    name: 'Fixture User',
    email,
    emailVerified: true,
  });
  await pg.db.insert(account).values({
    id: `account-${userId}`,
    accountId: userId,
    providerId: 'credential',
    userId,
    password: await hashPassword(password),
  });
  return userId;
}

async function newestSessionRow(pool: typeof pg.pool): Promise<{ token: string; user_id: string }> {
  const { rows } = await pool.query(
    'select token, user_id from "session" order by created_at desc limit 1',
  );
  if (!rows[0]) throw new Error('Expected a session row after sign-in');
  return rows[0];
}

function findSessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.includes('session_token'));
  if (!cookie) throw new Error('No session cookie in response');
  return cookie;
}

describe('sign-in', () => {
  test('creates a session for correct owner credentials', async () => {
    const response = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    expect(response.status).toBe(200);
    const sessionResponse = await authRequest(auth, '/get-session', {
      method: 'GET',
      cookie: sessionCookieFrom(response),
    });
    expect(sessionResponse.status).toBe(200);
    const body = (await sessionResponse.json()) as { user: { email: string } };
    expect(body.user.email).toBe(TEST_OWNER_EMAIL);

    const { rows } = await pg.pool.query("select count(*)::int as count from \"session\"");
    expect(rows[0].count).toBeGreaterThanOrEqual(1);
  });

  test('rejects an incorrect password with a generic error', async () => {
    const response = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: 'a-very-wrong-password' },
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { message?: string };
    expect(body.message?.length ?? 0).toBeGreaterThan(0);
    expect(JSON.stringify(body)).not.toContain(TEST_OWNER_PASSWORD);
  });

  test('unknown email returns the same generic error as a wrong password', async () => {
    const response = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: 'nobody@w31-integration.test', password: 'a-very-wrong-password' },
    });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { message?: string };
    expect(body.message).toBe('Invalid email or password');
  });

  test('sets an HTTP-only session cookie (not localStorage-visible JS state)', async () => {
    const response = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    const setCookie = findSessionCookie(response);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
  });

  test('sets Secure cookies under an HTTPS deployment origin in a production runtime', async () => {
    const previousBaseURL = process.env.BETTER_AUTH_URL;
    process.env.BETTER_AUTH_URL = 'https://nokmel.example';
    try {
      const httpsAuth = createTestAuth(pg.db, {});
      const response = await httpsAuth.handler(
        new Request('https://nokmel.example/api/auth/sign-in/email', {
          method: 'POST',
          body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD }),
          headers: {
            'content-type': 'application/json',
            origin: 'https://nokmel.example',
          },
        }),
      );
      expect(response.status).toBe(200);
      const setCookie = findSessionCookie(response);
      expect(setCookie).toContain('Secure');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
    } finally {
      process.env.BETTER_AUTH_URL = previousBaseURL;
    }
  });
});

describe('public sign-up refusal', () => {
  test('sign-up is refused and no account is created', async () => {
    const response = await authRequest(auth, '/sign-up/email', {
      method: 'POST',
      body: {
        email: 'attacker@w31-integration.test',
        password: 'attacker-password-123',
        name: 'Attacker',
      },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);

    const { rows } = await pg.pool.query(
      "select count(*)::int as count from \"user\" where email = 'attacker@w31-integration.test'",
    );
    expect(rows[0].count).toBe(0);
  });
});

describe('authorization: owner-only', () => {
  test('a valid non-owner session is not an owner session', async () => {
    await createUserFixture('other-user@w31-integration.test', 'other-user-password-123');
    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: 'other-user@w31-integration.test', password: 'other-user-password-123' },
    });
    expect(signIn.status).toBe(200);

    const getResponse = await authRequest(auth, '/get-session', {
      method: 'GET',
      cookie: sessionCookieFrom(signIn),
    });
    expect(getResponse.status).toBe(200);
    const body = (await getResponse.json()) as { user: { email: string } };
    expect(body.user.email).toBe('other-user@w31-integration.test');
    expect(isOwnerEmail(body.user.email)).toBe(false);
    expect(isOwnerEmail(TEST_OWNER_EMAIL)).toBe(true);
  });

  test('anonymous requests have no owner session', async () => {
    const response = await authRequest(auth, '/get-session', { method: 'GET' });
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  test('untrusted origin is rejected in a production-like runtime (CSRF)', async () => {
    const originAuth = auth;
    {
      const response = await originAuth.handler(
        new Request('http://127.0.0.1:3100/api/auth/sign-in/email', {
          method: 'POST',
          body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD }),
          headers: {
            'content-type': 'application/json',
            origin: TEST_BAD_ORIGIN,
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'cors',
          },
        }),
      );
      expect(response.status).toBe(403);
      const body = (await response.json()) as { message?: string };
      expect(body.message ?? '').not.toContain(TEST_OWNER_PASSWORD);
    }
  });

  test('untrusted origin is rejected for a cross-site cookie-carrying sign-out (CSRF)', async () => {
    {
      const signIn = await authRequest(auth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      });
      expect(signIn.status).toBe(200);
      const response = await auth.handler(
        new Request('http://127.0.0.1:3100/api/auth/sign-out', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: TEST_BAD_ORIGIN,
            cookie: sessionCookieFrom(signIn),
          },
        }),
      );
      expect(response.status).toBe(403);
    }
  });

  test('unsafe external callback URL is rejected', async () => {
    const rejected = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: {
        email: TEST_OWNER_EMAIL,
        password: 'wrong-password-value',
        callbackURL: 'https://attacker.example/phish',
      },
    });
    expect(rejected.status).toBe(403);
    const body = (await rejected.json()) as { message?: string };
    expect(body.message ?? '').not.toContain('attacker');
  });

  test('an arbitrary vercel.app origin is not trusted by default', async () => {
    const previousBaseURL = process.env.BETTER_AUTH_URL;
    const previousTrusted = process.env.TRUSTED_ORIGINS;
    process.env.BETTER_AUTH_URL = 'https://nokmel.example';
    process.env.TRUSTED_ORIGINS = 'https://nokmel.example';
    try {
      const configuredAuth = createTestAuth(pg.db);
      const response = await configuredAuth.handler(
        new Request('https://nokmel.example/api/auth/sign-in/email', {
          method: 'POST',
          body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD }),
          headers: {
            'content-type': 'application/json',
            origin: 'https://random-attacker.vercel.app',
            'sec-fetch-site': 'cross-site',
            'sec-fetch-mode': 'cors',
          },
        }),
      );
      expect(response.status).toBe(403);
    } finally {
      process.env.BETTER_AUTH_URL = previousBaseURL;
      process.env.TRUSTED_ORIGINS = previousTrusted;
    }
  });

  test('an explicitly configured immutable preview alias is trusted', async () => {
    const previousBaseURL = process.env.BETTER_AUTH_URL;
    const previousTrusted = process.env.TRUSTED_ORIGINS;
    const previewOrigin = 'https://nokmel-website-git-w31-owner-auth-ammarjaberd.vercel.app';
    process.env.BETTER_AUTH_URL = previewOrigin;
    process.env.TRUSTED_ORIGINS = `https://nokmel.example,${previewOrigin}`;
    try {
      const previewAuth = createTestAuth(pg.db);
      const response = await previewAuth.handler(
        new Request(`${previewOrigin}/api/auth/sign-in/email`, {
          method: 'POST',
          body: JSON.stringify({ email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD }),
          headers: {
            'content-type': 'application/json',
            origin: previewOrigin,
          },
        }),
      );
      expect(response.status).toBe(200);
    } finally {
      process.env.BETTER_AUTH_URL = previousBaseURL;
      process.env.TRUSTED_ORIGINS = previousTrusted;
    }
  });
});

describe('session lifecycle and revocation', () => {
  test('logout revokes the session and it stops authorizing requests', async () => {
    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    const cookie = sessionCookieFrom(signIn);
    const row = await newestSessionRow(pg.pool);
    const logout = await authRequest(auth, '/sign-out', { method: 'POST', cookie });
    expect(logout.status).toBe(200);
    await logout.text();

    const afterLogout = await authRequest(auth, '/get-session', { method: 'GET', cookie });
    expect(await afterLogout.json()).toBeNull();
    const { rows } = await pg.pool.query(
      'select count(*)::int as count from "session" where token = $1',
      [row.token],
    );
    expect(rows[0].count).toBe(0);
  });

  test('an expired session is rejected server-side', async () => {
    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    const cookie = sessionCookieFrom(signIn);
    const row = await newestSessionRow(pg.pool);
    await pg.db
      .update(session)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(session.token, row.token));

    const response = await authRequest(auth, '/get-session', { method: 'GET', cookie });
    expect(await response.json()).toBeNull();
  });

  test('deleting a user\'s sessions invalidates them (revocation)', async () => {
    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    const cookie = sessionCookieFrom(signIn);
    const row = await newestSessionRow(pg.pool);
    await pg.db.delete(session).where(and(eq(session.userId, row.user_id)));

    const after = await authRequest(auth, '/get-session', { method: 'GET', cookie });
    expect(await after.json()).toBeNull();
  });

  test('password recovery revokes previously issued sessions and rotates the password', async () => {
    const signIn = await authRequest(auth, '/sign-in/email', {
      method: 'POST',
      body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
    });
    expect(signIn.status).toBe(200);
    const cookie = sessionCookieFrom(signIn);

    try {
      const recovery = await resetOwnerPassword({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        password: 'recovered-password-value-1',
      });
      expect(recovery.outcome).toBe('password-reset');
      expect(recovery.invalidatedSessions).toBeGreaterThanOrEqual(1);

      const after = await authRequest(auth, '/get-session', { method: 'GET', cookie });
      expect(await after.json()).toBeNull();

      const oldPassword = await authRequest(auth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
      });
      expect(oldPassword.status).toBe(401);

      const newPassword = await authRequest(auth, '/sign-in/email', {
        method: 'POST',
        body: { email: TEST_OWNER_EMAIL, password: 'recovered-password-value-1' },
      });
      expect(newPassword.status).toBe(200);
      await newPassword.json();
    } finally {
      await resetOwnerPassword({
        db: pg.db,
        email: TEST_OWNER_EMAIL,
        password: TEST_OWNER_PASSWORD,
      });
    }
  });
});
