import { test, expect } from '@playwright/test';
import {
  albumId,
  albumTitle,
  enterAlbum,
  firstPhoto,
  pressViewerKey,
  routeDistMedia,
  setTheme,
  viewerAt,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('display text and images cannot be selected or natively dragged', async ({page}) => {
  await page.goto('./');
  for (const theme of ['beach', 'grassland'] as const) {
    await setTheme(page, theme);
    const heading = page.getByRole('heading', {level: 1});
    expect(await heading.evaluate(element => getComputedStyle(element).userSelect)).toBe('none');

    await enterAlbum(page);
    const image = page.getByRole('button', {name: firstPhoto}).getByRole('img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate(element => {
      const style = getComputedStyle(element);
      return `${style.userSelect}/${style.getPropertyValue('-webkit-user-drag')}`;
    })).toBe('none/none');
  }

  const editableSelection = await page.evaluate(() => {
    const textarea = document.createElement('textarea');
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.append(textarea, editable);
    const result = [getComputedStyle(textarea).userSelect, getComputedStyle(editable).userSelect];
    textarea.remove();
    editable.remove();
    return result;
  });
  expect(editableSelection).toEqual(['text', 'text']);
});

test('viewer has no theme switch and page theme switching keeps route and media', async ({page}) => {
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button',{name:firstPhoto}).click();
  const dialog=page.getByRole('dialog');
  await pressViewerKey(page, 'ArrowRight');
  await viewerAt(page, 2);
  // 查看器内部不提供主题切换；PC 端工具栏只保留幻灯片与全屏（关闭按钮只在手机显示）。
  await expect(dialog.getByRole('button',{name:/切换主题/})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'播放幻灯片'})).toBeVisible();

  await pressViewerKey(page, 'Escape');
  const before=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.getByTestId('theme-switch').getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(before);
  expect(await page.evaluate(()=>location.hash)).toBe(`#/albums/${albumId}`);
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  await page.getByRole('button',{name:firstPhoto}).click();
  await viewerAt(page, 1);
});

