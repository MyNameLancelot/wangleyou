import { expect, test } from '@playwright/test';

test('hash routes remain directly accessible under the repository subpath', async ({ page }) => {
  await page.goto('./#/browse');
  await expect(page.getByRole('heading', { name: '留影', level: 1 })).toBeVisible();
  await page.goto('./#/albums/2024-05-sequence00');
  await expect(page.getByRole('heading', { name: '破壳', level: 1 })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '破壳', level: 1 })).toBeVisible();
});
