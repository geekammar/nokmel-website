import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import type { Db } from '@/lib/db/types';
import { account, session, user } from '@/lib/db/schema';

/**
 * Owner provisioning core (W3.1).
 *
 * Server-side operator-only provisioning for the single website owner. Used by
 * the operator CLI (`scripts/provision-owner.ts`) and by integration tests —
 * never mounted as a public HTTP handler. Production owner creation remains
 * the responsibility of the external lead and owner after review.
 *
 * Password hashing uses Better Auth's supported `hashPassword` (same
 * algorithm and format its sign-in verification expects) — no custom
 * cryptography, no plaintext inserts, nothing logged.
 *
 * Second-owner refusal: at most one credential (email+password) user may
 * exist. Provisioning is idempotent for the same owner email; a different
 * email is refused.
 */

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

export async function provisionOwner(input: {
  db: Db;
  email: string;
  name: string;
  password: string;
}): Promise<ProvisionOwnerResult> {
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);

  return input.db.transaction(async (tx) => {
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
    const existing = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (existing.length > 0) {
      return { outcome: 'already-provisioned' as const, userId: existing[0].id };
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
    const owners = await tx
      .select({ id: user.id })
      .from(user)
      .innerJoin(account, eq(account.userId, user.id))
      .where(and(eq(user.email, email), eq(account.providerId, 'credential')));
    if (owners.length === 0) {
      throw new ProvisioningRefusedError('No owner account exists for the configured identity.');
    }
    const ownerUserId = owners[0].id;
    const updated = await tx
      .update(account)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(and(eq(account.userId, ownerUserId), eq(account.providerId, 'credential')))
      .returning({ id: account.id });
    if (updated.length === 0) {
      throw new ProvisioningRefusedError('No owner account exists for the configured identity.');
    }
    const revoked = await tx
      .delete(session)
      .where(eq(session.userId, ownerUserId))
      .returning({ id: session.id });
    return { outcome: 'password-reset' as const, invalidatedSessions: revoked.length };
  });
}
