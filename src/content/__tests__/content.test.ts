import { describe, expect, it } from 'vitest';
import { publicRoutes } from '@/content/schema';
import { contact } from '@/content/ar/contact';
import { features } from '@/content/ar/features';
import { home } from '@/content/ar/home';
import { join } from '@/content/ar/join';
import { legal } from '@/content/ar/legal';
import { pricing } from '@/content/ar/pricing';

describe('structured content', () => {
  it('keeps the seven approved public routes', () => {
    expect([...publicRoutes]).toEqual([
      '/',
      '/features',
      '/pricing',
      '/join',
      '/contact',
      '/privacy',
      '/terms',
    ]);
  });

  it('exposes the working approved headline and tagline on the homepage', () => {
    expect(home.hero.headline).toBe('متجرك في المحادثة. وإدارة طلباتك في مكان واحد.');
    expect(home.hero.tagline).toBe('خلي بزنسك يكمل.');
    expect(home.hero.primaryCta).toEqual({ label: 'اطلب الانضمام', href: '/join' });
    expect(home.hero.secondaryCta).toEqual({ label: 'استكشف المميزات', href: '/features' });
  });

  it('never marks a homepage capability as available without evidence', () => {
    for (const item of [...home.capabilities.items]) {
      expect(item.status).not.toBe('available');
    }
  });

  it('join fields have unique ids, correct requiredness and safe input types', () => {
    const ids = join.fields.map((field) => field.id);
    const names = join.fields.map((field) => field.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    const byId = new Map(join.fields.map((field) => [field.id, field]));
    expect(byId.get('join-name')?.required).toBe(true);
    expect(byId.get('join-phone')?.required).toBe(true);
    expect(byId.get('join-phone')?.type).toBe('tel');
    expect(byId.get('join-email')?.required).toBe(false);
    expect(byId.get('join-email')?.type).toBe('email');
    expect(byId.get('join-activity')?.required).toBe(false);
    expect(byId.get('join-activity')?.type).toBe('textarea');
  });

  it('join submission is explicitly not available in W2', () => {
    expect(join.disabledNotice.title.length).toBeGreaterThan(0);
    expect(join.disabledNotice.body).toContain('معطّلة');
  });

  it('shipping pages do not invent contact channels', () => {
    expect(contact.channels).toEqual([]);
    expect(contact.emptyNote.length).toBeGreaterThan(0);
  });

  it('legal pages are draft-level content', () => {
    expect(legal.draftStatus.label).toContain('قيد الإعداد');
    expect(legal.privacy.sections.length).toBeGreaterThan(3);
    expect(legal.terms.sections.length).toBeGreaterThan(3);
  });

  it('features page distinguishes direction from planned and available is empty', () => {
    expect(features.workflows.items.every((item) => item.status === 'direction')).toBe(true);
    expect(features.planned.items.length).toBeGreaterThan(0);
    expect(features.planned.items.every((item) => item.status === 'planned')).toBe(true);
  });

  it('pricing page does not invent commercial prices or plan names', () => {
    const text = JSON.stringify(pricing);
    expect(text).not.toMatch(/ريال|ر\.س|\$|USD|SAR/);
    expect(text).not.toMatch(/\/month|شهرياً —/);
  });
});
