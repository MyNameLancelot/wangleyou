import { test, expect } from '@playwright/test';
import type { CDPSession, Page } from '@playwright/test';
import { openFirst, viewerAt, pressViewerKey, stepViewer, firstPhoto } from './support';

async function swipe(page: Page, cdp: CDPSession, dx: number, dy = 0, cancel = false) {
  const box = (await page.locator('.yarl__thumbnails_container').boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 5, y: y + dy * i / 5 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350); // 官方导航动画/节流结束后再开始下一次手势。
}

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 820, height: 1180 }]) {
  test(`thumbnail touch navigation and lifecycle ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await openFirst(page);
    await swipe(page, cdp, 70);
    await viewerAt(page, 1); // 首项不回绕。
    await swipe(page, cdp, -70);
    await viewerAt(page, 2);
    await swipe(page, cdp, 70);
    await viewerAt(page, 1);
    await swipe(page, cdp, -70, 0, true);
    await swipe(page, cdp, 3, -40);
    await swipe(page, cdp, 5);
    const strip = (await page.locator('.yarl__thumbnails_container').boundingBox())!;
    const x = strip.x + strip.width / 2;
    const y = strip.y + strip.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x, y }, { id: 2, x: x + 20, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: x - 70, y }, { id: 2, x: x - 50, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(350);
    await viewerAt(page, 1);
    await page.getByRole('button', { name: '收起缩略图' }).click();
    await page.getByRole('button', { name: '展开缩略图' }).click();
    await swipe(page, cdp, -70);
    await viewerAt(page, 2);
    await page.locator('.yarl__thumbnails_thumbnail[aria-label="第 3 项，共 8 项"]').click();
    await viewerAt(page, 3);
    await stepViewer(page, 5);
    await swipe(page, cdp, -70);
    await viewerAt(page, 8); // 末项不回绕。
    await pressViewerKey(page, 'Escape');
    await page.getByRole('button', { name: firstPhoto }).click();
    await swipe(page, cdp, -70);
    await viewerAt(page, 2); // 重新打开后没有遗留监听导致多翻。
    await cdp.detach();
  });
}

test('browser safe area keeps toolbar and thumbnails reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 48, right: 20, bottom: 24, left: 0 } });
  await openFirst(page);
  const button = page.getByRole('button', { name: '进入全屏' });
  const box = (await button.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(48);
  expect(box.x + box.width).toBeLessThanOrEqual(370);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.yarl__thumbnails_container')).toHaveCSS('padding-bottom', '40px');
  await button.click();
  await expect(page.locator('.yarl__toolbar')).toBeHidden();
  await page.evaluate(() => document.exitFullscreen());
  await expect(button).toBeVisible();
  await cdp.detach();
});
