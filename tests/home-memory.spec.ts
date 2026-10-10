import { expect, test } from '@playwright/test';
import type { Locator, Route } from '@playwright/test';

test('home memory can pause, resume and turn a page without changing media routes', async ({ page }, testInfo) => {
  await page.goto('./');
  const initialURL = page.url();
  const photo = page.getByTestId('home-memory-photo');
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆自动播放/);
  const pausedSrc = await photo.locator('img').first().getAttribute('src');
  await page.waitForTimeout(2300);
  await expect(photo.locator('img').first()).toHaveAttribute('src', pausedSrc!);
  if (testInfo.project.name === 'desktop-chrome') {
    await page.getByRole('button', { name: '下一张照片' }).click();
    await expect.poll(() => photo.locator('img').first().getAttribute('src')).not.toBe(pausedSrc);
  } else {
    await photo.evaluate(element => {
      const start = new Touch({ identifier: 1, target: element, clientX: 270, clientY: 340 });
      const end = new Touch({ identifier: 1, target: element, clientX: 80, clientY: 340 });
      element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
      element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
    });
    await expect.poll(() => photo.locator('img').first().getAttribute('src')).not.toBe(pausedSrc);
  }
  await expect(page).toHaveURL(initialURL);
});

test('reduced motion turns pages without a transition overlay', async ({ page }) => {
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
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
});

async function swipePage(stack: Locator, direction: -1 | 1) {
  await stack.evaluate((element, direction) => {
    const start = new Touch({ identifier: 1, target: element, clientX: direction === 1 ? 270 : 80, clientY: 340 });
    const end = new Touch({ identifier: 1, target: element, clientX: direction === 1 ? 80 : 270, clientY: 340 });
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }));
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }));
  }, direction);
}

