import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit is driven by DATABASE_URL_DIRECT (direct Neon connection or a
 * disposable test database) — never the pooled runtime URL and never an
 * automatic `push` against hosted environments.
 */

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT ?? '',
  },
});
