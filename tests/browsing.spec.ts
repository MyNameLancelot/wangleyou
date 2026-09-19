import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
const firstPhoto = '查看照片：听海的声音';
async function enterAlbum(page: Page) {
  await page.goto('./#/albums/summer-days');
  await expect(page.getByRole('heading', {name:'把夏天装进口袋',level:1})).toBeVisible();
}
async function openFirst(page: Page) {
  await enterAlbum(page);
  await page.getByRole('button', { name: firstPhoto }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
}
test('homepage, album, original photo, keyboard and focus restoration', async ({page}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', {level:1})).toContainText('把有海风的日子');
  await page.evaluate(()=>localStorage.setItem('wangleyou.lastPlayed','legacy-value'));
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory.getByRole('heading', {name:'主回忆', level:2})).toBeVisible();
  await expect(memory.getByRole('button', {name:'暂停主回忆'})).toBeVisible();
  await expect(memory.getByRole('button', {name:'上一张照片'})).toBeVisible();
  await expect(memory.getByRole('button', {name:'下一张照片'})).toBeVisible();
  await expect(memory.getByRole('progressbar')).toBeVisible();
  await page.getByRole('link',{name:'查看相册：把夏天装进口袋'}).click();
  await expect(page.getByRole('heading',{name:'把夏天装进口袋',level:1})).toBeVisible();
  const trigger=page.getByRole('button',{name:firstPhoto}); await trigger.click();
  const dialog=page.getByRole('dialog'); await expect(dialog.getByRole('img')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'上一项'})).toBeDisabled();
  await page.keyboard.press('ArrowRight'); await expect(dialog).toContainText('2 / 3');
  await page.keyboard.press('ArrowRight'); await expect(dialog).toContainText('3 / 3');
  await expect(dialog.getByRole('button',{name:'下一项'})).toBeDisabled();
  await page.keyboard.press('ArrowRight'); await expect(dialog).toContainText('3 / 3');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('navigation',{name:'面包屑'}).getByRole('link',{name:'首页'}).click();
  await expect(page.getByRole('heading',{name:'把有海风的日子，留在这里。'})).toBeVisible();
  await expect(page.locator('[data-home-section="hero"]').getByRole('button',{name:'继续播放'})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('wangleyou.lastPlayed'))).toBe('legacy-value');
  expect(errors).toEqual([]);
});
test('subpath refresh, invalid routes and empty albums',async({page})=>{
  expect((await page.request.get('./albums/missing')).status()).toBe(404);
  await enterAlbum(page); await page.reload();
  await expect(page.getByRole('heading',{name:'把夏天装进口袋',level:1})).toBeVisible();
  await page.goto('./#/albums/next-adventure');
  await expect(page.getByRole('heading',{name:'下一段故事，还在路上'})).toBeVisible();
  await expect(page.getByRole('button',{name:/查看照片/})).toHaveCount(0);
  for(const route of ['#/albums/missing','#/albums/%E0%A4%A','#/unknown']) {
    await page.goto(`./${route}`);
    await expect(page.getByRole('heading',{name:'没有找到这个相册'})).toBeVisible();
  }
});
test('image failure can be retried without leaving the viewer',async({page})=>{
  await page.route('**/media/seaside.jpg',route=>route.abort());
  await enterAlbum(page); await page.getByRole('button',{name:firstPhoto}).click();
  await expect(page.getByText('这张照片暂时无法加载')).toBeVisible();
  await page.unroute('**/media/seaside.jpg');
  await page.getByRole('button',{name:'重新加载'}).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await expect(page.getByText('这张照片暂时无法加载')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog')).toContainText('2 / 3');
});
test('rapid switching isolates slow image errors, close/reopen resets session',async({page})=>{
  await page.route('**/media/forest.jpg',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.abort();});
  await openFirst(page);
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  const dialog=page.getByRole('dialog'); await expect(dialog).toContainText('3 / 3');
  await expect(dialog.getByRole('img')).toHaveAttribute('src',/lake.jpg$/);
  await expect(dialog.getByRole('img')).toBeVisible();
  await page.waitForTimeout(400); await expect(page.getByText('这张照片暂时无法加载')).toHaveCount(0);
  await page.getByRole('button',{name:'关闭查看器'}).click();
  await page.getByRole('button',{name:firstPhoto}).click(); await expect(page.getByRole('dialog')).toContainText('1 / 3');
});
test('dialog focus stays modal and route navigation disposes it',async({page})=>{
  await openFirst(page);
  for(let i=0;i<8;i++) {await page.keyboard.press('Tab'); expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true);}
  await page.evaluate(()=>{location.hash='#/';});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});
