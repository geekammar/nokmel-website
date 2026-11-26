import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/owner', () => ({ getOwnerSession: vi.fn() }));
vi.mock('@/lib/notifications/service', () => ({
  sendOwnerTestNotification: vi.fn(),
  retryJoinRequestNotification: vi.fn(),
}));
vi.mock('@/lib/settings/service', () => ({
  SettingsConflictError: class extends Error {},
  SettingsStorageError: class extends Error {},
  SettingsValidationError: class extends Error {
    fieldErrors: Record<string, string>;
    constructor(fieldErrors: Record<string, string>) {
      super('validation');
      this.fieldErrors = fieldErrors;
    }
  },
  saveAnalyticsSettings: vi.fn(),
  saveNotificationSettings: vi.fn(),
  savePublicSettings: vi.fn(),
}));

import { getOwnerSession } from '@/lib/owner';
import { sendOwnerTestNotification } from '@/lib/notifications/service';
import { sendNotificationTestAction } from '@/app/(admin)/admin/settings/actions';

const mockedOwner = vi.mocked(getOwnerSession);
const mockedTest = vi.mocked(sendOwnerTestNotification);

describe('settings action authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('an unauthenticated caller cannot send an owner test notification', async () => {
    mockedOwner.mockResolvedValue(null);
    const result = await sendNotificationTestAction();
    expect(result).toMatchObject({
      ok: false,
      code: 'unauthorized',
    });
    expect(mockedTest).not.toHaveBeenCalled();
  });

  test('an authenticated owner reaches the test service', async () => {
    mockedOwner.mockResolvedValue({
      user: { id: 'owner', email: 'owner@example.test', name: 'Owner' },
      session: { id: 'session', expiresAt: new Date() },
    } as never);
    mockedTest.mockResolvedValue({
      ok: true,
      botUsername: 'nokmel_bot',
      botName: 'Nokmel',
    });
    const result = await sendNotificationTestAction();
    expect(result).toEqual({
      ok: true,
      data: { ok: true, botUsername: 'nokmel_bot', botName: 'Nokmel' },
    });
    expect(mockedTest).toHaveBeenCalledTimes(1);
  });
});
