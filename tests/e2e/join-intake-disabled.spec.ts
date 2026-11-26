import { expect, test } from '@playwright/test';

/**
 * Intake-disabled browser coverage on the dedicated 3200 server. The form must
 * remain non-submitting and the server route must reject even a direct POST.
 * No database is required for this project.
 */
test.describe('join intake disabled state', () => {
  test('form is visibly disabled and direct submissions are rejected', async ({
    page,
    request,
  }) => {
    await page.goto('/join');
    await expect(page.getByTestId('join-intake-notice')).toContainText('غير مفعّل');
    const inputs = page.getByTestId('join-form').locator('input, textarea');
    await expect(inputs).toHaveCount(4);
    for (const input of await inputs.all()) {
      await expect(input).toBeDisabled();
    }
    await expect(page.getByTestId('join-form').getByRole('button', { name: 'اطلب الانضمام' })).toBeDisabled();
    await expect(page.getByTestId('join-selected-plan-context')).toHaveCount(0);

    const response = await request.post('/api/join', {
      headers: {
        origin: 'http://127.0.0.1:3200',
        'content-type': 'application/json',
      },
      data: {
        name: 'تاجر معطّل',
        phone: '+201000000001',
        source: 'direct',
        submissionToken: 'disabled-intake-token-1234567890',
      },
    });
    expect(response.status()).toBe(403);
    const body = (await response.json()) as { ok: boolean; code: string };
    expect(body.ok).toBe(false);
    expect(body.code).toBe('intake_disabled');

    await page.setViewportSize({ width: 390, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({
      path: 'test-results/screenshots/w4-join-disabled-390.png',
      fullPage: true,
    });
  });
});
