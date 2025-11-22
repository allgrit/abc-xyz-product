const { test, expect } = require('@playwright/test');

async function closeOnboardingIfVisible(page) {
  const overlay = page.locator('#abcOnboarding');
  try {
    await overlay.waitFor({ state: 'visible', timeout: 3000 });
  } catch (err) {
    // overlay did not show up — nothing to close
  }
  if (await overlay.isVisible().catch(() => false)) {
    await page.locator('#abcOnboardingClose').click();
    await expect(overlay).toBeHidden();
  }
}

test.describe('ABC/XYZ демо', () => {
  test('главная страница показывает основной хиро-блок', async ({ page }) => {
    await page.goto('/index.html');

    await expect(page.getByRole('heading', { name: 'Forecast NOW! • ABC/XYZ анализ спроса' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Запустить ABC/XYZ анализ' })).toBeVisible();

    const heroSection = page.locator('header');
    await test.info().attach('landing-hero', {
      body: await heroSection.screenshot(),
      contentType: 'image/png'
    });
    await expect(heroSection).toBeVisible();
  });

  test('демо-анализ строит матрицу и визуализации', async ({ page }) => {
    await page.goto('/index.html');

    await page.getByRole('button', { name: /демо-данные/i }).click();
    await closeOnboardingIfVisible(page);
    await expect(page.locator('#abcPreviewTable tbody tr')).not.toHaveCount(0, { timeout: 20000 });
    await closeOnboardingIfVisible(page);

    await page.locator('#abcSkuSelect').selectOption({ label: 'SKU' });
    await page.locator('#abcDateSelect').selectOption({ label: 'Дата продажи' });
    await page.locator('#abcQtySelect').selectOption({ label: 'Объём продажи' });

    await page.getByRole('button', { name: /Запустить анализ/i }).click();

    const matrixCell = page.locator('#abcMatrixTable td[data-cell="AX"]');
    await expect(matrixCell).toHaveText(/SKU/, { timeout: 30000 });
    const treemap = page.locator('#abcTreemap');
    await expect(treemap.locator('.treemap-surface')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#abcResultTable tbody tr').first()).toBeVisible();
    await expect.soft(page.locator('#abcStatus')).toContainText(/обработано SKU/i);

    const analysisView = page.locator('.abc-view[data-view="analysis"]');
    await test.info().attach('analysis-results', {
      body: await analysisView.screenshot(),
      contentType: 'image/png'
    });
    await expect(analysisView).toBeVisible();
  });
});
