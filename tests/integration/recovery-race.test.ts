import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { verifyPassword } from 'better-auth/crypto';
import {
  applyMigrations,
  authRequest,
  createTestAuth,
  emptyDatabase,
  getDisposablePostgres,
  sessionCookieFrom,
  TEST_OWNER_EMAIL,
  TEST_OWNER_PASSWORD,
} from './helpers';
import { provisionOwner, resetOwnerPassword } from '@/lib/admin-provisioning';
import { handleOwnerAuthRequest } from '@/lib/owner-credential-lock';

/**
 * NKW-W31-REC-01 deterministic regression.
 *
 * The test-only password verifier runs the real Better Auth scrypt
 * verification, then pauses before returning. That makes the original race
 * deterministic: the old hash has been verified, recovery completes, and the
 * paused sign-in resumes.
 *
 * The first test deliberately calls `auth.handler()` directly (no lock) to
 * reproduce the pre-fix race. The second uses `handleOwnerAuthRequest` — the
 * exact production route path — and proves recovery waits for the in-flight
 * sign-in, then removes the session it created.
 */

const NEW_PASSWORD = 'recovered-password-value-1';
const pg = await getDisposablePostgres();

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function signInRequest(password: string): Request {
  return new Request('http://127.0.0.1:3100/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://127.0.0.1:3100',
    },
    body: JSON.stringify({ email: TEST_OWNER_EMAIL, password }),
  });
}

function gatedAuth() {
  const verified = deferred();
  const release = deferred();
  const state = { pauseOldPassword: true };
  const auth = createTestAuth(pg.db, {
    passwordVerifier: async ({ hash, password }) => {
      const valid = await verifyPassword({ hash, password });
      if (state.pauseOldPassword && password === TEST_OWNER_PASSWORD) {
        verified.resolve();
        await release.promise;
      }
      return valid;
    },
  });
  return {
    auth,
    verified: verified.promise,
    release: () => release.resolve(),
    resume: () => {
      state.pauseOldPassword = false;
    },
  };
}

async function ownerId(): Promise<string> {
  const { rows } = await pg.pool.query('select id from "user" where email = $1', [
    TEST_OWNER_EMAIL,
  ]);
  if (!rows[0]) throw new Error('owner fixture missing');
  return rows[0].id as string;
}

async function sessionCount(): Promise<number> {
  const { rows } = await pg.pool.query(
    'select count(*)::int as count from "session" where user_id = $1',
    [await ownerId()],
  );
  return rows[0].count as number;
}

async function waitForWaitingAdvisoryLock(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { rows } = await pg.pool.query(
      "select count(*)::int as count from pg_locks where locktype = 'advisory' and not granted",
    );
    if (rows[0].count > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Recovery did not wait on the owner credential advisory lock');
}

beforeAll(async () => {
  await applyMigrations(pg);
});

beforeEach(async () => {
  await emptyDatabase(pg);
  await provisionOwner({
    db: pg.db,
    email: TEST_OWNER_EMAIL,
    name: 'Nokmel Owner',
    password: TEST_OWNER_PASSWORD,
  });
});

afterAll(async () => {
  await pg.stop();
});

describe('password recovery race (NKW-W31-REC-01)', () => {
  test('control: the unlocked handler reproduces the original race', async () => {
    const gated = gatedAuth();

    const signInPromise = gated.auth.handler(signInRequest(TEST_OWNER_PASSWORD));
    await gated.verified;

    const recovery = await resetOwnerPassword({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      password: NEW_PASSWORD,
    });
    expect(recovery.outcome).toBe('password-reset');
    expect(recovery.invalidatedSessions).toBe(0);

    gated.release();
    const signIn = await signInPromise;
    expect(signIn.status).toBe(200);
    const cookie = sessionCookieFrom(signIn);

    expect(await sessionCount()).toBe(1);
    const sessionResponse = await authRequest(gated.auth, '/get-session', {
      method: 'GET',
      cookie,
    });
    expect(await sessionResponse.json()).not.toBeNull();
  });

  test('a pre-existing session is revoked by password recovery', async () => {
    const auth = createTestAuth(pg.db);
    const signIn = await handleOwnerAuthRequest(
      signInRequest(TEST_OWNER_PASSWORD),
      auth,
      pg.pool,
    );
    expect(signIn.status).toBe(200);
    const cookie = sessionCookieFrom(signIn);
    expect(await sessionCount()).toBe(1);

    const recovery = await resetOwnerPassword({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      password: NEW_PASSWORD,
    });
    expect(recovery.invalidatedSessions).toBe(1);
    expect(await sessionCount()).toBe(0);
    const after = await authRequest(auth, '/get-session', { method: 'GET', cookie });
    expect(await after.json()).toBeNull();
  });

  test('guarded route: recovery waits for the in-flight sign-in and leaves no usable session', async () => {
    const gated = gatedAuth();

    const signInPromise = handleOwnerAuthRequest(
      signInRequest(TEST_OWNER_PASSWORD),
      gated.auth,
      pg.pool,
    );
    await gated.verified;

    let recoveryCompleted = false;
    const recoveryPromise = resetOwnerPassword({
      db: pg.db,
      email: TEST_OWNER_EMAIL,
      password: NEW_PASSWORD,
    }).then((result) => {
      recoveryCompleted = true;
      return result;
    });

    await waitForWaitingAdvisoryLock();
    expect(recoveryCompleted).toBe(false);

    gated.release();
    const signIn = await signInPromise;
    expect(signIn.status).toBe(200);
    const cookie = sessionCookieFrom(signIn);

    const recovery = await recoveryPromise;
    expect(recovery.outcome).toBe('password-reset');
    expect(recovery.invalidatedSessions).toBeGreaterThanOrEqual(1);
    expect(await sessionCount()).toBe(0);

    const afterRecovery = await authRequest(gated.auth, '/get-session', {
      method: 'GET',
      cookie,
    });
    expect(await afterRecovery.json()).toBeNull();

    gated.resume();
    const oldPassword = await handleOwnerAuthRequest(
      signInRequest(TEST_OWNER_PASSWORD),
      gated.auth,
      pg.pool,
    );
    expect(oldPassword.status).toBe(401);

    const newPassword = await handleOwnerAuthRequest(
      signInRequest(NEW_PASSWORD),
      gated.auth,
      pg.pool,
    );
    expect(newPassword.status).toBe(200);
    const newCookie = sessionCookieFrom(newPassword);

    const sessionResponse = await authRequest(gated.auth, '/get-session', {
      method: 'GET',
      cookie: newCookie,
    });
    expect(sessionResponse.status).toBe(200);
    const sessionBody = (await sessionResponse.json()) as { user?: { email?: string } };
    expect(sessionBody.user?.email).toBe(TEST_OWNER_EMAIL);

    const logout = await authRequest(gated.auth, '/sign-out', {
      method: 'POST',
      cookie: newCookie,
    });
    expect(logout.status).toBe(200);
    await logout.text();
    const afterLogout = await authRequest(gated.auth, '/get-session', {
      method: 'GET',
      cookie: newCookie,
    });
    expect(await afterLogout.json()).toBeNull();
  });

  test('concurrent normal sign-ins remain safe and functional', async () => {
    const auth = createTestAuth(pg.db);
    const responses = await Promise.all(
      Array.from({ length: 3 }, () =>
        handleOwnerAuthRequest(signInRequest(TEST_OWNER_PASSWORD), auth, pg.pool),
      ),
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
      await response.json();
    }
    expect(await sessionCount()).toBe(3);
  });
});
