import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { ConfigError } from '@/lib/config-error';
import { getAuth, type Auth } from '@/lib/auth';
import { isOwnerEmail } from '@/lib/owner-identity';

/**
 * Owner-only authorization helpers (W3.1).
 *
 * Authentication (a valid Better Auth session) and authorization (the session
 * belongs to the configured owner identity) stay separate concepts: a session
 * alone is never sufficient. Owner identity is configured via `OWNER_EMAIL`
 * and compared after consistent normalization (trim + lowercase).
 *
 * Missing configuration must fail closed: `getOwnerSession()` returns `null`,
 * `requireOwner()` redirects to the login page, and mutation guards respond
 * 401 — never an insecure default.
 */

type OwnerSession = NonNullable<
  Awaited<ReturnType<Auth['api']['getSession']>>
>;

export { isOwnerEmail };

export async function getOwnerSession(): Promise<OwnerSession | null> {
  try {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (session && isOwnerEmail(session.user.email)) return session;
    return null;
  } catch (error) {
    if (error instanceof ConfigError) return null;
    throw error;
  }
}

export async function requireOwner(): Promise<OwnerSession> {
  const owner = await getOwnerSession();
  if (!owner) redirect('/admin/login');
  return owner;
}

export async function enforceOwnerForMutation(): Promise<OwnerSession | NextResponse> {
  const owner = await getOwnerSession();
  if (!owner) {
    return NextResponse.json(
      { message: 'غير مصرّح' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }
  return owner;
}
