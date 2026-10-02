import { expect, test } from '@playwright/test';

test('home memory can pause, resume and turn a page without changing media routes', async ({ page }, testInfo) => {
  await page.goto('./');
  const initialURL = page.url();
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
  await expect(page).toHaveURL(initialURL);
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
    await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  }
  await expect(page.getByTestId('home-memory-ending')).toContainText('想念的时候，随时回来看看');
  await expect(page.getByTestId('home-memory-ending')).not.toHaveAttribute('role', 'status');
  await expect(page.getByTestId('home-memory-ending')).not.toHaveAttribute('aria-live', /.+/);
  await expect(page.getByRole('button', { name: '主回忆播放已结束' })).toBeDisabled();
  await page.getByRole('button', { name: '上一张照片' }).click();
  await expect(page.getByTestId('home-memory-ending')).toBeVisible();
  await expect(page.getByTestId('home-memory-photo')).toHaveCount(0);
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
    await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  }
  await expect(page.locator('[data-book-page]')).toHaveCount(1);
  await expect(page.getByTestId('home-memory-ending')).toBeVisible();
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


test('synthetic foreground resume takes one click and preserves an independent manual pause', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect(photo.locator('img')).toBeVisible();
  const visibility = async (hidden: boolean) => page.evaluate(hidden => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  const first = await photo.locator('img').getAttribute('src');
  await visibility(true);
  await visibility(false);
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
  await page.waitForTimeout(2300);
  await expect(photo.locator('img')).toHaveAttribute('src', first!);
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /暂停主回忆/);
  await expect.poll(() => photo.locator('img').getAttribute('src'), { timeout: 4000 }).not.toBe(first);
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
  const paused = await photo.locator('img').getAttribute('src');
  await visibility(true);
  await visibility(false);
  await page.waitForTimeout(2300);
  await expect(photo.locator('img')).toHaveAttribute('src', paused!);
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
});

test('a page turn reuses the displayed candidate and image failure preserves the paper frame', async ({ page }) => {
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect(photo.locator('img')).toBeVisible();
  await photo.click();
  const selected = await photo.locator('img').evaluate(node => (node as HTMLImageElement).currentSrc);
  const bounds = await photo.boundingBox();
  const turn = async () => {
    if (await page.getByRole('button', { name: '下一张照片' }).isVisible()) await page.getByRole('button', { name: '下一张照片' }).click();
    else await photo.evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 340 });
      const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 340 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
  };
  await turn();
  await expect(page.getByTestId('book-turning-page').locator('image')).toHaveAttribute('href', selected);
  await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
  await expect(photo.locator('img')).toBeVisible();
  await photo.locator('img').evaluate(node => node.dispatchEvent(new Event('error')));
  await expect(photo.getByRole('status')).toContainText('影像暂时无法加载');
  const failedBounds = await photo.boundingBox();
  expect(Math.abs(failedBounds!.width - bounds!.width)).toBeLessThan(1);
  expect(Math.abs(failedBounds!.height - bounds!.height)).toBeLessThan(1);
});


test('cold responsive candidates match the home and index frames across width and DPR', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'The matrix creates its own cold browser contexts');
  test.setTimeout(90000);
  const records: unknown[] = [];
  for (const width of [390, 820, 1440]) for (const dpr of [1, 2, 3]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr });
    const page = await context.newPage();
    const responses = new Map<string, Promise<number>>();
    const requests: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'image') requests.push(request.url()); });
    page.on('response', response => {
      if (response.request().resourceType() === 'image') responses.set(response.url(), response.body().then(body => body.length, () => 0));
    });
    await page.goto(String(testInfo.project.use.baseURL));
    const photo = page.getByTestId('home-memory-photo');
    await expect(photo.locator('img')).toBeVisible();
    await photo.click();
    const snapshot = async (selector: string, target = page) => target.locator(selector).first().evaluate(node => {
      const image = node as HTMLImageElement;
      const box = image.getBoundingClientRect();
      return { currentSrc: image.currentSrc, width: box.width, height: box.height, srcset: image.srcset, sizes: image.sizes };
    });
    const home = await snapshot('[data-testid="home-memory-photo"] img');
    expect(home.srcset).toMatch(/480w/);
    if (dpr === 1) expect(home.currentSrc).not.toMatch(/\.(1600|2560)\.webp$/);
    const before = requests.length;
    if (await page.getByRole('button', { name: '下一张照片' }).isVisible()) await page.getByRole('button', { name: '下一张照片' }).click();
    else await photo.evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 340 });
      const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 340 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
    await expect(page.getByTestId('book-turning-page').locator('image')).toHaveAttribute('href', home.currentSrc);
    await expect(page.getByTestId('book-turning-page')).toHaveCount(0);
    await expect(photo.locator('img')).toBeVisible();
    const turnRequests = requests.slice(before);
    expect(turnRequests.filter(url => url === home.currentSrc)).toHaveLength(0);
    if (dpr === 1) expect(turnRequests.some(url => /\.(1600|2560)\.webp$/.test(url))).toBe(false);
    const indexContext = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: dpr });
    const indexPage = await indexContext.newPage();
    const indexResponses = new Map<string, Promise<number>>();
    indexPage.on('response', response => {
      if (response.request().resourceType() === 'image') indexResponses.set(response.url(), response.body().then(body => body.length, () => 0));
    });
    await indexPage.goto(`${testInfo.project.use.baseURL}#/albums`);
    const cover = '[class*="coverLayerFront"] img';
    await expect(indexPage.locator(cover).first()).toBeVisible();
    const index = await snapshot(cover, indexPage);
    expect(index.srcset).toMatch(/480w/);
    if (dpr === 1 && index.width < 480) expect(index.currentSrc).toMatch(/\.480\.webp$/);
    const homeBytes = await responses.get(home.currentSrc);
    const indexBytes = await indexResponses.get(index.currentSrc);
    expect(homeBytes).toBeGreaterThan(0);
    expect(indexBytes).toBeGreaterThan(0);
    if (width === 390 && dpr === 1) expect(homeBytes).toBeLessThan(320208);
    records.push({ width, dpr, home: { ...home, bytes: homeBytes }, index: { ...index, bytes: indexBytes }, turnRequests });
    await indexContext.close();
    await context.close();
  }
  await testInfo.attach('cold-responsive-network.json', { body: JSON.stringify(records, null, 2), contentType: 'application/json' });
});
