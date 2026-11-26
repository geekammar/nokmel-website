import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { JoinStorageError } from '@/lib/join/errors';

const mocks = vi.hoisted(() => ({
  createJoinRequest: vi.fn(),
  consumeJoinRateLimit: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock('@/lib/join/service', () => ({
  createJoinRequest: mocks.createJoinRequest,
}));

vi.mock('@/lib/join/rate-limit', () => ({
  consumeJoinRateLimit: mocks.consumeJoinRateLimit,
}));

vi.mock('@/lib/db', () => ({
  getDb: mocks.getDb,
}));

import { GET, POST } from './route';

const ORIGIN = 'http://127.0.0.1:3100';

function request(
  body: unknown,
  options: {
    origin?: string | null;
    contentType?: string;
    contentLength?: string;
    ip?: string;
  } = {},
): Request {
  const headers = new Headers({
    'content-type': options.contentType ?? 'application/json',
    'x-forwarded-for': options.ip ?? '203.0.113.10',
  });
  if (options.origin !== null) headers.set('origin', options.origin ?? ORIGIN);
  if (options.contentLength) headers.set('content-length', options.contentLength);
  return new Request(`${ORIGIN}/api/join`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'تاجر اختبار',
    phone: '01012345678',
    countryCode: '+20',
    email: '',
    businessActivity: '',
    source: 'pricing',
    submissionToken: 'synthetic-route-token-1234567890',
    ...overrides,
  };
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  process.env.JOIN_INTAKE_ENABLED = '1';
  process.env.BETTER_AUTH_URL = ORIGIN;
  process.env.TRUSTED_ORIGINS = ORIGIN;
  process.env.BETTER_AUTH_SECRET = 'join-route-test-secret-0123456789abcdef';
  mocks.createJoinRequest.mockReset();
  mocks.consumeJoinRateLimit.mockReset();
  mocks.getDb.mockReset();
  mocks.getDb.mockReturnValue({ db: { synthetic: true } });
  mocks.consumeJoinRateLimit.mockResolvedValue({ allowed: true });
  mocks.createJoinRequest.mockResolvedValue({ created: true, id: 'internal-secret-id' });
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  delete process.env.JOIN_INTAKE_ENABLED;
  consoleError.mockRestore();
});

describe('join intake route', () => {
  test('returns a minimal success result without stored data or internal IDs', async () => {
    const response = await POST(request(validBody()));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ ok: true, status: 'received', duplicate: false });
    expect(JSON.stringify(body)).not.toContain('internal-secret-id');
    const call = mocks.createJoinRequest.mock.calls[0][0];
    expect(call.phone).toBe('+201012345678');
    expect(call.email).toBeNull();
    expect(mocks.createJoinRequest.mock.calls[0][1]).toEqual({ db: { synthetic: true } });
  });

  test('reports duplicate submissions as safe success and creates nothing twice', async () => {
    mocks.createJoinRequest.mockResolvedValue({ created: false, duplicate: true });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: 'received', duplicate: true });
  });

  test('is disabled by default / when the gate is invalid', async () => {
    delete process.env.JOIN_INTAKE_ENABLED;
    const response = await POST(request(validBody()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('intake_disabled');
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();

    process.env.JOIN_INTAKE_ENABLED = 'yes';
    const invalid = await POST(request(validBody()));
    expect(invalid.status).toBe(403);
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
  });

  test('rejects untrusted browser origins and cross-site requests', async () => {
    const evil = await POST(request(validBody(), { origin: 'https://attacker.example' }));
    expect(evil.status).toBe(403);
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
    expect(mocks.consumeJoinRateLimit).not.toHaveBeenCalled();
  });

  test('allows missing Origin only as documented non-browser access', async () => {
    const response = await POST(request(validBody(), { origin: null }));
    expect(response.status).toBe(200);
  });

  test('rejects unsupported media types, oversized bodies and malformed JSON', async () => {
    const wrongType = await POST(request(validBody(), { contentType: 'text/plain' }));
    expect(wrongType.status).toBe(415);
    const tooLarge = await POST(
      request(validBody(), { contentLength: String(20 * 1024) }),
    );
    expect(tooLarge.status).toBe(413);
    const malformed = await POST(request('{not-json'));
    expect(malformed.status).toBe(400);
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
  });

  test('returns strict field errors without echoing PII', async () => {
    const phoneResponse = await POST(request(validBody({ phone: 'AB123' })));
    expect(phoneResponse.status).toBe(400);
    const phoneBody = (await phoneResponse.json()) as {
      ok: false;
      fieldErrors: Record<string, string>;
    };
    expect(phoneBody.ok).toBe(false);
    expect(phoneBody.fieldErrors.phone).toBeTruthy();
    expect(JSON.stringify(phoneBody)).not.toContain('AB123');

    const emailResponse = await POST(
      request(validBody({ email: 'not-an-email' })),
    );
    expect(emailResponse.status).toBe(400);
    const emailBody = (await emailResponse.json()) as {
      ok: false;
      fieldErrors: Record<string, string>;
    };
    expect(emailBody.fieldErrors.email).toBeTruthy();
    expect(JSON.stringify(emailBody)).not.toContain('not-an-email');
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
  });

  test('returns controlled rate-limit response with Retry-After', async () => {
    mocks.consumeJoinRateLimit.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 42,
    });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('42');
    const body = (await response.json()) as { retryAfterSeconds: number };
    expect(body.retryAfterSeconds).toBe(42);
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
  });

  test('never reports success when persistence fails', async () => {
    mocks.createJoinRequest.mockRejectedValue(new JoinStorageError());
    const response = await POST(
      request(validBody({ submissionToken: 'synthetic-storage-failure-token' })),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { ok: boolean; message: string };
    expect(body.ok).toBe(false);
    expect(body.message).toContain('لم يُستلم');
  });

  test('returns 503 when database configuration is absent', async () => {
    mocks.getDb.mockImplementation(() => {
      throw new Error('DATABASE_URL is not configured');
    });
    const response = await POST(request(validBody()));
    expect(response.status).toBe(503);
    expect((await response.json()).ok).toBe(false);
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
  });

  test('GET cannot create or mutate requests', async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(mocks.createJoinRequest).not.toHaveBeenCalled();
  });
});
