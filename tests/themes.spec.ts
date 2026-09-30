import { expect, test } from '@playwright/test';

test('old theme preferences cannot revive removed themes', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.setItem('wangleyou.theme', 'grassland'));
  await page.reload();
  await expect(page.getByTestId('book-home')).toBeVisible();
  await expect(page.getByTestId('theme-switch')).toHaveCount(0);
  await expect(page.locator('[data-theme]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('wangleyou.theme'))).toBe('grassland');
});
