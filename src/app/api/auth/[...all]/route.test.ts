import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ConfigError } from '@/lib/config-error';

const mocks = vi.hoisted(() => ({
  handler: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuth: mocks.getAuth,
}));

import { GET, POST } from './route';

const request = () =>
  new Request('https://nokmel.tech/api/auth/sign-in/email', { method: 'POST' });

describe('auth route error boundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.handler.mockReset();
    mocks.getAuth.mockReset();
    mocks.getAuth.mockReturnValue({ handler: mocks.handler });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('awaits and returns the Better Auth response', async () => {
    mocks.handler.mockResolvedValue(new Response('{}', { status: 200 }));
    const response = await POST(request());
    expect(response.status).toBe(200);
  });

  test('catches asynchronous handler rejection and returns a generic 500', async () => {
    mocks.handler.mockRejectedValue(
      new Error(
        'connect ECONNREFUSED 10.0.0.5:5432 relation "user" password=super-secret /app/.next/server/chunk.js',
      ),
    );
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const text = await response.text();
    expect(text).toContain('خطأ غير متوقع');
    for (const leaked of ['ECONNREFUSED', 'relation', 'password', 'super-secret', '/app/', 'chunk.js']) {
      expect(text).not.toContain(leaked);
    }
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0]?.[0] ?? '');
    expect(logged).toBe('Auth handler failure (Error)');
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain('ECONNREFUSED');
  });

  test('catches synchronous handler throw on GET', async () => {
    mocks.handler.mockImplementation(() => {
      throw new Error('unexpected internal state at /srv/app');
    });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('/srv/app');
  });

  test('missing/invalid auth configuration fails closed with 503', async () => {
    mocks.getAuth.mockImplementation(() => {
      throw new ConfigError('BETTER_AUTH_SECRET is not configured.');
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain('خدمة المصادقة غير مهيأة');
    expect(text).not.toContain('BETTER_AUTH_SECRET');
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('database failure never returns a session-like success payload', async () => {
    mocks.handler.mockRejectedValue(new Error('database unavailable'));
    const response = await GET(request());
    expect(response.status).toBe(500);
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['message']);
    expect(body.message).toBe('خطأ غير متوقع. حاول مرة أخرى.');
  });
});
