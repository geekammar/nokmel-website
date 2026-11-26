import { expect, test, type Page } from '@playwright/test';
import {
  assertDestructiveTestTargetIsStillSafe,
  openDisposableTestPool,
} from '../../src/lib/db/disposable-test-database';

const enabled = Boolean(process.env.E2E_OWNER_PASSWORD && process.env.DATABASE_URL);
const BASE = 'http://127.0.0.1:3400';
const MEASUREMENT_ID = 'G-E2ETEST01';

test.skip(!enabled, 'Analytics consent e2e environment is not configured');
test.describe.configure({ mode: 'serial' });

type DataLayerEntry = unknown[];

async function withPool<T>(operation: (pool: import('pg').Pool) => Promise<T>): Promise<T> {
  const { target, pool } = openDisposableTestPool(process.env.DATABASE_URL, { max: 1 });
  try {
    assertDestructiveTestTargetIsStillSafe(target);
    return await operation(pool);
  } finally {
    await pool.end();
  }
}

async function enableAnalytics(): Promise<void> {
  await withPool(async (pool) => {
    await pool.query('truncate table site_settings');
    await pool.query(
      "insert into site_settings (id, analytics_enabled, analytics_revision) values ('default', true, 1)",
    );
  });
}

async function resetAnalytics(): Promise<void> {
  await withPool(async (pool) => {
    await pool.query('truncate table site_settings');
  });
}

type GaState = {
  consent: string | null;
  scriptCount: number;
  dataLayer: DataLayerEntry[];
  gaDisabled: boolean;
  cookies: string;
};

async function gaState(page: Page): Promise<GaState> {
  return page.evaluate((measurementId) => {
    const dataLayer = Array.isArray(window.dataLayer)
      ? (window.dataLayer as unknown as unknown[][])
      : [];
    return {
      consent: window.localStorage.getItem('nokmel.analytics-consent.v1'),
      scriptCount: document.querySelectorAll('script[data-nokmel-ga]').length,
      dataLayer,
      gaDisabled:
        (window as unknown as Record<string, unknown>)[
          `ga-disable-${measurementId}`
        ] === true,
      cookies: document.cookie,
    };
  }, MEASUREMENT_ID);
}

function entriesNamed(state: GaState, name: string): DataLayerEntry[] {
  return state.dataLayer.filter((entry) => entry[0] === 'event' && entry[1] === name);
}

test.beforeAll(async () => {
  await enableAnalytics();
});

test.afterAll(async () => {
  await resetAnalytics().catch(() => undefined);
});

test('no tag, dataLayer, cookie or event exists before a consent decision', async ({ page }) => {
  await page.goto(`${BASE}/pricing?utm_source=secret&email=private@example.com`);
  await expect(page.getByTestId('analytics-consent')).toBeVisible();
  const state = await gaState(page);
  expect(state.consent).toBeNull();
  expect(state.scriptCount).toBe(0);
  expect(state.dataLayer).toHaveLength(0);
  expect(state.cookies).not.toContain('_ga=');
  expect(await page.getByTestId('analytics-preferences-toggle').count()).toBe(1);
});

test('declining persists and a declined visitor can change the preference later', async ({
  page,
}) => {
  await page.goto(`${BASE}/pricing`);
  await page.getByTestId('analytics-consent-decline').click();
  await expect(page.getByTestId('analytics-consent')).toHaveCount(0);

  let state = await gaState(page);
  expect(state.consent).toBe('denied');
  expect(state.scriptCount).toBe(0);
  expect(state.dataLayer).toHaveLength(0);

  await page.reload();
  state = await gaState(page);
  expect(state.consent).toBe('denied');
  expect(state.scriptCount).toBe(0);
  expect(state.dataLayer).toHaveLength(0);

  await page.getByTestId('analytics-preferences-toggle').click();
  await expect(page.getByTestId('analytics-preferences-status')).toContainText(
    'التحليلات مرفوضة حالياً',
  );
  await page.getByTestId('analytics-preferences-grant').click();

  await expect.poll(async () => (await gaState(page)).scriptCount).toBe(1);
  state = await gaState(page);
  expect(state.consent).toBe('granted');
  expect(entriesNamed(state, 'page_view')).toHaveLength(1);
});

