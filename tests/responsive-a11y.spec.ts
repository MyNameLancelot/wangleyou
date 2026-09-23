import { test, expect } from '@playwright/test';
import {
  albumId,
  albumTitle,
  enterAlbum,
  firstPhoto,
  routeDistMedia,
  setTheme,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('responsive layout and real image loading',async({page},testInfo)=>{
  await page.goto('./');
  const heroMedia=page.locator('[data-home-section="hero"] > div > div[aria-hidden="true"]');
  await expect(heroMedia).toBeVisible();
  const heroBackground=await heroMedia.evaluate(element=>getComputedStyle(element).backgroundImage);
  expect(heroBackground).toMatch(/media\/themes\/beach\/home-hero\.webp/);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/media/themes/beach/home-hero.webp')))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for (const item of await page.getByRole('img').all()) {
    await item.scrollIntoViewIfNeeded();
    await expect.poll(()=>item.evaluate((img:HTMLImageElement)=>img.complete && img.naturalWidth>0)).toBe(true);
  }
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.screenshot({path:`test-results/${testInfo.project.name}-home.png`,fullPage:true});
  await enterAlbum(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/${testInfo.project.name}-album.png`,fullPage:true});
});

test('interactive targets are at least 44px and pages never scroll horizontally', async ({page}) => {
  for (const route of ['#/','#/browse','#/albums',`#/albums/${albumId}`]) {
    await page.goto(`./${route}`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${route} 不应横向溢出`).toBe(true);
  }
  const tooSmall = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input[type="range"]'));
    return nodes
      .filter(node => node.offsetParent !== null && node.getBoundingClientRect().top >= 0)
      .map(node => {
        const rect = node.getBoundingClientRect();
        return { label: (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 24), w: Math.round(rect.width), h: Math.round(rect.height) };
      })
      .filter(item => item.h > 0 && (item.h < 44 || item.w < 44));
  });
  expect(tooSmall).toEqual([]);
});

test('reduced motion collapses durations and focus ring stays visible', async ({page}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const duration = await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--motion-standard-duration').trim());
  expect(duration).toBe('1ms');
  const music = page.getByTestId('music-toggle');
  // 任何手势前保持未播放视觉
  await expect(music.locator('[data-music-muted-mark]')).toBeVisible();
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    const style = getComputedStyle(element);
    return { width: parseFloat(style.outlineWidth), style: style.outlineStyle };
  });
  expect(outline).not.toBeNull();
  expect(outline!.style).toBe('solid');
  expect(outline!.width).toBeGreaterThanOrEqual(3);
  // 首次键盘交互（Tab）即恢复音乐：blocked 保留播放意图，任意首手势直接重试播放
  await expect(music).toHaveAttribute('data-playing', 'true');
  const glyph = music.locator('[data-music-glyph]');
  expect(await glyph.evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(0.001);
  expect(await music.locator('[data-music-surface]').evaluate(node => ({
    before: getComputedStyle(node, '::before').content,
    after: getComputedStyle(node, '::after').content,
  }))).toEqual({before: 'none', after: 'none'});
});

test('thumbnail focus has no outline in either theme while keyboard opening remains available', async ({page}) => {
  for (const theme of ['beach', 'grassland'] as const) {
    await page.goto(`./#/albums/${albumId}`);
    await setTheme(page, theme);
    const thumbnail = page.getByRole('button', {name: firstPhoto});
    await thumbnail.focus();
    const focusStyle = await thumbnail.evaluate(element => {
      const thumb = element.querySelector<HTMLElement>('[class*="mediaThumb"]')!;
      const button = getComputedStyle(element);
      const image = getComputedStyle(thumb);
      return {
        focused: element.matches(':focus-visible'),
        outlineStyle: button.outlineStyle,
        outlineColor: button.outlineColor,
        innerShadow: image.boxShadow,
        filter: button.filter,
        transform: button.transform,
      };
    });
    expect(focusStyle.focused).toBe(true);
    expect(focusStyle.outlineStyle).toBe('none');
    expect(focusStyle.outlineColor).not.toMatch(/217, 96, 68|168, 86, 55/);
    expect(focusStyle.innerShadow).toBe('none');
    // 去掉描边后必须有替代焦点指示：聚焦时提亮并上浮
    expect(focusStyle.filter).toContain('brightness');
    expect(focusStyle.transform).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('media skeletons resolve into real images', async ({page}) => {
  await page.goto('./#/browse');
  const skeletons = page.getByTestId('media-skeleton');
  await expect(skeletons).toHaveCount(0, { timeout: 10000 });
  const broken = await page.evaluate(() => Array.from(document.images).filter(img => img.complete && img.naturalWidth === 0).length);
  expect(broken).toBe(0);
});

for (const theme of ['beach', 'grassland'] as const) {
  test(`review: ${theme} skip link keeps the current route`, async ({page}) => {
  await page.goto(`./#/albums/${albumId}`);
  await setTheme(page, theme);
  const before = page.url();
  const skip = page.getByRole('link', {name: '跳到主要内容'});
  await skip.focus();
  await skip.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  expect(page.url()).toBe(before);
  await expect(page.getByRole('heading', {name: albumTitle, level: 1})).toBeVisible();
  });
}
