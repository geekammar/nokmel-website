import { describe, expect, test } from 'vitest';
import {
  assertDisposableTestDatabaseUrl,
  isApprovedDisposableDatabaseName,
  openDisposableTestPool,
} from '@/lib/db/disposable-test-database';
import {
  resolveDatabaseConnectionPolicy,
  resolveOperatorDatabaseTarget,
} from '@/lib/db/connection-policy';

const LOCAL_TEST_URL =
  'postgresql://nokmel_test:secret@127.0.0.1:5432/nokmel_test?sslmode=disable';

describe('disposable test database target validation', () => {
  test('accepts an explicit loopback disposable database', () => {
    const target = assertDisposableTestDatabaseUrl(LOCAL_TEST_URL);
    expect(target.database).toBe('nokmel_test');
    expect(target.loopback).toBe(true);
    expect(target.tls).toBe(false);
    expect(target.connectionString).not.toContain('sslmode');
  });

  test('accepts approved CI database names on loopback', () => {
    for (const name of ['nokmel_test', 'nokmel_ci_test', 'nokmel_ci_e2e', 'nokmel_ci_extra']) {
      expect(isApprovedDisposableDatabaseName(name)).toBe(true);
    }
  });

  test('the generic postgres database is accepted only for the harness-owned embedded instance', () => {
    expect(isApprovedDisposableDatabaseName('postgres')).toBe(false);
    expect(isApprovedDisposableDatabaseName('postgres', { allowHarnessDefault: true })).toBe(true);
    expect(() =>
      assertDisposableTestDatabaseUrl(
        'postgresql://user:pass@127.0.0.1:5432/postgres?sslmode=disable',
      ),
    ).toThrow(/approved disposable test database name/i);
    expect(() =>
      assertDisposableTestDatabaseUrl(
        'postgresql://user:pass@127.0.0.1:5432/postgres?sslmode=disable',
        { harnessOwned: true },
      ),
    ).not.toThrow();
  });

  test('rejects hosted Neon endpoints before connecting', () => {
    expect(() =>
      assertDisposableTestDatabaseUrl(
        'postgresql://user:pass@ep-example-pooler.eu-central-1.aws.neon.tech/nokmel_ci_test?sslmode=require',
      ),
    ).toThrow(/Neon|loopback/i);
  });

  test('rejects remote hosts before connecting', () => {
    for (const host of ['db.example.com', '10.0.0.12', '192.168.1.20', '0.0.0.0']) {
      expect(() =>
        assertDisposableTestDatabaseUrl(
          `postgresql://user:pass@${host}:5432/nokmel_ci_test?sslmode=disable`,
        ),
      ).toThrow(/loopback/i);
    }
  });

  test('rejects production-like and unapproved database names on loopback', () => {
    for (const name of ['production', 'nokmel_website', 'nokmel_prod', 'appdb', 'main']) {
      expect(() =>
        assertDisposableTestDatabaseUrl(
          `postgresql://user:pass@127.0.0.1:5432/${name}?sslmode=disable`,
        ),
      ).toThrow(/approved disposable test database name/i);
    }
  });

  test('requires explicit plaintext loopback test configuration', () => {
    expect(() =>
      assertDisposableTestDatabaseUrl('postgresql://user:pass@127.0.0.1:5432/nokmel_test'),
    ).toThrow(/sslmode=disable/i);
    expect(() =>
      assertDisposableTestDatabaseUrl(
        'postgresql://user:pass@127.0.0.1:5432/nokmel_test?sslmode=require',
      ),
    ).toThrow(/sslmode=disable/i);
  });

  test('rejects invalid protocols and malformed URLs', () => {
    for (const url of [
      'mysql://user:pass@127.0.0.1:3306/nokmel_test',
      'https://127.0.0.1/nokmel_test',
      '127.0.0.1:5432/nokmel_test',
      'postgresql://',
      'postgresql://user:pass@127.0.0.1:5432/',
      'postgresql://user:pass@127.0.0.1:5432/nokmel_test#fragment',
    ]) {
      expect(() => assertDisposableTestDatabaseUrl(url)).toThrow();
    }
  });

  test('rejects parameters that can override the validated destination or TLS', () => {
    const overrides = [
      'host=attacker.example',
      'hostaddr=10.0.0.5',
      'port=6543',
      'dbname=production',
      'user=other',
      'password=other',
      'ssl=true',
      'sslrootcert=/etc/passwd',
      'sslcert=/tmp/client.crt',
      'sslkey=/tmp/client.key',
      'sslnegotiation=direct',
      'uselibpqcompat=true',
      'options=-c%20search_path%3Dattacker',
      'sslmode=no-verify',
      'sslmode=prefer',
      'sslmode=verify-ca',
    ];
    for (const param of overrides) {
      expect(() =>
        assertDisposableTestDatabaseUrl(
          `postgresql://user:pass@127.0.0.1:5432/nokmel_test?sslmode=disable&${param}`,
        ),
      ).toThrow();
    }
  });

  test('validates before creating a pool (no connection attempt for unsafe targets)', () => {
    expect(() =>
      openDisposableTestPool(
        'postgresql://user:pass@203.0.113.10:5432/production?sslmode=disable',
      ),
    ).toThrow(/loopback/i);
  });
});

