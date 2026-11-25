/**
 * Integration-test runtime: production-like Node environment so Better Auth
 * applies its deployed behavior (origin/CSRF checks, secure-cookie rules).
 * Must run before Better Auth modules are imported (vitest runs setupFiles
 * before test-file module graphs).
 */
(process.env as Record<string, string | undefined>).NODE_ENV = 'production';
delete process.env.TEST;

process.env.BETTER_AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET ?? 'w31-integration-test-secret-0123456789abcdef';
process.env.BETTER_AUTH_URL ??= 'http://127.0.0.1:3100';
process.env.TRUSTED_ORIGINS ??= 'http://127.0.0.1:3100,https://nokmel.example';
process.env.OWNER_EMAIL ??= 'owner@w31-integration.test';
