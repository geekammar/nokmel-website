/**
 * Pure owner-identity helpers (W3.1) — importable from tests and server code
 * without Next.js runtime bindings. Fail closed: no configured owner email
 * means no identity is ever authorized.
 */

export function configuredOwnerEmail(): string | null {
  const raw = process.env.OWNER_EMAIL;
  if (!raw?.trim()) return null;
  return raw.trim().toLowerCase();
}

export function isOwnerEmail(email: string): boolean {
  const owner = configuredOwnerEmail();
  if (!owner) return false;
  return email.trim().toLowerCase() === owner;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