test('responsive layout and real image loading',async({page},testInfo)=>{
  await page.goto('./');
  const heroMedia=page.locator('[data-home-section="hero"] > div > div[aria-hidden="true"]');
  await expect(heroMedia).toBeVisible();
  const heroBackground=await heroMedia.evaluate(element=>getComputedStyle(element).backgroundImage);
  expect(heroBackground).toMatch(/beach-home-hero-2k\.webp/);
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').some(entry=>entry.name.includes('/media/theme/beach-home-hero-2k.webp')))).toBe(true);
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
test('horizontal swipe navigates, vertical swipe does not',async({page,isMobile})=>{
  test.skip(!isMobile,'Touch interaction on mobile project');
  await openFirst(page);
  const image=page.getByRole('dialog').getByRole('img');
  await image.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:250,clientY:250}]});
  await image.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:80,clientY:260}]});
  await expect(page.getByRole('dialog')).toContainText('2 / 3');
  const next=page.getByRole('dialog').getByRole('img');
  await next.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:170,clientY:250}]});
  await next.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:165,clientY:500}]});
  await expect(page.getByRole('dialog')).toContainText('2 / 3');
});

test('fullscreen enters and is released on close',async({page,isMobile})=>{
  test.skip(isMobile,'Native fullscreen is platform-dependent on mobile');
  await openFirst(page);
  await page.getByRole('button',{name:'全屏查看'}).click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  await page.getByRole('button',{name:'关闭查看器'}).click();
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
});

test('fullscreen rejection leaves normal viewing usable', async ({page,isMobile}) => {
  test.skip(isMobile, 'Fullscreen control is capability-dependent on mobile');
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied')); });
  await openFirst(page);
  await page.getByRole('button',{name:'全屏查看'}).click();
  await expect(page.getByText('全屏暂不可用，仍可在此查看')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog')).toContainText('2 / 3');
});

test('video plays, pauses, keeps playing intent, and lists captions', async ({page}) => {
  await page.goto('./#/albums/little-weekend');
  await page.getByRole('button',{name:'播放视频：周末的一小段'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('4 / 4');
  await expect(dialog.getByRole('slider',{name:'播放进度'})).toBeVisible();
  await expect(page.locator('video track[kind="captions"]')).toHaveCount(1);

  const video=page.locator('video');
  if (await dialog.getByRole('button',{name:'播放',exact:true}).isVisible().catch(()=>false)) {
    await dialog.getByRole('button',{name:'播放',exact:true}).click();
  }
  await expect.poll(()=>video.evaluate((element:HTMLVideoElement)=>!element.paused)).toBe(true);
  await expect.poll(async()=>Number(await dialog.getByRole('slider',{name:'播放进度'}).inputValue())).toBeGreaterThan(0);

  await dialog.getByRole('button',{name:'暂停'}).click();
  await expect.poll(()=>video.evaluate((element:HTMLVideoElement)=>element.paused)).toBe(true);
  await expect(dialog.getByRole('button',{name:'播放',exact:true})).toBeVisible();

  const continuous=dialog.getByRole('button',{name:/连续播放/});
  await expect(continuous).toHaveAttribute('aria-pressed','true');
  await continuous.click();
  await expect(continuous).toHaveAttribute('aria-pressed','false');

  await page.keyboard.press('ArrowLeft');
  await expect(dialog).toContainText('3 / 4');
  await expect(dialog.getByRole('slider',{name:'播放进度'})).toHaveCount(0);
});

test('theme switch keeps page, media and playback context', async ({page}) => {
  await page.goto('./#/albums/summer-days');
  await page.getByRole('button',{name:firstPhoto}).click();
  const dialog=page.getByRole('dialog');
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toContainText('2 / 3');

  const before=await page.evaluate(()=>document.documentElement.dataset.theme);
  await dialog.getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(before);
  await expect(dialog).toContainText('2 / 3');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(()=>location.hash)).toBe('#/albums/summer-days');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'把夏天装进口袋',level:1})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(before);
});

