import { expect, test } from '@playwright/test';

test('background music stays dormant without a control or audio element', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('music-controls')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(0);
  await page.getByRole('link', { name: /浏览全部影像/ }).click();
  await expect(page).toHaveURL(/#\/browse$/);
  await expect(page.locator('audio')).toHaveCount(0);
});
