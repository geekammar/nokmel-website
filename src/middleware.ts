import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

/**
 * Optimistic early redirect for `/admin` (Next.js 15 edge middleware).
 *
 * This is NOT a security boundary: it only checks whether a session cookie is
 * present (Better Auth `getSessionCookie`), never validates it. Actual owner
 * authorization is enforced server-side in admin pages/layouts, server-side
 * data access, route handlers, and future server actions.
 *
 * No open-redirect parameters are forwarded: every redirect targets a fixed
 * app path.
 */

const LOGIN_PATH = '/admin/login';
const COOKIE_PREFIX = 'nokmel';

function privateResponse(response: NextResponse): NextResponse {
  response.headers.set('cache-control', 'no-store');
  return response;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === LOGIN_PATH) {
    return privateResponse(NextResponse.next());
  }
  const hasSessionCookie = Boolean(
    getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX }),
  );
  if (!hasSessionCookie) {
    return privateResponse(NextResponse.redirect(new URL(LOGIN_PATH, request.nextUrl.origin)));
  }
  return privateResponse(NextResponse.next());
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
