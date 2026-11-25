import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Database-backed integration tests (Better Auth, Drizzle migrations, owner
 * provisioning). Run against a disposable PostgreSQL instance only:
 *
 *   - locally: `pnpm test:db` launches an isolated embedded PostgreSQL 18
 *   - CI: `TEST_DATABASE_URL` pointing at the disposable service container
 *
 * Never point these tests at a hosted database.
 */

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    setupFiles: ['tests/integration/setup-env.ts'],
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
