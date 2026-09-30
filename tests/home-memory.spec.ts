import { expect, test } from '@playwright/test';

test('home memory can pause, resume and turn a page without changing media routes', async ({ page }, testInfo) => {
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect.poll(() => photo.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆自动播放/);
  const pausedSrc = await photo.locator('img').getAttribute('src');
  await page.waitForTimeout(2300);
  await expect(photo.locator('img')).toHaveAttribute('src', pausedSrc!);
  if (testInfo.project.name === 'desktop-chrome') {
    await page.getByRole('button', { name: '下一张照片' }).click();
    await expect.poll(() => photo.locator('img').getAttribute('src')).not.toBe(pausedSrc);
  } else {
    await photo.evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 340 });
      const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 340 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
    await expect.poll(() => photo.locator('img').getAttribute('src')).not.toBe(pausedSrc);
  }
  await expect(page).toHaveURL(/\/wangleyou\/$/);
});

test('reduced motion turns pages without a flip overlay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await photo.click();
  if (await page.getByRole('button', { name: '下一张照片' }).isVisible()) {
    await page.getByRole('button', { name: '下一张照片' }).click();
  } else {
    await photo.evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 340 });
      const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 340 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
  }
  await expect(page.locator('[class*="flip"]')).toHaveCount(0);
});

test('normal motion flips a full-size page and releases the overlay', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls make the flip lifecycle deterministic');
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await photo.click();
  const original = await photo.evaluate(element => ({ width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight }));
  await page.getByRole('button', { name: '下一张照片' }).click();
  const flipping = page.getByTestId('book-turning-page');
  await expect(flipping).toBeVisible();
  const overlay = await flipping.evaluate(element => ({ width: (element as HTMLElement).offsetWidth, height: (element as HTMLElement).offsetHeight }));
  expect(Math.abs(overlay.width - original.width)).toBeLessThan(2);
  expect(Math.abs(overlay.height - original.height)).toBeLessThan(2);
  await page.waitForTimeout(350);
  const pageBounds = await photo.boundingBox();
  const turnBounds = await flipping.boundingBox();
  expect(Math.abs(turnBounds!.x - pageBounds!.x)).toBeLessThan(2);
  expect(Math.abs(turnBounds!.y - pageBounds!.y)).toBeLessThan(2);
  expect(turnBounds!.width).toBeLessThanOrEqual(pageBounds!.width + 2);
  await expect(flipping).toHaveCSS('overflow', 'hidden');
  await expect(flipping).toHaveCount(0);
});

test('each turn removes a real right page and the final text page stops playback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls give a deterministic page count');
  await page.goto('./');
  await page.getByTestId('home-memory-photo').click();
  const pages = page.locator('[data-book-page]');
  await expect(pages).toHaveCount(4);
  for (const remaining of [3, 2, 1]) {
    await page.getByRole('button', { name: '下一张照片' }).click();
    await expect(pages).toHaveCount(remaining);
    if (remaining === 3) {
      await page.waitForTimeout(330);
      await page.screenshot({ path: '/private/tmp/book-turn-mid-desktop.png' });
    }
    await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  }
  await expect(page.getByTestId('home-memory-ending')).toContainText('想念的时候，随时回来看看');
  await page.screenshot({ path: '/private/tmp/book-ending-desktop.png' });
  await expect(page.getByRole('button', { name: '主回忆播放已结束' })).toBeDisabled();
  await page.getByRole('button', { name: '上一张照片' }).click();
  await expect(page.getByTestId('home-memory-ending')).toBeVisible();
  await expect(page.getByTestId('home-memory-photo')).toHaveCount(0);
  await page.waitForTimeout(330);
  await page.screenshot({ path: '/private/tmp/book-turn-back-mid-desktop.png' });
  await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  await expect(pages).toHaveCount(2);
  await expect(page.getByTestId('home-memory-photo')).toBeVisible();
});

test('mobile swipe reaches the ending page without restarting', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', 'Mobile swipe is the primary control');
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await photo.click();
  for (let index = 0; index < 3; index += 1) {
    await page.locator('[class*="_stack_"]').evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 340 });
      const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 340 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
    if (index === 0) {
      await page.waitForTimeout(380);
      await page.screenshot({ path: '/private/tmp/book-turn-mid-mobile.png', fullPage: true });
    }
    await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  }
  await expect(page.locator('[data-book-page]')).toHaveCount(1);
  await expect(page.getByTestId('home-memory-ending')).toBeVisible();
  await page.screenshot({ path: '/private/tmp/book-ending-mobile.png', fullPage: true });
  await page.waitForTimeout(2300);
  await expect(page.getByTestId('home-memory-ending')).toBeVisible();
});

test('automatic playback stops on the ending page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop pointer stays outside the memory hover pause area');
  await page.goto('./');
  await expect(page.getByTestId('home-memory-ending')).toBeVisible({ timeout: 11000 });
  await page.waitForTimeout(2300);
  await expect(page.getByTestId('home-memory-ending')).toBeVisible();
  await expect(page.locator('[data-book-page]')).toHaveCount(1);
});

test('leaving during a turn cancels it and a fresh home starts on the first page', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls start a deterministic turn');
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await photo.click();
  const first = await photo.locator('img').getAttribute('src');
  await page.getByRole('button', { name: '下一张照片' }).click();
  await expect(page.getByTestId('book-turning-page')).toBeVisible();
  await page.getByRole('link', { name: /浏览全部影像/ }).click();
  await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(photo.locator('img')).toHaveAttribute('src', first!);
});
