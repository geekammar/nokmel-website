import { NextResponse } from 'next/server';
import { ConfigError } from '@/lib/config-error';
import { getAuth } from '@/lib/auth';
import { handleOwnerAuthRequest } from '@/lib/owner-credential-lock';

export const dynamic = 'force-dynamic';

/**
 * Better Auth route handler (documented mount: `/api/auth/[...all]`).
 * Lazy configuration access keeps the build/runtime safe when auth env is not
 * configured; admin access then fails closed.
 *
 * Credential sign-in is routed through `handleOwnerAuthRequest`, which holds a
 * database-backed owner-credential lock around the whole Better Auth handler.
 * Password recovery acquires the same lock before replacing the hash and
 * deleting sessions, so an in-flight old-password sign-in cannot leave a
 * usable session after recovery completes (NKW-W31-REC-01).
 *
 * `auth.handler()` is asynchronous. It must be awaited inside the error
 * boundary so rejected promises (database outages, adapter failures) are
 * converted into a controlled generic response instead of escaping the route.
 * Logs contain only a fixed message and the error class name — never stack
 * traces, SQL, credentials, session tokens, or filesystem paths. The public
 * website does not depend on this route and stays available when
 * authentication infrastructure is unavailable.
 */

function sanitizedErrorKind(error: unknown): string {
  if (error instanceof Error) {
    const name = error.name?.trim();
    return name && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name) ? name : 'Error';
  }
  return typeof error;
}

function failResponse(error: unknown): NextResponse {
  if (error instanceof ConfigError) {
    return new NextResponse(JSON.stringify({ message: 'خدمة المصادقة غير مهيأة. تواصل مع مشرف الموقع.' }), {
      status: 503,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  console.error(`Auth handler failure (${sanitizedErrorKind(error)})`);
  return new NextResponse(JSON.stringify({ message: 'خطأ غير متوقع. حاول مرة أخرى.' }), {
    status: 500,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function dispatch(request: Request): Promise<NextResponse | Response> {
  try {
    return await handleOwnerAuthRequest(request, getAuth());
  } catch (error) {
    return failResponse(error);
  }
}

export async function GET(request: Request): Promise<NextResponse | Response> {
  return dispatch(request);
}

export async function POST(request: Request): Promise<NextResponse | Response> {
  return dispatch(request);
}
