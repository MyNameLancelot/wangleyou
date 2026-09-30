import { expect, test } from '@playwright/test';

test('single book theme presents the approved home and keeps browsing available', async ({ page }, testInfo) => {
  await page.goto('./');
  const home = page.getByTestId('book-home');
  await expect(home.getByRole('heading', { name: '把日子，一页页翻开' })).toBeVisible();
  await expect(home.getByText('那些珍贵的时光，慢慢再看一遍')).toBeVisible();
  await expect(home.getByRole('link', { name: /浏览全部影像/ })).toHaveAttribute('href', '#/browse');
  await expect(page.getByTestId('theme-switch')).toHaveCount(0);
  const photo = page.getByTestId('home-memory-photo');
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const box = await photo.boundingBox();
  expect(box).not.toBeNull();
  expect((box?.width ?? 0) / (box?.height ?? 1)).toBeCloseTo(1.5, 1);
  await page.screenshot({ path: `/private/tmp/book-home-${testInfo.project.name}.png`, fullPage: true });
  if (testInfo.project.name === 'mobile-chrome') {
    const titleLines = await home.locator('h1 span').evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().top)));
    expect(titleLines).toHaveLength(2);
    expect(titleLines[1]).toBeGreaterThan(titleLines[0]);
    await expect(home.getByRole('button', { name: '上一张照片' })).toBeHidden();
    await expect(home.getByRole('button', { name: '下一张照片' })).toBeHidden();
    await expect(home.getByRole('button', { name: /主回忆自动播放/ })).toHaveCount(1);
  } else {
    await expect(home.getByRole('button', { name: '上一张照片' })).toBeVisible();
    await photo.click();
    const before = await photo.getByRole('img').getAttribute('src');
    await home.getByRole('button', { name: '下一张照片' }).click();
    await expect.poll(() => photo.getByRole('img').getAttribute('src')).not.toBe(before);
  }
  await home.getByRole('link', { name: /浏览全部影像/ }).click();
  await expect(page).toHaveURL(/#\/browse$/);
  await expect(page.getByRole('heading', { name: '留影', level: 1 })).toBeVisible();
  await page.screenshot({ path: `/private/tmp/book-browse-${testInfo.project.name}.png` });
  if (testInfo.project.name === 'desktop-chrome') {
    await page.setViewportSize({ width: 1920, height: 430 });
    await page.screenshot({ path: '/private/tmp/book-browse-wide-chrome.png' });
  }
  console.log(`${testInfo.project.name}: ${page.viewportSize()?.width}x${page.viewportSize()?.height}; ${page.context().browser()?.version()}`);
});