test('theme decoration stays decorative and switchable', async ({page}) => {
  await page.goto('./');
  // 海边主题不再渲染背景装饰层
  await expect(page.getByTestId('theme-decor')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('beach');
  await page.getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('grassland');
  await expect(page.getByRole('heading',{level:1})).toContainText('把辽阔的日子');
  // 草原主题保留装饰层，且仍然不拦截指针
  const decor = page.getByTestId('theme-decor');
  await expect(decor).toHaveCount(1);
  expect(await decor.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('beach');
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('beach');
});

test('page theme control scrolls with browse content and the viewer carries no theme switch', async ({page}) => {
  await page.setViewportSize({width: 900, height: 500});
  await page.goto('./#/browse');
  const pageTheme = page.getByTestId('theme-switch');
  await expect(pageTheme).toBeInViewport();
  expect(await pageTheme.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);

  await page.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
  await expect(pageTheme).not.toBeInViewport();

  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
  await expect(pageTheme).toBeInViewport();
  // 留影页现在是相册列表：先进入相册，再从缩略图打开查看器
  await page.getByRole('link', {name: `查看相册：${albumTitle}`}).click();
  await expect(page.getByRole('heading', {name: albumTitle, level: 1})).toBeVisible();
  await page.getByRole('button', {name: firstPhoto}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', {name: /切换主题/})).toHaveCount(0);
  await expect(dialog.getByRole('button', {name: '播放幻灯片'})).toBeVisible();
});

test('theme switch stays fixed only on phone-width browse pages', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await page.goto('./#/browse');
  const phoneTheme = page.getByTestId('theme-switch');
  expect(await phoneTheme.evaluate(node => getComputedStyle(node.parentElement!).position)).toBe('fixed');
  const phoneTop = await phoneTheme.evaluate(node => node.parentElement!.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo({top: 400, behavior: 'instant'}));
  await expect(phoneTheme).toBeInViewport();
  expect(await phoneTheme.evaluate(node => node.parentElement!.getBoundingClientRect().top)).toBe(phoneTop);

  await page.setViewportSize({width: 900, height: 500});
  await page.reload();
  const tabletTheme = page.getByTestId('theme-switch');
  expect(await tabletTheme.evaluate(node => getComputedStyle(node.parentElement!).position)).not.toMatch(/fixed|sticky/);
  await page.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
  await expect(tabletTheme).not.toBeInViewport();

  await page.setViewportSize({width: 360, height: 800});
  await page.goto('./#/albums/2025-05-sequence00');
  const albumTheme = page.getByTestId('theme-switch');
  expect(await albumTheme.evaluate(node => getComputedStyle(node.parentElement!).position)).not.toMatch(/fixed|sticky/);
  // 详情页压缩后，手机上可能已经短到无需滚动：用文档坐标不变来证明按钮随内容滚动。
  const documentOffset = () => albumTheme.evaluate(node => node.parentElement!.getBoundingClientRect().top + window.scrollY);
  const offsetBefore = await documentOffset();
  await page.evaluate(() => window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'}));
  expect(Math.abs(await documentOffset() - offsetBefore)).toBeLessThanOrEqual(1);
  // 相册加入视频后页面变长，滚动距离有限时按钮可能仍露出末尾几像素：
  // 因此先断言它确实随内容上移（文档坐标不变、视口位置更靠上），完全移出视口时再断言不可见。
  const dockAfterScroll = await albumTheme.evaluate(node => {
    const box = node.parentElement!.getBoundingClientRect();
    return { top: Math.round(box.top), bottom: Math.round(box.bottom), scrollY: Math.round(window.scrollY) };
  });
  expect(dockAfterScroll.scrollY).toBeGreaterThan(0);
  expect(dockAfterScroll.top).toBeLessThan(18);
  if (dockAfterScroll.bottom <= 0) {
    await expect(albumTheme).not.toBeInViewport();
  }
});

test('hero glass shows the LeYou eyebrow without any white edge', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('./');
  const heroEyebrow = page.locator('[data-home-section="hero"]').getByText('LeYou • Growing Moments', {exact: true});
  await expect(heroEyebrow).toBeVisible();
  const eyebrowLayout = await heroEyebrow.evaluate(node => {
    const style = getComputedStyle(node);
    return {background: style.backgroundColor, padding: style.paddingLeft, x: node.getBoundingClientRect().x};
  });
  const titleX = await page.locator('#home-title').evaluate(node => node.getBoundingClientRect().x);
  expect(eyebrowLayout.background).toBe('rgba(0, 0, 0, 0)');
  expect(eyebrowLayout.padding).toBe('0px');
  expect(Math.abs(eyebrowLayout.x - titleX)).toBeLessThanOrEqual(1);

  for (const theme of ['beach', 'grassland']) {
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    const glass = page.locator('[data-hero-glass]');
    await expect(glass).toBeVisible();
    const edges = await glass.evaluate(node => {
      const style = getComputedStyle(node);
      return {top: style.borderTopWidth, left: style.borderLeftWidth, shadow: style.boxShadow};
    });
    expect(edges.top).toBe('0px');
    expect(edges.left).toBe('0px');
    expect(edges.shadow).not.toContain('inset');
    await page.getByTestId('theme-switch').getByRole('button', {name: /切换主题/}).click();
  }
});

test('grassland independently renders every route and its viewer', async ({page}) => {
  await page.goto('./');
  await expect(page.getByTestId('background-music')).toHaveAttribute('src', /media\/themes\/beach\/music\.mp3$/);
  await setTheme(page, 'grassland');
  await expect(page.getByRole('heading',{level:1})).toContainText('把辽阔的日子');
  await expect(page.getByTestId('background-music')).toHaveAttribute('src', /media\/themes\/grassland\/music\.mp3$/);
  await page.goto('./#/browse');
  await expect(page.getByRole('heading',{name:'留影',level:1})).toBeVisible();
  await page.goto('./#/albums');
  await expect(page.getByRole('heading',{name:'相册',level:1})).toBeVisible();
  await page.goto(`./#/albums/${albumId}`);
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  await page.getByRole('button',{name:firstPhoto}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.yarl__slide_current').getByRole('img')).toBeVisible();
});

test('both themes fill the approved desktop and mobile viewports', async ({page}) => {
  for (const viewport of [{width:1920,height:1080},{width:2560,height:1440},{width:390,height:844}]) {
    await page.setViewportSize(viewport);
    await page.goto('./');
    await page.evaluate(()=>localStorage.setItem('wangleyou.theme','beach'));
    await page.reload();
    for (const theme of ['beach','grassland']) {
      await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe(theme);
      const sections = page.locator('[data-home-section]');
      await expect(sections).toHaveCount(2);
      for (const section of await sections.all()) {
        const box = await section.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(viewport.height - 1);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      if (theme === 'beach') {
        await expect(page.locator('[data-home-section="hero"] svg').first()).toBeAttached();
        await setTheme(page, 'grassland');
      }
    }
  }
});

for (const theme of ['beach', 'grassland'] as const) {
  test(`review: ${theme} theme switch does not isolate backdrop blur with a wrapper filter`, async ({page}) => {
  await page.goto('./');
  await setTheme(page, theme);
  const dock = page.getByTestId('theme-switch');
  const surface = dock.locator('[data-theme-switch-surface]');
  await expect(dock).toHaveJSProperty('style.filter', '');
  await expect(surface).not.toHaveJSProperty('style.boxShadow', 'none');
  });
}
