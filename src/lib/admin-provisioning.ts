import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import type { Db } from '@/lib/db/types';
import { account, session, user } from '@/lib/db/schema';
import { OWNER_CREDENTIAL_TRANSACTION_LOCK_SQL } from '@/lib/owner-credential-lock';

/**
 * Owner provisioning core (W3.1).
 *
 * Server-side operator-only provisioning for the single website owner. Used by
 * the operator CLI (`scripts/provision-owner.ts`) and by integration tests —
 * never mounted as a public HTTP handler. Production owner creation remains
 * the responsibility of the external lead and owner after review.
 *
 * Concurrency: the owner-credential advisory lock (shared with the HTTP
 * credential sign-in path, see `owner-credential-lock.ts`) serializes all
 * provisioning/recovery transactions before existing owner state is read, so
 * two concurrent runs cannot both observe an empty database and create two
 * owners. This is database-backed (not a process-local mutex), so it holds
 * across serverless instances and operator processes.
 *
 * Identity integrity: an existing matching email is not by itself proof that
 * the owner is correctly provisioned. Provisioning requires exactly one
 * credential account in the correct account-to-user relationship with a
 * usable password hash; incomplete, duplicate, or inconsistent relationships
 * are refused rather than silently overwritten.
 *
 * Password hashing uses Better Auth's supported `hashPassword` (same
 * algorithm and format its sign-in verification expects) — no custom
 * cryptography, no plaintext inserts, nothing logged.
 */

const PASSWORD_HASH_PATTERN = /^[0-9a-f]{32}:[0-9a-f]{128}$/i;

export type ProvisionOwnerResult =
  | { outcome: 'created'; userId: string }
  | { outcome: 'already-provisioned'; userId: string };

export type ResetOwnerPasswordResult = {
  outcome: 'password-reset';
  invalidatedSessions: number;
};

export class ProvisioningRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvisioningRefusedError';
  }
}

export function isUsablePasswordHash(value: string | null | undefined): boolean {
  return typeof value === 'string' && PASSWORD_HASH_PATTERN.test(value);
}

type ProvisioningTransaction = Parameters<Parameters<Db['transaction']>[0]>[0];

async function lockOwnerCredentialState(tx: ProvisioningTransaction): Promise<void> {
  await tx.execute(OWNER_CREDENTIAL_TRANSACTION_LOCK_SQL);
}

export async function provisionOwner(input: {
  db: Db;
  email: string;
  name: string;
  password: string;
}): Promise<ProvisionOwnerResult> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  return input.db.transaction(async (tx) => {
    await lockOwnerCredentialState(tx);

    const credentialOwners = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .innerJoin(account, eq(account.userId, user.id))
      .where(eq(account.providerId, 'credential'));
    for (const credentialUser of credentialOwners) {
      if (credentialUser.email !== email) {
        throw new ProvisioningRefusedError(
          'An owner account already exists for a different identity. Creating a second owner is refused.',
        );
      }
    }

    const existingUsers = await tx
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.email, email));
    if (existingUsers.length > 1) {
      throw new ProvisioningRefusedError(
        'Multiple user records exist for the configured identity. Refusing to guess which one is the owner.',
      );
    }

    if (existingUsers.length === 1) {
      const existingUser = existingUsers[0];
      const credentialAccounts = await tx
        .select({
          id: account.id,
          accountId: account.accountId,
          userId: account.userId,
          password: account.password,
        })
        .from(account)
        .where(and(eq(account.userId, existingUser.id), eq(account.providerId, 'credential')));

      if (credentialAccounts.length === 0) {
        throw new ProvisioningRefusedError(
          'A user exists for the configured identity but has no credential account. Refusing to modify an incomplete owner record.',
        );
      }
      if (credentialAccounts.length > 1) {
        throw new ProvisioningRefusedError(
          'Multiple credential accounts exist for the configured identity. Refusing to choose or overwrite one.',
        );
      }
      const credentialAccount = credentialAccounts[0];
      if (
        credentialAccount.userId !== existingUser.id ||
        credentialAccount.accountId !== existingUser.id
      ) {
        throw new ProvisioningRefusedError(
          'The existing credential account has an inconsistent account-to-user relationship. Refusing to modify it.',
        );
      }
      if (!isUsablePasswordHash(credentialAccount.password)) {
        throw new ProvisioningRefusedError(
          'The existing credential account has no usable password hash. Refusing to silently overwrite it.',
        );
      }
      return { outcome: 'already-provisioned' as const, userId: existingUser.id };
    }

    const ownerUserId = randomUUID();
    await tx.insert(user).values({
      id: ownerUserId,
      name: input.name.trim(),
      email,
      emailVerified: true,
    });
    await tx.insert(account).values({
      id: randomUUID(),
      accountId: ownerUserId,
      providerId: 'credential',
      userId: ownerUserId,
      password: passwordHash,
    });
    return { outcome: 'created' as const, userId: ownerUserId };
  });
}

export async function resetOwnerPassword(input: {
  db: Db;
  email: string;
  password: string;
}): Promise<ResetOwnerPasswordResult> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  return input.db.transaction(async (tx) => {
    await lockOwnerCredentialState(tx);

    const owners = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (owners.length === 0) {
      throw new ProvisioningRefusedError('No owner account exists for the configured identity.');
    }
    if (owners.length > 1) {
      throw new ProvisioningRefusedError(
        'Multiple user records exist for the configured identity. Refusing password recovery.',
      );
    }
    const ownerUserId = owners[0].id;

    const credentialAccounts = await tx
      .select({ id: account.id, accountId: account.accountId, userId: account.userId })
      .from(account)
      .where(and(eq(account.userId, ownerUserId), eq(account.providerId, 'credential')));
    if (credentialAccounts.length !== 1) {
      throw new ProvisioningRefusedError(
        'The owner identity does not have exactly one credential account. Refusing password recovery.',
      );
    }
    const credentialAccount = credentialAccounts[0];
    if (
      credentialAccount.userId !== ownerUserId ||
      credentialAccount.accountId !== ownerUserId
    ) {
      throw new ProvisioningRefusedError(
        'The owner credential account has an inconsistent account-to-user relationship. Refusing password recovery.',
      );
    }

    await tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(account.id, credentialAccount.id));
    const revoked = await tx
      .delete(session)
      .where(eq(session.userId, ownerUserId))
      .returning({ id: session.id });
    return { outcome: 'password-reset' as const, invalidatedSessions: revoked.length };
  });
}