describe('shared connection policy', () => {
  test('hosted connections require verified TLS', () => {
    const policy = resolveDatabaseConnectionPolicy(
      'postgresql://app:secret@ep-direct.eu-central-1.aws.neon.tech/nokmel_website?sslmode=require',
    );
    expect(policy.tls).toEqual({ rejectUnauthorized: true });
    expect(policy.connectionString).not.toContain('sslmode');
  });

  test('error messages never include the raw URL or credentials', () => {
    try {
      resolveDatabaseConnectionPolicy(
        'postgresql://app:super-secret-password@db.example.com/nokmel_website?host=attacker.example',
      );
      throw new Error('expected policy rejection');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('super-secret-password');
      expect(message).not.toContain('postgresql://');
    }
  });

  test('defaults to verified TLS for non-loopback hosts without sslmode', () => {
    const policy = resolveDatabaseConnectionPolicy(
      'postgresql://app:secret@db.example.com:5432/nokmel_website',
    );
    expect(policy.tls).toEqual({ rejectUnauthorized: true });
  });

  test('rejects insecure TLS modes and overriding URL parameters', () => {
    for (const url of [
      'postgresql://app:secret@db.example.com/nokmel_website?sslmode=disable',
      'postgresql://app:secret@db.example.com/nokmel_website?sslmode=no-verify',
      'postgresql://app:secret@db.example.com/nokmel_website?sslmode=prefer',
      'postgresql://app:secret@db.example.com/nokmel_website?uselibpqcompat=true',
      'postgresql://app:secret@db.example.com/nokmel_website?ssl=true',
      'postgresql://app:secret@db.example.com/nokmel_website?host=attacker.example',
    ]) {
      expect(() => resolveDatabaseConnectionPolicy(url)).toThrow();
    }
  });
});

describe('operator direct connection policy', () => {
  test('requires DATABASE_URL_DIRECT and never falls back to DATABASE_URL', () => {
    expect(() => resolveOperatorDatabaseTarget(undefined)).toThrow(/DATABASE_URL_DIRECT is required/);
    expect(() => resolveOperatorDatabaseTarget('')).toThrow(/DATABASE_URL_DIRECT is required/);
  });

  test('rejects pooled hosted endpoints for operator writes', () => {
    expect(() =>
      resolveOperatorDatabaseTarget(
        'postgresql://migrate:secret@ep-example-pooler.eu-central-1.aws.neon.tech/nokmel_website?sslmode=require',
      ),
    ).toThrow(/pooled/i);
  });

  test('accepts a direct hosted endpoint with verified TLS', () => {
    const policy = resolveOperatorDatabaseTarget(
      'postgresql://migrate:secret@ep-direct.eu-central-1.aws.neon.tech/nokmel_website?sslmode=require',
    );
    expect(policy.tls).toEqual({ rejectUnauthorized: true });
  });

  test('accepts an explicit loopback disposable target', () => {
    const policy = resolveOperatorDatabaseTarget(LOCAL_TEST_URL);
    expect(policy.loopback).toBe(true);
    expect(policy.tls).toBe(false);
  });
});
