import { describe, expect, test } from 'vitest';
import {
  emptyPublicSettingsForm,
  maskTelegramChatId,
  projectPublicSettings,
  publicSettingsChannels,
  validateAnalyticsSettingsInput,
  validateNotificationSettingsInput,
  validatePublicSettingsInput,
  validatePublicUrl,
} from '@/lib/settings/model';

describe('public settings validation', () => {
  test('accepts approved provider URLs and normalizes them', () => {
    expect(validatePublicUrl('https://t.me/nokmel', 'telegram')).toEqual({
      ok: true,
      url: 'https://t.me/nokmel',
    });
    expect(validatePublicUrl('https://wa.me/201234567890/', 'whatsapp')).toEqual({
      ok: true,
      url: 'https://wa.me/201234567890',
    });
    expect(
      validatePublicUrl('https://www.instagram.com/nokmel/', 'instagram'),
    ).toEqual({ ok: true, url: 'https://www.instagram.com/nokmel' });
    expect(validatePublicUrl('https://facebook.com/nokmel', 'facebook')).toEqual({
      ok: true,
      url: 'https://facebook.com/nokmel',
    });
    expect(validatePublicUrl('https://x.com/nokmel', 'x')).toEqual({
      ok: true,
      url: 'https://x.com/nokmel',
    });
    expect(validatePublicUrl('', 'x')).toEqual({ ok: true, url: null });
  });

  test.each([
    ['javascript:alert(1)', 'x'],
    ['data:text/html,hi', 'x'],
    ['http://x.com/nokmel', 'x'],
    ['https://user:pass@x.com/nokmel', 'x'],
    ['https://x.com:8443/nokmel', 'x'],
    ['https://evil.example/nokmel', 'x'],
    ['https://x.com/nokmel?utm_source=evil', 'x'],
    ['https://x.com/nokmel#fragment', 'x'],
    ['https://t.me/ab', 'telegram'],
    ['https://wa.me/abc', 'whatsapp'],
    ['https://instagram.com/', 'instagram'],
  ])('rejects unsafe or mismatched URL %s (%s)', (raw, type) => {
    const result = validatePublicUrl(raw, type as 'x');
    expect(result.ok).toBe(false);
  });

  test('public settings projection validates fields and drops private columns', () => {
    const projected = projectPublicSettings({
      contactEmail: 'hello@nokmel.tech',
      contactPhone: '+201234567890',
      contactTelegramUrl: 'https://t.me/nokmel',
      contactWhatsappUrl: 'javascript:alert(1)',
      socialInstagramUrl: 'https://instagram.com/nokmel',
      socialFacebookUrl: 'https://evil.example/nokmel',
      socialXUrl: null,
      notificationsEnabled: true,
      telegramChatId: '9876543210123',
      analyticsEnabled: true,
      publicRevision: 99,
    } as Record<string, unknown>);
    expect(projected).toEqual({
      contactEmail: 'hello@nokmel.tech',
      contactPhone: '+201234567890',
      contactTelegramUrl: 'https://t.me/nokmel',
      contactWhatsappUrl: null,
      socialInstagramUrl: 'https://instagram.com/nokmel',
      socialFacebookUrl: null,
      socialXUrl: null,
    });
    expect(JSON.stringify(projected)).not.toContain('9876543210123');
    expect(JSON.stringify(projected)).not.toContain('notificationsEnabled');
  });

  test('channels are built only from configured public values', () => {
    const channels = publicSettingsChannels({
      contactEmail: 'hello@nokmel.tech',
      contactPhone: '+201234567890',
      contactTelegramUrl: 'https://t.me/nokmel',
      contactWhatsappUrl: null,
      socialInstagramUrl: null,
      socialFacebookUrl: null,
      socialXUrl: null,
    });
    expect(channels.map((channel) => channel.type)).toEqual([
      'email',
      'phone',
      'telegram',
    ]);
    expect(channels[0].href).toBe('mailto:hello@nokmel.tech');
    expect(channels[1].href).toBe('tel:+201234567890');
    expect(channels[2].href).toBe('https://t.me/nokmel');
  });

  test('form validation reports field-level errors and normalizes digits', () => {
    const invalid = validatePublicSettingsInput({
      ...emptyPublicSettingsForm(),
      contactEmail: 'not-an-email',
      contactPhone: '١٢٣',
      socialXUrl: 'https://evil.example/x',
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.errors.contactEmail).toBeTruthy();
      expect(invalid.errors.contactPhone).toBeTruthy();
      expect(invalid.errors.socialXUrl).toBeTruthy();
    }

    const valid = validatePublicSettingsInput({
      ...emptyPublicSettingsForm(),
      contactPhone: '+٢٠١٢٣٤٥٦٧٨٩٠',
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.values.contactPhone).toBe('+201234567890');
  });
});

describe('notification and analytics settings validation', () => {
  test('notification enablement requires a numeric private chat id', () => {
    expect(
      validateNotificationSettingsInput({
        notificationsEnabled: true,
        telegramChatId: '',
      }).ok,
    ).toBe(false);
    expect(
      validateNotificationSettingsInput({
        notificationsEnabled: true,
        telegramChatId: '-100123',
      }).ok,
    ).toBe(false);
    expect(
      validateNotificationSettingsInput({
        notificationsEnabled: true,
        telegramChatId: '9876543210123',
      }),
    ).toEqual({
      ok: true,
      values: { notificationsEnabled: true, telegramChatId: '9876543210123' },
    });
    expect(
      validateNotificationSettingsInput({
        notificationsEnabled: false,
        telegramChatId: '',
      }),
    ).toEqual({
      ok: true,
      values: { notificationsEnabled: false, telegramChatId: null },
    });
  });

  test('chat id is masked for owner status display', () => {
    expect(maskTelegramChatId('123456789')).toBe('••••6789');
    expect(maskTelegramChatId('123')).toBe('••••');
    expect(maskTelegramChatId(null)).toBeNull();
  });

  test('analytics preference is a strict boolean', () => {
    expect(validateAnalyticsSettingsInput({ analyticsEnabled: true }).ok).toBe(true);
    expect(validateAnalyticsSettingsInput({ analyticsEnabled: 'yes' }).ok).toBe(false);
    expect(
      validateAnalyticsSettingsInput({ analyticsEnabled: true, extra: 1 }).ok,
    ).toBe(false);
  });
});