test('accepting enables sanitized configured tracking without query strings', async ({
  page,
}) => {
  await page.goto(
    `${BASE}/pricing?utm_source=secret&email=private@example.com&phone=%2B201000000000`,
  );
  await page.getByTestId('analytics-consent-accept').click();

  await expect.poll(async () => (await gaState(page)).scriptCount).toBe(1);
  await expect
    .poll(async () => entriesNamed(await gaState(page), 'page_view').length)
    .toBe(1);

  const state = await gaState(page);
  const pageView = entriesNamed(state, 'page_view')[0];
  const params = pageView?.[2] as Record<string, unknown>;
  expect(params.page_location).toBe(`${BASE}/pricing`);
  expect(String(params.page_location)).not.toContain('utm_source');
  expect(String(params.page_location)).not.toContain('private@example.com');
  expect(String(params.page_location)).not.toContain('201000000000');

  const configEntry = state.dataLayer.find((entry) => entry[0] === 'config');
  const config = configEntry?.[2] as Record<string, unknown>;
  expect(config.send_page_view).toBe(false);
  expect(config.allow_google_signals).toBe(false);
  expect(config.allow_ad_personalization_signals).toBe(false);

  const pageDefaults = state.dataLayer
    .filter((entry) => entry[0] === 'set')
    .map((entry) => entry[1] as Record<string, unknown>)
    .find((entry) => typeof entry?.page_location === 'string');
  expect(pageDefaults?.page_location).toBe(`${BASE}/pricing`);
  expect(String(pageDefaults?.page_location)).not.toContain('utm_source');

  await page
    .locator('header')
    .getByRole('link', { name: 'الميزات' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/features$/);
  await expect
    .poll(async () => {
      const next = await gaState(page);
      return entriesNamed(next, 'page_view').some(
        (entry) =>
          (entry[2] as Record<string, unknown>).page_location === `${BASE}/features`,
      );
    })
    .toBe(true);
});

test('withdrawal stops future events, applies consent/disable semantics, clears cookies, and reload is safe', async ({
  page,
  context,
}) => {
  await page.goto(`${BASE}/pricing`);
  await page.getByTestId('analytics-consent-accept').click();
  await expect.poll(async () => (await gaState(page)).scriptCount).toBe(1);
  await expect
    .poll(async () => entriesNamed(await gaState(page), 'page_view').length)
    .toBe(1);

  await context.addCookies([
    { name: '_ga', value: 'GA1.1.synthetic', domain: '127.0.0.1', path: '/' },
    { name: '_ga_E2ETEST01', value: 'GS1.1.synthetic', domain: '127.0.0.1', path: '/' },
  ]);
  expect((await gaState(page)).cookies).toContain('_ga=');

  await page.getByTestId('analytics-preferences-toggle').click();
  await page.getByTestId('analytics-preferences-deny').click();
  await expect(page.getByTestId('analytics-preferences-status')).toContainText(
    'التحليلات مرفوضة حالياً',
  );

  const afterDeny = await gaState(page);
  expect(afterDeny.consent).toBe('denied');
  expect(afterDeny.gaDisabled).toBe(true);
  expect(afterDeny.cookies).not.toContain('_ga=');
  expect(afterDeny.cookies).not.toContain('_ga_E2ETEST01=');
  expect(
    afterDeny.dataLayer.some(
      (entry) =>
        entry[0] === 'consent' &&
        entry[1] === 'update' &&
        (entry[2] as Record<string, unknown>).analytics_storage === 'denied',
    ),
  ).toBe(true);

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent('nokmel:analytics', {
        detail: { name: 'join_cta_click', from: '/pricing' },
      }),
    );
  });
  await page.waitForTimeout(50);
  expect(entriesNamed(await gaState(page), 'join_cta_click')).toHaveLength(0);

  await page.reload();
  const afterReload = await gaState(page);
  expect(afterReload.consent).toBe('denied');
  expect(afterReload.scriptCount).toBe(0);
  expect(afterReload.dataLayer).toHaveLength(0);
  await page.getByTestId('analytics-preferences-toggle').click();
  await expect(page.getByTestId('analytics-preferences-status')).toContainText(
    'التحليلات مرفوضة حالياً',
  );
});

test('admin and protected routes do not load the public tracker', async ({ page }) => {
  await page.goto(`${BASE}/pricing`);
  await page.getByTestId('analytics-consent-accept').click();
  await expect.poll(async () => (await gaState(page)).scriptCount).toBe(1);

  await page.goto(`${BASE}/admin/login`);
  const adminState = await gaState(page);
  expect(adminState.scriptCount).toBe(0);
  expect(adminState.dataLayer).toHaveLength(0);
  expect(await page.getByTestId('analytics-preferences-toggle').count()).toBe(0);
});