for (const viewport of [
  { width: 1440, height: 1000, touch: false },
  { width: 360, height: 800, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 844, height: 390, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 820, height: 1180, touch: true },
  { width: 1180, height: 820, touch: true },
]) {
  test(`whole paper pivots safely in both directions at ${viewport.width}x${viewport.height}`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Matrix uses independent desktop and touch contexts');
    const context = await browser.newContext({ viewport, hasTouch: viewport.touch, isMobile: viewport.touch });
    const page = await context.newPage();
    await page.goto(String(testInfo.project.use.baseURL));
    const photo = page.getByTestId('home-memory-photo');
    await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await photo.click();
    const original = await photo.boundingBox();
    const heading = await page.locator('#home-title').boundingBox();
    const stack = page.locator('[class*="_stack_"]');
    const transition = page.getByTestId('home-photo-transition');
    if (viewport.width > 700) await expect(page.getByRole('button', { name: '下一张照片' })).toBeVisible();
    else await expect(page.getByRole('button', { name: '下一张照片' })).toBeHidden();
    for (const direction of [1, -1] as const) {
      if (viewport.touch) await swipePage(stack, direction);
      else await page.getByRole('button', { name: direction === 1 ? '下一张照片' : '上一张照片' }).click();
      await expect(transition).toHaveAttribute('data-phase', 'moving');
      await expect(transition).toHaveAttribute('data-direction', String(direction));
      await expect(transition.locator('img')).toHaveCount(1);
      await expect(transition.locator('svg')).toHaveCount(0);
      await expect(transition).toHaveCSS('overflow', 'visible');
      const motion = await stack.evaluate((element, direction) => {
        const animations = element.getAnimations({ subtree: true });
        const animation = animations[0];
        animation.pause();
        const effect = animation.effect as KeyframeEffect;
        const target = effect.target as HTMLElement;
        const samples = [0, 250, 450, 700, 899].map(time => {
          animation.currentTime = time;
          const box = target.getBoundingClientRect();
          return { left: box.left, right: box.right, opacity: Number(getComputedStyle(target).opacity), scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };
        });
        animation.currentTime = 450;
        return {
          count: animations.length,
          duration: effect.getTiming().duration,
          direction: effect.getTiming().direction,
          origin: getComputedStyle(target).transformOrigin,
          frames: effect.getKeyframes().map(frame => frame.transform),
          targetIsFront: target.dataset.bookPage === 'front',
          snapshotParentIsStack: element.querySelector('[data-testid="home-photo-transition"]')?.parentElement === element,
          samples,
          incomingOpacity: direction === 1 ? getComputedStyle(element.querySelector('[data-book-page="front"]')!).opacity : null,
        };
      }, direction);
      expect(motion.count).toBe(1);
      expect(motion.duration).toBe(900);
      expect(motion.direction).toBe(direction === 1 ? 'normal' : 'reverse');
      expect(motion.origin).toBe('0px 0px');
      expect(motion.targetIsFront).toBe(direction === -1);
      expect(motion.snapshotParentIsStack).toBe(true);
      expect(motion.frames.every(frame => /^rotate\(/.test(String(frame)))).toBe(true);
      const maxAngle = Number(String(motion.frames[2]).match(/rotate\((.+)deg\)/)![1]);
      expect(maxAngle).toBeGreaterThan(0);
      expect(maxAngle).toBeLessThanOrEqual(28);
      if (viewport.width <= 820) expect(maxAngle).toBeLessThan(28);
      for (const sample of motion.samples) {
        expect(sample.left).toBeGreaterThanOrEqual(7);
        expect(sample.right).toBeLessThanOrEqual(viewport.width + 1);
        expect(sample.scrollWidth).toBeLessThanOrEqual(sample.clientWidth);
      }
      if (direction === 1) {
        expect(motion.incomingOpacity).toBe('1');
        expect(await photo.boundingBox()).toEqual(original);
        expect(motion.samples.at(-1)!.opacity).toBeLessThan(.01);
      } else expect(motion.samples[0].opacity).toBe(0);
      expect(await page.locator('#home-title').boundingBox()).toEqual(heading);
      await stack.evaluate(element => element.getAnimations({ subtree: true }).forEach(animation => animation.play()));
      await expect(transition).toHaveCount(0);
      expect(await stack.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
      expect(await photo.boundingBox()).toEqual(original);
    }
    await context.close();
  });
}

test('cancelled touch and vertical gestures do not turn a page; a fresh swipe still works', async ({ page }) => {
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await photo.click();
  const initial = await photo.locator('img').first().getAttribute('src');
  const stack = page.locator('[class*="_stack_"]');
  await stack.evaluate(element => {
    const dispatch = (type: string, x: number, y: number) => {
      const touch = new Touch({ identifier: 1, target: element, clientX: x, clientY: y });
      element.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchstart' ? [touch] : [], changedTouches: [touch] }));
    };
    dispatch('touchstart', 270, 340);
    dispatch('touchcancel', 250, 340);
    dispatch('touchend', 80, 340);
    dispatch('touchstart', 270, 340);
    dispatch('touchend', 80, 650);
  });
  await expect(photo.locator('img').first()).toHaveAttribute('src', initial!);
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
  await swipePage(stack, 1);
  await expect(photo.locator('img').first()).not.toHaveAttribute('src', initial!);
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
  await swipePage(stack, -1);
  await expect(photo.locator('img').first()).toHaveAttribute('src', initial!);
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
});

for (const viewport of [{ width: 360, height: 800 }, { width: 820, height: 1180 }]) {
  test(`resize during motion releases the turn at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Matrix controls its own viewport');
    await page.setViewportSize(viewport);
    await page.goto('./');
    const photo = page.getByTestId('home-memory-photo');
    await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await photo.click();
    const initial = await photo.locator('img').first().getAttribute('src');
    const stack = page.locator('[class*="_stack_"]');
    await swipePage(stack, 1);
    const transition = page.getByTestId('home-photo-transition');
    await expect(transition).toHaveAttribute('data-phase', 'moving');
    await stack.evaluate(element => element.getAnimations({ subtree: true }).forEach(animation => animation.pause()));
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
    await expect(transition).toHaveCount(0);
    expect(await stack.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    await swipePage(stack, -1);
    await expect(transition).toHaveAttribute('data-phase', 'moving');
    await expect(photo.locator('img').first()).toHaveAttribute('src', initial!);
    await expect(transition).toHaveCount(0);
  });
}

test('each turn removes a real right page and the final text page stops playback', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls give a deterministic page count');
  await page.goto('./');
  await page.getByTestId('home-memory-photo').click();
  const pages = page.locator('[data-book-page]');
  await expect(pages).toHaveCount(4);
  for (const remaining of [3, 2, 1]) {
    await page.getByRole('button', { name: '下一张照片' }).click();
    await expect(pages).toHaveCount(remaining);
    await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
  }
  await expect(page.getByTestId('home-memory-ending')).toContainText('想念的时候，随时回来看看');
  await expect(page.getByTestId('home-memory-ending')).not.toHaveAttribute('role', 'status');
  await expect(page.getByTestId('home-memory-ending')).not.toHaveAttribute('aria-live', /.+/);
  await expect(page.getByRole('button', { name: '主回忆播放已结束' })).toBeDisabled();
  await page.getByRole('button', { name: '上一张照片' }).click();
  await expect(page.getByTestId('home-memory-photo')).toBeVisible();
  await expect(page.getByTestId('home-photo-transition')).toContainText('想念的时候，随时回来看看');
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
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
    await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
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
  const first = await photo.locator('img').first().getAttribute('src');
  await page.getByRole('button', { name: '下一张照片' }).click();
  await expect(page.getByTestId('home-photo-transition')).toBeVisible();
  await page.getByRole('link', { name: /浏览全部影像/ }).click();
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(photo.locator('img').first()).toHaveAttribute('src', first!);
});


test('synthetic foreground resume takes one click and preserves an independent manual pause', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect(photo.locator('img').first()).toBeVisible();
  const visibility = async (hidden: boolean) => page.evaluate(hidden => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => hidden ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
  const first = await photo.locator('img').first().getAttribute('src');
  await visibility(true);
  await visibility(false);
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
  await page.waitForTimeout(2300);
  await expect(photo.locator('img').first()).toHaveAttribute('src', first!);
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /暂停主回忆/);
  await expect.poll(() => photo.locator('img').first().getAttribute('src'), { timeout: 4000 }).not.toBe(first);
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
  const paused = await photo.locator('img').first().getAttribute('src');
  await visibility(true);
  await visibility(false);
  await page.waitForTimeout(2300);
  await expect(photo.locator('img').first()).toHaveAttribute('src', paused!);
  await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
});

test('a page turn reuses the displayed candidate and image failure preserves the paper frame', async ({ page }) => {
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect(photo.locator('img').first()).toBeVisible();
  await photo.click();
  const selected = await photo.locator('img').first().evaluate(node => (node as HTMLImageElement).currentSrc);
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
  await expect(page.getByTestId('home-photo-transition').locator('img')).toHaveAttribute('src', selected);
  await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
  await expect(photo.locator('img').first()).toBeVisible();
  await photo.locator('img').first().evaluate(node => node.dispatchEvent(new Event('error')));
  await expect(photo.getByRole('status')).toContainText('影像暂时无法加载');
  const failedBounds = await photo.boundingBox();
  expect(Math.abs(failedBounds!.width - bounds!.width)).toBeLessThan(1);
  expect(Math.abs(failedBounds!.height - bounds!.height)).toBeLessThan(1);
});


test('a slow incoming photo holds the displayed snapshot and locks repeated turns until it loads', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls verify repeated turn intent');
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await photo.click();
  const displayed = await photo.locator('img').first().evaluate(image => (image as HTMLImageElement).currentSrc);
  let held: Route | undefined;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*.webp', async route => {
    if (route.request().url() === displayed) return route.continue();
    held = route;
    await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: '下一张照片' }).click();
  const transition = page.getByTestId('home-photo-transition');
  await expect.poll(() => Boolean(held)).toBe(true);
  await expect(transition).toHaveAttribute('data-phase', 'waiting');
  await expect(transition.locator('img')).toHaveAttribute('src', displayed);
  await expect(transition.locator('div').first()).toHaveCSS('opacity', '1');
  const incoming = await photo.locator('img').first().getAttribute('src');
  await page.getByRole('button', { name: '下一张照片' }).click();
  await page.getByRole('button', { name: '上一张照片' }).click();
  await page.waitForTimeout(900);
  await expect(photo.locator('img').first()).toHaveAttribute('src', incoming!);
  await expect(transition).toHaveAttribute('data-phase', 'waiting');
  release();
  await expect(transition).toHaveCount(0);
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '上一张照片' }).click();
  await expect(transition).toHaveCount(0);
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).currentSrc)).toBe(displayed);
});

test('failed and timed-out incoming photos release the transition and allow another turn', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls verify recovery intent');
  await page.goto('./');
  const photo = page.getByTestId('home-memory-photo');
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await photo.click();
  const displayed = await photo.locator('img').first().evaluate(image => (image as HTMLImageElement).currentSrc);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/*.webp', async route => {
    if (route.request().url() === displayed) return route.continue();
    await gate;
    await route.abort();
  });
  await page.getByRole('button', { name: '下一张照片' }).click();
  const transition = page.getByTestId('home-photo-transition');
  await expect(transition).toHaveAttribute('data-phase', 'waiting');
  await expect(transition).toHaveCount(0, { timeout: 6500 });
  await expect(photo.getByTestId('media-skeleton')).toBeVisible();
  release();
  await expect(photo.getByRole('status')).toContainText('影像暂时无法加载');
  await page.getByRole('button', { name: '上一张照片' }).click();
  await expect(transition).toHaveCount(0);
  await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  // A fresh outgoing snapshot also releases promptly when the next request fails.
  await page.getByRole('button', { name: '下一张照片' }).click();
  await expect(photo.getByRole('status')).toContainText('影像暂时无法加载');
  await expect(transition).toHaveCount(0);
  await page.getByRole('button', { name: '上一张照片' }).click();
  await expect(photo.locator('img').first()).toBeVisible();
});

for (const interruption of ['reduced motion', 'hidden document'] as const) {
  test(`changing to ${interruption} during motion cancels animations and releases navigation`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'Desktop controls start and pause the animation deterministically');
    await page.goto('./');
    const photo = page.getByTestId('home-memory-photo');
    await expect.poll(() => photo.locator('img').first().evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await photo.click();
    await page.getByRole('button', { name: '下一张照片' }).click();
    const transition = page.getByTestId('home-photo-transition');
    await expect(transition).toHaveAttribute('data-phase', 'moving');
    await transition.evaluate(element => element.parentElement!.getAnimations({ subtree: true }).forEach(animation => animation.pause()));
    if (interruption === 'reduced motion') await page.emulateMedia({ reducedMotion: 'reduce' });
    else await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(transition).toHaveCount(0);
    expect(await photo.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
    const target = await photo.locator('img').first().getAttribute('src');
    if (interruption === 'hidden document') await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.getByRole('button', { name: '上一张照片' }).click();
    await expect(transition).toHaveCount(0);
    await expect(photo.locator('img').first()).not.toHaveAttribute('src', target!);
    await expect(photo).toHaveAttribute('aria-label', /继续主回忆/);
  });
}

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
    await expect(photo.locator('img').first()).toBeVisible();
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
    await expect(page.getByTestId('home-photo-transition').locator('img')).toHaveAttribute('src', home.currentSrc);
    await expect(page.getByTestId('home-photo-transition')).toHaveCount(0);
    await expect(photo.locator('img').first()).toBeVisible();
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