test('year navigation and type filter work on the browse page', async ({page}) => {
  await page.goto('./#/browse');
  await expect(page.getByRole('heading',{name:'全部影像',level:1})).toBeVisible();
  await expect(page.getByText('全部 7')).toBeVisible();
  await expect(page.getByText('视频 1')).toBeVisible();
  await page.getByRole('button',{name:'视频 1'}).click();
  await expect(page.getByRole('button',{name:/播放视频/})).toHaveCount(1);
  await expect(page.getByRole('button',{name:/查看照片/})).toHaveCount(0);
  await page.getByRole('button',{name:'照片 6'}).click();
  await expect(page.getByRole('button',{name:/播放视频/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('interactive targets are at least 44px and pages never scroll horizontally', async ({page}) => {
  for (const route of ['#/','#/browse','#/albums','#/albums/little-weekend']) {
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
});

test('media skeletons resolve into real images', async ({page}) => {
  await page.goto('./#/browse');
  const skeletons = page.getByTestId('media-skeleton');
  await expect(skeletons).toHaveCount(0, { timeout: 10000 });
  const broken = await page.evaluate(() => Array.from(document.images).filter(img => img.complete && img.naturalWidth === 0).length);
  expect(broken).toBe(0);
});

test('theme decoration stays decorative and switchable', async ({page}) => {
  await page.goto('./');
  const decor = page.getByTestId('theme-decor');
  await expect(decor).toHaveCount(1);
  expect(await decor.evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('beach');
  await page.getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('grassland');
  await expect(page.getByRole('heading',{level:1})).toContainText('把辽阔的日子');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('beach');
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('beach');
});

test('floating glass theme switch replaces the global header', async ({page}, testInfo) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('./');
  await expect(page.getByRole('navigation', {name: '主导航'})).toHaveCount(0);

  for (const theme of ['beach', 'grassland']) {
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    const dock = page.getByTestId('theme-switch');
    const button = dock.getByRole('button', {name: /切换主题/});
    const surface = dock.locator('[data-theme-switch-surface]');
    const icon = button.locator('[data-theme-switch-icon="cycle"]');
    const label = dock.getByText('主题切换', {exact: true});
    await expect(button).toBeVisible();
    await expect(icon).toBeVisible();
    await expect(page.getByText(/个片刻.*本相册.*内容均为演示/)).toHaveCount(0);
    await page.mouse.move(1, 1);
    await expect.poll(async () => (await surface.boundingBox())?.width ?? 0).toBeCloseTo(32, 0);
    await expect.poll(async () => Number(await label.evaluate(node => getComputedStyle(node).opacity))).toBe(0);

    const dockBox = await dock.boundingBox();
    const collapsedSurface = await surface.boundingBox();
    const iconBox = await icon.boundingBox();
    expect(dockBox?.width).toBeGreaterThanOrEqual(44);
    expect(dockBox?.height).toBeGreaterThanOrEqual(44);
    expect(collapsedSurface?.width).toBeCloseTo(collapsedSurface?.height ?? 0, 0);
    expect(collapsedSurface?.width ?? 0).toBeLessThanOrEqual((iconBox?.width ?? 0) + 14);
    expect(collapsedSurface?.x).toBeGreaterThan(1440 - 220);
    expect(collapsedSurface?.y).toBeGreaterThan(900 - 100);
    await page.waitForTimeout(320);
    await page.screenshot({path: `test-results/${testInfo.project.name}-${theme}-theme-switch-collapsed.png`, clip: {x: 1290, y: 800, width: 140, height: 90}});

    if (testInfo.project.name === 'desktop-chrome') {
      await button.hover();
      await expect.poll(async () => Number(await label.evaluate(node => getComputedStyle(node).opacity))).toBe(1);
      await expect.poll(async () => (await surface.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(104);
      await expect.poll(async () => (await icon.boundingBox())?.width ?? 0).toBeGreaterThan(0);
      await page.waitForTimeout(320);
      await page.screenshot({path: `test-results/${testInfo.project.name}-${theme}-theme-switch-expanded.png`, clip: {x: 1280, y: 800, width: 150, height: 90}});
    }
    await button.focus();
    await expect(button).toBeFocused();
    await expect.poll(async () => Number(await label.evaluate(node => getComputedStyle(node).opacity))).toBe(1);
    await expect.poll(async () => (await surface.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(104);
    expect((await surface.boundingBox())?.width).toBeLessThanOrEqual(122);
    expect((await button.evaluate(node => getComputedStyle(node).outlineStyle))).toBe('solid');
    await button.click();
  }

  await expect(page.getByRole('navigation', {name: '主导航'})).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await page.getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).toBe('grassland');
  await expect(page.getByRole('heading',{level:1})).toContainText('把辽阔的日子');
  await page.goto('./#/browse');
  await expect(page.getByRole('heading',{name:'全部影像',level:1})).toBeVisible();
  await page.goto('./#/albums');
  await expect(page.getByRole('heading',{name:'相册',level:1})).toBeVisible();
  await page.goto('./#/albums/summer-days');
  await expect(page.getByRole('heading',{name:'把夏天装进口袋',level:1})).toBeVisible();
  await page.getByRole('button',{name:firstPhoto}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
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
        await page.getByRole('button',{name:/切换主题/}).click();
      }
    }
  }
});

test('home memory controls and two-screen boundaries stay consistent', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const counter = memory.getByRole('paragraph').filter({hasText:/第 \d+ \/ \d+ 张/});
  await expect(counter).toHaveAttribute('aria-live','off');
  const before = await counter.textContent();
  await memory.getByRole('button',{name:'下一张照片'}).click();
  await expect(counter).not.toHaveText(before || '');
  await memory.getByRole('button',{name:'上一张照片'}).click();
  await expect(counter).toHaveText(before || '');
  await memory.getByRole('button',{name:'暂停主回忆'}).click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  await expect(counter).toHaveAttribute('aria-live','polite');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('wheel input over the theme switch stays in the two-screen flow', async ({page}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '移动模拟不提供真实触控板 wheel 输入');
  await page.goto('./');
  const dock = page.getByTestId('theme-switch');
  const box = await dock.boundingBox();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 1) / 2, (box?.y ?? 0) + (box?.height ?? 1) / 2);
  await page.mouse.wheel(0, 120);
  await expect(page.locator('[data-home-section="memory"]')).toBeInViewport();
  await page.mouse.wheel(0, -120);
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('liquid glass Safari fallback keeps hero content readable', async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'userAgent', {
    configurable: true,
    get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
  }));
  await page.goto('./');
  await expect(page.getByRole('heading',{name:'把有海风的日子，留在这里。'})).toBeVisible();
  await expect(page.getByRole('button',{name:/开启回忆/})).toBeVisible();
  await expect(page.locator('[data-home-section="hero"] svg').first()).toBeAttached();
  await expect(page.locator('[data-home-section="hero"] svg feDisplacementMap')).toHaveCount(0);
  await expect(page.locator('[data-home-section="hero"] svg feTurbulence')).toHaveCount(1);
});
