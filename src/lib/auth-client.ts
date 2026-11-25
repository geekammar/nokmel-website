import { createAuthClient } from 'better-auth/react';
import { parseRetryAfterSeconds } from '@/lib/login-cooldown';

/**
 * Better Auth browser client.
 *
 * The pinned Better Auth server sends `X-Retry-After` on a 429 (its rate
 * limiter does not use the standard `Retry-After` header), but the client
 * error object does not expose response headers. This hook captures the
 * header for the most recent sign-in request so the login UI can show a
 * retry countdown derived from the actual response. It never stores cookie
 * values or account data.
 */

let signInRetryAfterSeconds: number | null = null;

export function takeSignInRetryAfterSeconds(): number | null {
  const value = signInRetryAfterSeconds;
  signInRetryAfterSeconds = null;
  return value;
}

export const authClient = createAuthClient({
  fetchOptions: {
    onResponse: (context) => {
      try {
        const rawUrl =
          typeof context.request.url === 'string'
            ? context.request.url
            : context.request.url.toString();
        if (!new URL(rawUrl).pathname.replace(/\/+$/, '').endsWith('/sign-in/email')) return;
        if (context.response.status !== 429) {
          signInRetryAfterSeconds = null;
          return;
        }
        signInRetryAfterSeconds = parseRetryAfterSeconds(
          context.response.headers.get('x-retry-after') ??
            context.response.headers.get('retry-after'),
        );
      } catch {
        signInRetryAfterSeconds = null;
      }
    },
  },
});
