import { expect, test } from '@playwright/test';

test('book home fits the viewport and keeps keyboard access to memory', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const photo = page.getByTestId('home-memory-photo');
  await photo.focus();
  await expect(photo).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆自动播放/);
  if (testInfo.project.name === 'mobile-chrome') {
    await expect(page.getByRole('link', { name: /浏览全部影像/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '上一张照片' })).toBeHidden();
  }
});
