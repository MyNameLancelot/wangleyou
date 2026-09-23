import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'node:path';

const albumId = '2024-05-sequence00';
const albumTitle = '破壳';
const firstPhoto = '查看照片：破壳 第 1 张';
/** 破壳相册的公开照片数量：卡片数量角标、查看器位置提示都据此断言。 */
const albumPhotoCount = 8;
const cdnMediaPrefix = 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/';

/**
 * 构建产物仍保留 jsDelivr URL；E2E 从本次构建的 dist/ 提供同一媒体，
 * 使交互测试不依赖第三方 CDN 的网络可达性或缓存状态。
 */
test.beforeEach(async ({page}) => {
  await page.route(`${cdnMediaPrefix}media/**`, route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const mediaPath = pathname.replace('/gh/MyNameLancelot/wangleyou@main/public/', '');
    return route.fulfill({path: join(process.cwd(), 'dist', mediaPath)});
  });
});

/** 不涉及切换控件本身的用例，通过偏好存储直接选择目标主题。 */
async function setTheme(page: Page, theme: 'beach' | 'grassland') {
  await page.evaluate(name => localStorage.setItem('wangleyou.theme', name), theme);
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
}
async function enterAlbum(page: Page) {
  await page.goto(`./#/albums/${albumId}`);
  await expect(page.getByRole('heading', {name:albumTitle,level:1})).toBeVisible();
}
async function openFirst(page: Page) {
  await enterAlbum(page);
  await page.getByRole('button', { name: firstPhoto }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
}
/** 查看器不再显示可见计数器：位置改用 dialog 上的机器可读属性断言。 */
const viewerAt = (page: Page, position: number) => expect(page.getByRole('dialog')).toHaveAttribute('data-media-position', String(position));
test('homepage, album, original photo, keyboard and focus restoration', async ({page, isMobile}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', {level:1})).toContainText('把有海风的日子');
  await page.evaluate(()=>localStorage.setItem('wangleyou.lastPlayed','legacy-value'));
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  if (isMobile) {
    await expect(memory.getByRole('button', {name:'上一张照片'})).toBeHidden();
    await expect(memory.getByRole('button', {name:'下一张照片'})).toBeHidden();
  } else {
    await expect(memory.getByRole('button', {name:'上一张照片'})).toBeVisible();
    await expect(memory.getByRole('button', {name:'下一张照片'})).toBeVisible();
  }
  await expect(memory.getByRole('progressbar',{name:'主回忆进度'})).toBeVisible();
  await page.goto('./#/albums');
  await page.getByRole('link',{name:`查看相册：${albumTitle}`}).click();
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  const trigger=page.getByRole('button',{name:firstPhoto}); await trigger.click();
  const dialog=page.getByRole('dialog'); await expect(dialog.getByRole('img')).toBeVisible();
  if (isMobile) {
    // 移动端只用左右滑动切换，不渲染导航按钮
    await expect(dialog.getByRole('button',{name:'上一项'})).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'下一项'})).toHaveCount(0);
  } else {
    await expect(dialog.getByRole('button',{name:'上一项'})).toBeDisabled();
  }
  await page.keyboard.press('ArrowRight'); await viewerAt(page, 2);
  for (let index = 3; index <= albumPhotoCount; index += 1) await page.keyboard.press('ArrowRight');
  await viewerAt(page, albumPhotoCount);
  if (!isMobile) await expect(dialog.getByRole('button',{name:'下一项'})).toBeDisabled();
  await page.keyboard.press('ArrowRight'); await viewerAt(page, albumPhotoCount);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
  if (isMobile) {
    // 手机端不展示返回入口，回到留影页依赖浏览器返回手势
    await expect(page.getByRole('link',{name:'← 返回留影'})).toBeHidden();
    await page.goto('./#/browse');
  } else {
    await page.getByRole('link',{name:'← 返回留影'}).click();
  }
  await expect(page.getByRole('heading',{name:'留影',level:1})).toBeVisible();
  await page.goto('./#/');
  await expect(page.getByRole('heading',{name:'把有海风的日子，留在这里。'})).toBeVisible();
  await expect(page.locator('[data-home-section="hero"]').getByRole('button',{name:'继续播放'})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('wangleyou.lastPlayed'))).toBe('legacy-value');
  expect(errors).toEqual([]);
});
test('subpath refresh and invalid routes',async({page})=>{
  expect((await page.request.get('./albums/missing')).status()).toBe(404);
  await enterAlbum(page); await page.reload();
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  for(const route of ['#/albums/missing','#/albums/%E0%A4%A','#/unknown']) {
    await page.goto(`./${route}`);
    await expect(page.getByRole('heading',{name:'没有找到这个相册'})).toBeVisible();
  }
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
test('image failure can be retried without leaving the viewer',async({page})=>{
  await page.route('**/media/photos/**/top01.jpg',route=>route.abort());
  await enterAlbum(page); await page.getByRole('button',{name:firstPhoto}).click();
  await expect(page.getByText('这张照片暂时无法加载')).toBeVisible();
  // 状态面板文字属于影像展示：点击它不应关闭查看器，否则用户重试时会误关
  await page.getByText('这张照片暂时无法加载').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.unroute('**/media/photos/**/top01.jpg');
  await page.getByRole('button',{name:'重新加载'}).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await expect(page.getByText('这张照片暂时无法加载')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, 2);
});

test('rapid switching isolates slow image errors, close/reopen resets session',async({page})=>{
  await page.route('**/media/photos/**/002.jpg',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.abort();});
  await openFirst(page);
  await page.keyboard.press('ArrowRight');
  const dialog=page.getByRole('dialog'); await viewerAt(page, 2);
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('img')).toBeVisible();
  await page.waitForTimeout(400); await expect(page.getByText('这张照片暂时无法加载')).toHaveCount(0);
  // 照片模式没有关闭按钮：用 Esc 关闭后重开，确认会话已重置
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:firstPhoto}).click(); await viewerAt(page, 1);
});
test('dialog focus stays modal and route navigation disposes it',async({page})=>{
  await openFirst(page);
  for(let i=0;i<8;i++) {await page.keyboard.press('Tab'); expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog'))).toBe(true);}
  await page.evaluate(()=>{location.hash='#/';});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
});
test('viewer background closes while media and controls remain interactive in both themes', async ({page, isMobile}) => {
  test.skip(isMobile, 'Navigation button is desktop-only');
  for (const theme of ['beach', 'grassland'] as const) {
    await page.goto(`./#/albums/${albumId}`);
    await setTheme(page, theme);
    await page.getByRole('button', {name: firstPhoto}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const stage = dialog.locator('[class*="stage"], [class*="canvas"]').first();
    await stage.click({position: {x: 4, y: 4}});
    await expect(dialog).toHaveCount(0);

    await page.getByRole('button', {name: firstPhoto}).click();
    await expect(dialog).toBeVisible();

    await dialog.getByRole('img').click();
    await expect(dialog).toBeVisible();
    await viewerAt(page, 1);

    await page.getByRole('button', {name: '下一项'}).click();
    await expect(dialog).toBeVisible();
    await viewerAt(page, 2);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
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
test('horizontal swipe navigates, vertical swipe does not',async({page,isMobile})=>{
  test.skip(!isMobile,'Touch interaction on mobile project');
  await openFirst(page);
  const image=page.getByRole('dialog').getByRole('img');
  await image.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:250,clientY:250}]});
  await image.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:80,clientY:260}]});
  await viewerAt(page, 2);
  const next=page.getByRole('dialog').getByRole('img');
  await next.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:170,clientY:250}]});
  await next.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:165,clientY:500}]});
  await viewerAt(page, 2);
});

test('fullscreen enters and is released on close',async({page,isMobile})=>{
  test.skip(isMobile,'Native fullscreen is platform-dependent on mobile');
  await openFirst(page);
  // 图片舞台不显示视频工具，键盘 F 仍可进入全屏。
  await expect(page.getByRole('button',{name:'全屏查看'})).toHaveCount(0);
  await page.keyboard.press('f');
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
  // 照片模式没有关闭按钮，点击黑色背景退出
  await page.getByRole('dialog').locator('[class*="stage"], [class*="canvas"]').first().click({position:{x:4,y:4}});
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
});

test('fullscreen rejection leaves normal viewing usable', async ({page,isMobile}) => {
  test.skip(isMobile, 'Fullscreen control is capability-dependent on mobile');
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error('denied')); });
  await openFirst(page);
  await page.keyboard.press('f');
  await expect(page.getByText('全屏暂不可用，仍可在此查看')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, 2);
});

test('viewer has no theme switch and page theme switching keeps route and media', async ({page}) => {
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button',{name:firstPhoto}).click();
  const dialog=page.getByRole('dialog');
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, 2);
  // 查看器内部不再提供主题切换或关闭按钮：照片模式只保留位置与手动切换，退出靠背景点击与 Esc。
  await expect(dialog.getByRole('button',{name:/切换主题/})).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:'关闭查看器'})).toHaveCount(0);

  await page.keyboard.press('Escape');
  const before=await page.evaluate(()=>document.documentElement.dataset.theme);
  await page.getByTestId('theme-switch').getByRole('button',{name:/切换主题/}).click();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.theme)).not.toBe(before);
  expect(await page.evaluate(()=>location.hash)).toBe(`#/albums/${albumId}`);
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  await page.getByRole('button',{name:firstPhoto}).click();
  await viewerAt(page, 1);
});

test('desktop wheel switches media, stays in bounds and keeps photo controls minimal', async ({page,isMobile}) => {
  test.skip(isMobile, 'Wheel navigation is desktop-only');
  await page.setViewportSize({width:1440,height:1000});
  await openFirst(page);
  const dialog=page.getByRole('dialog');
  await page.mouse.move(720,500);

  // 第一项向上滚动不越界
  await page.mouse.wheel(0,-240);
  await page.waitForTimeout(500);
  await viewerAt(page, 1);

  // 低于阈值的小幅滚动不切换
  await page.mouse.wheel(0,20);
  await page.waitForTimeout(200);
  await viewerAt(page, 1);

  await page.mouse.wheel(0,160);
  await viewerAt(page, 2);
  await page.waitForTimeout(500);
  await page.mouse.wheel(0,-160);
  await viewerAt(page, 1);

  // 图片是静默舞台：没有播放、进度、静音或全屏按钮
  await expect(dialog.getByRole('slider')).toHaveCount(0);
  await expect(dialog.getByRole('button',{name:/播放视频|暂停视频|静音|取消静音|全屏查看/})).toHaveCount(0);
});

test('photo captions come from album metadata and stay optional', async ({page}) => {
  await page.goto('./#/albums/2025-05-sequence00');
  await expect(page.getByRole('heading',{name:'周岁',level:1})).toBeVisible();
  await page.getByRole('button',{name:'查看照片：周岁 第 1 张'}).click();
  const dialog = page.getByRole('dialog');
  const firstCaption = '黄昏把树影拉得很长，我们在这里等天色慢慢暗下来。';
  await expect(dialog.getByText(firstCaption)).toBeVisible();
  // 寄语属于照片展示的一部分：点击寄语不应关闭查看器
  await dialog.getByText(firstCaption).click();
  await expect(dialog).toBeVisible();
  await viewerAt(page, 1);
  // 计数器已移除：位置只保留机器可读属性，界面不再显示 n / m
  expect(await dialog.innerText()).not.toMatch(/\d+\s*\/\s*\d+/);

  // 第 2 张没有寄语：不渲染空文案区
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, 2);
  await expect(dialog.getByText(firstCaption)).toHaveCount(0);

  // 最后一张有寄语：切到最后仍能读到
  for (let index = 3; index <= 8; index += 1) await page.keyboard.press('ArrowRight');
  await viewerAt(page, 8);
  await expect(dialog.getByText('雨后的叶子很重，你伸手去接，像是在等一滴水落下来。')).toBeVisible();
});

test('phone and tablet viewers hide step buttons and give the photo the full width', async ({page}) => {
  for (const [width, height] of [[360, 800], [1024, 768]] as const) {
    await page.setViewportSize({width, height});
    await enterAlbum(page);
    await page.getByRole('button', { name: firstPhoto }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // 手机与平板隐藏切换按钮，只用横向滑动
    await expect(dialog.getByRole('button',{name:'上一项'})).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'下一项'})).toHaveCount(0);

    // 图片舞台不留横向内边距，并延伸至查看器左右边缘
    const geometry = await page.evaluate(() => {
      const shell = document.querySelector('dialog')!;
      const stage = shell.querySelector('[class*="photoStage"], [class*="photoPane"]') as HTMLElement;
      const image = shell.querySelector('img')!;
      const box = (node: Element) => node.getBoundingClientRect();
      const style = getComputedStyle(stage);
      return {
        paddingLeft: style.paddingLeft,
        paddingRight: style.paddingRight,
        stageLeft: box(stage).left,
        stageRight: box(stage).right,
        shellLeft: box(shell).left,
        shellRight: box(shell).right,
        stageWidth: box(stage).width,
        // 照片外框宽度：保持原比例时它是图片实际占用的横向范围
        photoWidth: box(image.parentElement!).width,
        // contain 表示浏览器按原始比例缩放，不做拉伸或裁切
        objectFit: getComputedStyle(image).objectFit,
        photoNaturalRatio: (image as HTMLImageElement).naturalWidth / (image as HTMLImageElement).naturalHeight,
      };
    });
    expect(geometry.paddingLeft).toBe('0px');
    expect(geometry.paddingRight).toBe('0px');
    expect(Math.abs(geometry.stageLeft - geometry.shellLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.stageRight - geometry.shellRight)).toBeLessThanOrEqual(1);
    // 竖屏手机里高度不构成限制，照片宽度必须等于舞台宽度
    if (width === 360) expect(Math.abs(geometry.photoWidth - geometry.stageWidth)).toBeLessThanOrEqual(1);
    expect(geometry.objectFit).toBe('contain');
    expect(geometry.photoNaturalRatio).toBeGreaterThan(1);

    const image = dialog.getByRole('img');
    await image.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:width - 80,clientY:200}]});
    await image.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:80,clientY:210}]});
    await viewerAt(page, 2);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('phone browse list opens the album and its viewer without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await page.goto('./#/browse');
  const grid = page.locator('[class*="browseGrid"]').first();
  await expect(grid).toBeVisible();
  const card = page.getByRole('link', {name: `查看相册：${albumTitle}`});
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(360 - 32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 卡片仍可进入相册详情并从图集打开查看器
  await card.click();
  await expect(page.getByRole('heading', {name: albumTitle, level: 1})).toBeVisible();
  await page.getByRole('button', {name: firstPhoto}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
});

test('phone browse album cards show only the album name with a text-hugging chip', async ({page}) => {
  const measure = () => page.evaluate(() => {
    const card = document.querySelector('a[aria-label^="查看相册"]')!;
    const bar = card.querySelector('[class*="mediaBar"]') as HTMLElement;
    const title = card.querySelector('[class*="mediaAlbum"]') as HTMLElement;
    const text = card.querySelector('[class*="mediaText"]') as HTMLElement;
    return {
      cardWidth: Math.round(card.getBoundingClientRect().width),
      barWidth: Math.round(bar.getBoundingClientRect().width),
      titleWidth: Math.round(title.getBoundingClientRect().width),
      textDisplay: getComputedStyle(text).display,
      titleBorder: getComputedStyle(title).borderRightWidth,
      titleOpacity: getComputedStyle(title).opacity,
    };
  });

  await page.setViewportSize({width: 390, height: 844});
  for (const theme of ['beach', 'grassland'] as const) {
    await page.goto('./#/browse');
    await setTheme(page, theme);
    const phone = await measure();
    // 手机端只渲染相册名，说明文字不渲染
    expect(phone.textDisplay).toBe('none');
    expect(phone.titleBorder).toBe('0px');
    expect(phone.titleOpacity).toBe('1');
    // 底色框贴合文字：宽度约为文字宽加左右内边距，明显小于卡片宽度
    expect(phone.barWidth).toBeGreaterThanOrEqual(phone.titleWidth);
    expect(phone.barWidth - phone.titleWidth).toBeLessThanOrEqual(32);
    expect(phone.barWidth).toBeLessThan(phone.cardWidth);
  }

  // 平板与桌面仍展示相册名与说明文字
  await page.setViewportSize({width: 820, height: 1180});
  await page.reload();
  expect((await measure()).textDisplay).not.toBe('none');
});

test('album detail hero shrinks to two thirds and shows at least four photos on phone and pad', async ({page}) => {
  const measure = () => page.evaluate(() => {
    const hero = document.querySelector('[class*="detailHero"]')!.getBoundingClientRect();
    const grid = document.querySelector('[class*="masonryGrid"]') as HTMLElement;
    const tiles = Array.from(grid.querySelectorAll('[class*="masonryTile"]')) as HTMLElement[];
    const blockquote = document.querySelector('[class*="detailHeroCopy"] blockquote')!;
    return {
      heroHeight: hero.height,
      heroBottom: hero.bottom,
      copyBottom: blockquote.getBoundingClientRect().bottom,
      columns: Number(getComputedStyle(grid).columnCount),
      titleSize: parseFloat(getComputedStyle(document.querySelector('[class*="detailHeroCopy"] h1')!).fontSize),
      fullyVisibleTiles: tiles.filter(tile => tile.getBoundingClientRect().bottom <= window.innerHeight).length,
    };
  });

  for (const theme of ['beach', 'grassland'] as const) {
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto(`./#/albums/${albumId}`);
    await setTheme(page, theme);
    const desktop = await measure();

    // 手机：首幅压到 420 → 280 → 224（再降 1/5），三列让首屏至少完整看到 4 张
    await page.setViewportSize({width: 390, height: 844});
    await page.reload();
    const phone = await measure();
    expect(phone.heroHeight).toBeLessThanOrEqual(225);
    expect(phone.columns).toBe(3);
    expect(phone.fullyVisibleTiles).toBeGreaterThanOrEqual(4);
    expect(phone.copyBottom).toBeLessThanOrEqual(phone.heroBottom);
    expect(phone.titleSize).toBeLessThan(desktop.titleSize);
    // 缩略图容器贴合图片本身，不再用容器底色撑出空白块
    const tileFit = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('[class*="masonryTile"]')) as HTMLElement[];
      return tiles.every(tile => {
        const thumb = tile.querySelector('[class*="mediaThumb"]') as HTMLElement;
        const image = tile.querySelector('img');
        return image ? Math.abs(thumb.getBoundingClientRect().height - image.getBoundingClientRect().height) <= 1 : true;
      });
    });
    expect(tileFit).toBe(true);

    // 平板：首幅 500 → 333 → 266（再降 1/5），三列让首屏至少完整看到 4 张
    await page.setViewportSize({width: 820, height: 1180});
    await page.reload();
    const pad = await measure();
    expect(pad.heroHeight).toBeLessThanOrEqual(267);
    expect(pad.columns).toBe(3);
    expect(pad.fullyVisibleTiles).toBeGreaterThanOrEqual(4);
    expect(pad.copyBottom).toBeLessThanOrEqual(pad.heroBottom);
    expect(pad.titleSize).toBeLessThan(desktop.titleSize);

    // 1024px iPad：沿用平板规则
    await page.setViewportSize({width: 1024, height: 768});
    await page.reload();
    const widePad = await measure();
    // 桌面首幅上限 500px，平板保持其 2/3 上限
    expect(widePad.heroHeight).toBeLessThanOrEqual(334);
    expect(widePad.columns).toBe(3);
    expect(widePad.fullyVisibleTiles).toBeGreaterThanOrEqual(4);
  }
});

test('photo viewer has no close button at phone, tablet and desktop widths in both themes', async ({page}) => {
  for (const theme of ['beach', 'grassland'] as const) {
    for (const [width, height] of [[360, 800], [1024, 768], [1440, 900]] as const) {
      await page.setViewportSize({width, height});
      await page.goto(`./#/albums/${albumId}`);
      await setTheme(page, theme);
      await page.getByRole('button', {name: firstPhoto}).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      // 照片模式三端都不渲染关闭按钮
      await expect(dialog.getByRole('button', {name: '关闭查看器'})).toHaveCount(0);

      // Esc 仍是显式退出入口
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);

      // 黑色背景点击仍是退出入口
      await page.getByRole('button', {name: firstPhoto}).click();
      await expect(dialog).toBeVisible();
      await dialog.locator('[class*="stage"], [class*="canvas"]').first().click({position: {x: 4, y: 4}});
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('heading', {name: albumTitle, level: 1})).toBeVisible();
    }
  }
});

test('year navigation and type filter work on the browse page', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.setViewportSize({width: 1920, height: 1080});
  await page.goto('./#/browse');
  await expect(page.getByRole('heading',{name:'留影',level:1})).toBeVisible();
  await expect(page.getByRole('button',{name:'全部',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'照片',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'视频',exact:true})).toBeVisible();
  // 浏览页不展示任何统计数量、相册快捷入口、排序说明或键盘提示
  await expect(page.getByText(/\d+\s*项/)).toHaveCount(0);
  await expect(page.locator('aside').getByRole('link')).toHaveCount(0);
  await expect(page.getByText('最新优先')).toHaveCount(0);
  await expect(page.getByText('键盘可用方向键')).toHaveCount(0);
  // 缩略图不带演示角标，说明条为紧凑单行
  await expect(page.getByText('演示素材')).toHaveCount(0);
  expect(await page.locator('[class*="mediaBar"]').first().evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(40);
  // 定位栏标题与卡片上的相册名称
  await expect(page.getByRole('heading',{name:'光阴刻度'})).toBeVisible();
  await expect(page.locator('aside').getByRole('button',{name:'2025'})).toBeVisible();
  await expect(page.getByText(albumTitle,{exact:true}).first()).toBeVisible();
  // 留影页按年份倒序聚合；同一年内仍按 YYYY-MM 与 sequenceNN 排列。
  const groups = await page.evaluate(() => Array.from(document.querySelectorAll('section[id^="year-"]')).map(section => ({
    year: section.querySelector('h2')?.textContent?.trim(),
    albums: Array.from(section.querySelectorAll('[class*="mediaTile"]')).map(tile => (tile.getAttribute('aria-label') || '').replace('查看相册：', '')),
  })));
  expect(groups).toEqual([
    { year: '2029 年', albums: ['海边傍晚'] },
    { year: '2028 年', albums: ['周末远足'] },
    { year: '2027 年', albums: ['雨后花园'] },
    { year: '2026 年', albums: ['初夏散步'] },
    { year: '2025 年', albums: ['周岁'] },
    { year: '2024 年', albums: ['破壳', '百日'] },
  ]);
  // 定位栏与 hero 文案同边，网格不贴窗口右边缘
  const layout = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const rail = box('[class*="railCard"]');
    const title = box('#browse-title');
    const grid = box('[class*="browseGrid"]');
    return {
      railLeft: rail?.left ?? 0, titleLeft: title?.left ?? 0, gridRight: grid?.right ?? 0,
      innerWidth: window.innerWidth,
    };
  });
  expect(Math.abs(layout.railLeft - layout.titleLeft)).toBeLessThanOrEqual(1);
  expect(layout.gridRight).toBeLessThan(layout.innerWidth - 100);
  await page.getByRole('button',{name:'照片',exact:true}).click();
  await expect(page.getByRole('button',{name:/播放视频/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

  await page.setViewportSize({width: 360, height: 800});
  await page.reload();
  const mobile = await page.evaluate(() => {
    const pill = document.querySelector('[class*="filterPill"]')!.getBoundingClientRect();
    const title = document.querySelector('#browse-title')!.getBoundingClientRect();
    return { pillLeft: pill.left, titleLeft: title.left, overflow: document.documentElement.scrollWidth <= window.innerWidth };
  });
  expect(Math.abs(mobile.pillLeft - mobile.titleLeft)).toBeLessThanOrEqual(1);
  expect(mobile.overflow).toBe(true);
  const initialGridTop = await page.locator('[class*="browseGrid"]').first().evaluate(node => node.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, 400));
  const fixedHeader = await page.evaluate(() => ({
    heroTop: document.querySelector('[class*="browseHero"]')!.getBoundingClientRect().top,
    yearsTop: document.querySelector('[class*="yearNav"]')!.getBoundingClientRect().top,
    gridTop: document.querySelector('[class*="browseGrid"]')!.getBoundingClientRect().top,
    heroZIndex: Number(getComputedStyle(document.querySelector('[class*="browseHero"]')!).zIndex),
    yearsZIndex: Number(getComputedStyle(document.querySelector('[class*="yearNav"]')!).zIndex),
  }));
  expect(fixedHeader.heroTop).toBe(0);
  expect(fixedHeader.yearsTop).toBe(222);
  expect(fixedHeader.heroZIndex).toBeGreaterThan(fixedHeader.yearsZIndex);
  expect(initialGridTop).toBeGreaterThanOrEqual(322);
  expect(fixedHeader.gridTop).toBeLessThan(initialGridTop);
  const yearNavigation = await page.evaluate(() => {
    const label = document.querySelector('[class*="yearNavLabel"]') as HTMLElement;
    const scroller = document.querySelector('[class*="yearNavScroller"]') as HTMLElement;
    const nav = document.querySelector('[class*="yearNav"]') as HTMLElement;
    const before = label.getBoundingClientRect().left;
    scroller.scrollLeft = 80;
    return {
      labelShift: label.getBoundingClientRect().left - before,
      labelBackground: getComputedStyle(label).backgroundColor,
      navigationBackground: getComputedStyle(nav).backgroundColor,
      shellBackground: getComputedStyle(document.querySelector('main')!.parentElement!).backgroundColor,
    };
  });
  expect(yearNavigation.labelShift).toBe(0);
  expect(yearNavigation.labelBackground).toBe('rgba(0, 0, 0, 0)');
  expect(yearNavigation.navigationBackground).toBe(yearNavigation.shellBackground);
  await page.getByRole('navigation', {name: '年份定位'}).getByRole('button', {name: '2028', exact: true}).click();
  await expect.poll(() => page.locator('#year-2028').evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(306);
});

test('browse hero returns home in both isolated themes', async ({page}) => {
  // 链接本身只在平板与桌面展示，位置与跳转行为在桌面视口核对
  await page.setViewportSize({width: 1440, height: 900});
  for (const theme of ['beach', 'grassland'] as const) {
    await page.goto('./#/browse');
    await setTheme(page, theme);
    const back = page.getByRole('link', {name: '返回首页'});
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', '#/');
    expect(await back.evaluate(element => {
      const heading = document.querySelector('#browse-title')!;
      const link = element.getBoundingClientRect();
      const title = heading.getBoundingClientRect();
      return link.bottom <= title.top && link.height >= 44;
    })).toBe(true);
    await back.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/');
    await expect(page.locator('[data-home-section="hero"]')).toBeVisible();
  }

  await page.goto('./#/browse');
  await page.setViewportSize({width: 360, height: 800});
  const back = page.getByRole('link', {name: '返回首页'});
  // 手机端不展示返回首页入口
  await expect(back).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 平板仍展示返回首页入口，并保持 44px 命中区
  await page.setViewportSize({width: 820, height: 1180});
  await page.reload();
  await expect(back).toBeVisible();
  expect(await back.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

test('phone hides the back links while tablet and desktop keep them', async ({page}) => {
  const browseBack = page.getByRole('link', {name: '返回首页'});
  const detailBack = page.getByRole('link', {name: '← 返回留影'});

  for (const [width, height, visible] of [[360, 800, false], [390, 844, false], [820, 1180, true], [1440, 900, true]] as const) {
    await page.setViewportSize({width, height});
    await page.goto('./#/browse');
    await expect(browseBack)[visible ? 'toBeVisible' : 'toBeHidden']();
    if (visible) expect(await browseBack.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.goto(`./#/albums/${albumId}`);
    await expect(detailBack)[visible ? 'toBeVisible' : 'toBeHidden']();
    if (visible) expect(await detailBack.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    // 手机端文案上移后仍在 hero 内且不产生横向溢出
    expect(await page.evaluate(() => {
      const hero = document.querySelector('[class*="detailHero"]')!.getBoundingClientRect();
      const copy = document.querySelector('[class*="detailHeroCopy"]')!.getBoundingClientRect();
      return copy.top >= hero.top && copy.bottom <= hero.bottom;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('browse album cards stack top covers with depth in both themes', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('./#/browse');

  for (const theme of ['beach', 'grassland'] as const) {
    await setTheme(page, theme);
    const card = page.getByRole('link', {name: `查看相册：${albumTitle}`});
    const stack = card.locator('[data-browse-album-stack]');
    await expect(stack).toHaveAttribute('data-stack', '3');
    await expect(stack.locator('[data-browse-cover]').count()).resolves.toBe(3);
    await expect(stack.locator('[data-browse-cover="front"] img')).toHaveAttribute('src', /top01\.jpg$/);
    await expect(stack.locator('[data-browse-cover="front"] img')).toHaveCSS('object-fit', 'cover');
    await card.hover();
    await expect(stack.locator('[data-browse-cover="front"] img')).toHaveCSS('transform', 'none');

    const layerBox = (layer: string) => stack.locator(`[data-browse-cover="${layer}"]`).evaluate(node => {
      const box = node.getBoundingClientRect();
      return {x: Math.round(box.x), y: Math.round(box.y), border: getComputedStyle(node).borderWidth, shadow: getComputedStyle(node).boxShadow};
    });
    const [front, middle, back] = await Promise.all([layerBox('front'), layerBox('middle'), layerBox('back')]);
    expect(back.x).toBeGreaterThan(middle.x);
    expect(middle.x).toBeGreaterThan(front.x);
    expect(back.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(front.y);
    expect(front.border).toBe('0px');
    expect(middle.border).toBe('0px');
    expect(back.border).toBe('0px');
    expect(front.shadow).toBe('none');
    expect(middle.shadow).toBe('none');
    expect(back.shadow).toBe('none');

    const selectedFilter = page.getByRole('button', {name: '全部', exact: true});
    const railYear = page.locator('aside').getByRole('button', {name: '2025'});
    await railYear.hover();
    const [filterColors, yearColors] = await Promise.all([selectedFilter.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color })), railYear.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }))]);
    expect(yearColors).toEqual(filterColors);
  }

  await page.setViewportSize({width: 360, height: 800});
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('album cards stack up to three photos and show album level metadata', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('./#/albums');
  // 相册级元信息来自 meta.json 的 album 段，不再出现“待续”
  await expect(page.getByText('待续')).toHaveCount(0);
  const card = page.getByRole('link',{name:`查看相册：${albumTitle}`});
  await expect(card).toBeVisible();
  // 相册日期缺省取目录名的年月
  await expect(card).toContainText('2024.05');
  await expect(card).toContainText('小小的你，第一次和我们见面。');
  await expect(card.getByText(`${albumPhotoCount} 个瞬间`)).toBeVisible();
  const layerBox = (kind: string) => card.locator(`[class*="coverLayer${kind}"]`).evaluate(node => {
    const box = node.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
  });
  const [front, mid, back] = await Promise.all([layerBox('Front'), layerBox('Mid'), layerBox('Back')]);
  // 三张照片层叠：后排向右上探出，尺寸一致
  expect(await card.locator('[class*="coverLayer"]').count()).toBe(3);
  expect(back.x).toBeGreaterThan(mid.x);
  expect(mid.x).toBeGreaterThan(front.x);
  expect(back.y).toBeLessThan(mid.y);
  expect(mid.y).toBeLessThan(front.y);
  expect(back.w).toBe(front.w);
  expect(await card.locator('img').count()).toBe(3);
  // 封面保持普通相机横拍的 3:2 比例
  const cover = await card.locator('[data-stack]').evaluate(node => { const box = node.getBoundingClientRect(); return box.width / box.height; });
  expect(Math.abs(cover - 1.5)).toBeLessThan(0.02);
  // 封面按原比例完整显示，不裁切
  await expect(card.locator('[class*="coverLayerFront"] img')).toHaveCSS('object-fit', 'contain');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
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

test('theme switch and background music controls coexist without overlap', async ({page}, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chrome' ? {width: 360, height: 800} : {width: 1440, height: 900};
  await page.setViewportSize(viewport);
  await page.goto('./');
  await expect(page.getByRole('navigation', {name: '主导航'})).toHaveCount(0);

  const music = page.getByTestId('music-toggle');
  const button = music.getByRole('button', {name: /背景音乐/});
  const musicSurface = music.locator('[data-music-surface]');
  const musicGlyph = music.locator('[data-music-glyph]');
  const audio = page.getByTestId('background-music');
  const themeDock = page.getByTestId('theme-switch');
  const themeButton = themeDock.getByRole('button', {name: /切换主题/});
  const themeSurface = themeDock.locator('[data-theme-switch-surface]');
  const themeLabel = themeDock.getByText('主题切换', {exact: true});
  const mutedMark = music.locator('[data-music-muted-mark]');
  await expect(button).toBeVisible();
  await expect(music.locator('[data-music-icon]')).toBeVisible();
  await expect(mutedMark).toBeVisible();
  await expect(music).toHaveAttribute('data-playing', 'false');
  expect(await musicSurface.evaluate(node => getComputedStyle(node, '::after').content)).toBe('none');
  await expect(themeButton).toBeVisible();
  await expect(themeButton.locator('[data-theme-switch-icon="cycle"]')).toBeVisible();
  expect(await music.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);
  expect(await themeDock.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);

  const box = await button.boundingBox();
  const musicSurfaceBox = await musicSurface.boundingBox();
  const themeBox = await themeButton.boundingBox();
  const collapsedSurface = await themeSurface.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(
    ((box?.x ?? 0) + (box?.width ?? 0) / 2) -
    ((themeBox?.x ?? 0) + (themeBox?.width ?? 0) / 2),
  )).toBeLessThanOrEqual(2);
  expect(box?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  expect(box?.y).toBeCloseTo(18, 0);
  expect(musicSurfaceBox?.width).toBeCloseTo(32, 0);
  expect(musicSurfaceBox?.height).toBeCloseTo(32, 0);
  expect(themeBox?.width).toBeGreaterThanOrEqual(44);
  expect(themeBox?.height).toBeGreaterThanOrEqual(44);
  expect(collapsedSurface?.width).toBeCloseTo(32, 0);
  expect(collapsedSurface?.x).toBeGreaterThan(viewport.width - 220);
  expect(collapsedSurface?.y).toBeGreaterThan(viewport.height - 100);
  expect(await themeLabel.evaluate(node => getComputedStyle(node).opacity)).toBe('0');

  await page.mouse.move(1, 1);
  expect(await musicGlyph.evaluate(node => getComputedStyle(node).transform)).toBe('none');
  await button.hover();
  await expect.poll(async () => {
    const transform = await musicGlyph.evaluate(node => getComputedStyle(node).transform);
    return transform === 'none' ? 1 : Number(transform.split('(')[1].split(',')[0]);
  }).toBeCloseTo(1.1, 1);
  await page.mouse.move(1, 1);
  await expect.poll(() => musicGlyph.evaluate(node => getComputedStyle(node).transform)).toBe('none');

  await themeButton.hover();
  await expect.poll(async () => Number(await themeLabel.evaluate(node => getComputedStyle(node).opacity))).toBe(1);
  await expect.poll(async () => (await themeSurface.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(104);
  expect((await themeSurface.boundingBox())?.width).toBeLessThanOrEqual(122);
  await themeButton.focus();
  await expect(themeButton).toBeFocused();
  expect(await themeButton.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');

  expect(await audio.getAttribute('src')).toContain('media/themes/beach/music.mp3');
  await page.waitForTimeout(320);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-music-toggle-hero.png`,
    clip: {x: viewport.width - 150, y: 0, width: 150, height: 135},
  });

  // 播放中滚到第二屏，两个页面控件随第一屏离开，但音乐状态不变
  const initial = await button.getAttribute('aria-pressed');
  await button.click();
  await expect.poll(() => button.getAttribute('aria-pressed')).not.toBe(initial);
  await expect(music).toHaveAttribute('data-playing', 'true');
  await expect(mutedMark).toBeHidden();
  expect(await musicSurface.evaluate(node => ({
    before: getComputedStyle(node, '::before').content,
    after: getComputedStyle(node, '::after').content,
    beforeAnimation: getComputedStyle(node, '::before').animationName,
    afterAnimation: getComputedStyle(node, '::after').animationName,
  }))).toEqual({before: 'none', after: 'none', beforeAnimation: 'none', afterAnimation: 'none'});
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  await page.evaluate(height => window.scrollTo({top: height, behavior: 'instant'}), viewport.height);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(viewport.height - 1);
  await expect(page.locator('[data-home-section="memory"]')).toBeInViewport({ratio: 0.95});
  await expect(music).not.toBeInViewport();
  await expect(themeDock).not.toBeInViewport();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  // 回顶只要求页面能停在第一屏顶部：CI 上 Chrome 曾把程序性回顶的结果改写为 66px / 81px 并稳定数秒，
  // 而诊断用例记录的每次 scroll 事件调用栈都只来自测试自身的 scrollTo，应用侧没有任何滚动写入。
  // 因此这里在同一语义下重发回顶，位置以外的用户可见结果由后续“首屏与两个控件回到视口”断言把关。
  await expect.poll(async () => {
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    return page.evaluate(() => Math.round(scrollY));
  }).toBeLessThanOrEqual(10);
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport({ratio: 0.95});
  await expect(music).toBeInViewport();
  await expect(themeDock).toBeInViewport();

  // 返回第一屏后可以暂停，状态与音频元素一致
  await button.click();
  await expect.poll(() => button.getAttribute('aria-pressed')).toBe(initial);
  await expect(music).toHaveAttribute('data-playing', 'false');
  await expect(mutedMark).toBeVisible();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);
  await themeButton.focus();
  // 每个音乐入口后面跟着自己的音量控件，反向遍历直到回到音乐按钮
  for (let step = 0; step < 5; step += 1) {
    if (await button.evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Shift+Tab');
  }
  await expect(button).toBeFocused();
  expect(await button.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
  await expect.poll(async () => {
    const transform = await musicGlyph.evaluate(node => getComputedStyle(node).transform);
    return transform === 'none' ? 1 : Number(transform.split('(')[1].split(',')[0]);
  }).toBeCloseTo(1.1, 1);
  await expect.poll(async () => {
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    return page.evaluate(() => Math.round(scrollY));
  }).toBeLessThanOrEqual(10);

  // 草原主题拥有同样的独立位置与暂停视觉实现
  await themeButton.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('grassland');
  // 收起状态才比较两个入口的中心线：单击后按钮仍处于悬浮/聚焦展开的过渡中
  await page.mouse.move(2,2);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(250);
  const grasslandMusicBox = await page.getByTestId('music-toggle').getByRole('button', {name: /背景音乐/}).boundingBox();
  const grasslandSurfaceBox = await page.getByTestId('music-toggle').locator('[data-music-surface]').boundingBox();
  // 主题切换会整体重挂载，中心线用轮询等待布局稳定
  await expect.poll(async () => {
    const [musicBox, themeBox] = await Promise.all([
      page.getByTestId('music-toggle').getByRole('button', {name: /背景音乐/}).boundingBox(),
      page.getByTestId('theme-switch').getByRole('button', {name: /切换主题/}).boundingBox(),
    ]);
    return Math.abs(
      ((musicBox?.x ?? 0) + (musicBox?.width ?? 0) / 2) -
      ((themeBox?.x ?? 0) + (themeBox?.width ?? 0) / 2),
    );
  }).toBeLessThanOrEqual(2);
  expect(grasslandMusicBox?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  // 用页面绝对坐标断言顶部间距，避免滚动残留影响几何读数
  const grasslandScrollY = await page.evaluate(() => scrollY);
  expect(Math.abs(((grasslandMusicBox?.y ?? 0) + grasslandScrollY) - 18)).toBeLessThanOrEqual(2);
  expect(grasslandSurfaceBox?.width).toBeCloseTo(32, 0);
  expect(grasslandSurfaceBox?.height).toBeCloseTo(32, 0);
  await expect(page.getByTestId('music-toggle').locator('[data-music-muted-mark]')).toBeVisible();
});

test('two-screen music controls share one audio while theme stays on the first screen', async ({page}, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chrome' ? {width: 360, height: 800} : {width: 1440, height: 900};
  await page.setViewportSize(viewport);
  await page.goto('./');

  const heroMusic = page.locator('[data-music-screen="hero"]');
  const memoryMusic = page.locator('[data-music-screen="memory"]');
  const theme = page.getByTestId('theme-switch');
  const audio = page.getByTestId('background-music');
  await expect(audio).toHaveCount(1);
  await expect(heroMusic).toBeInViewport();
  await expect(memoryMusic).not.toBeInViewport();
  await expect(theme).toBeInViewport();
  expect(await heroMusic.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);
  expect(await memoryMusic.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);

  const heroBox = await heroMusic.boundingBox();
  expect(heroBox?.width).toBeGreaterThanOrEqual(44);
  expect(heroBox?.height).toBeGreaterThanOrEqual(44);
  expect(heroBox?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  expect(heroBox?.y).toBeCloseTo(18, 0);
  await heroMusic.getByRole('button', {name: '播放背景音乐'}).click();
  await expect(heroMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(memoryMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);

  await page.evaluate(height => window.scrollTo({top: height, behavior: 'instant'}), viewport.height);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(viewport.height - 1);
  await expect(heroMusic).not.toBeInViewport();
  await expect(theme).not.toBeInViewport();
  await expect(memoryMusic).toBeInViewport();
  const memoryBox = await memoryMusic.boundingBox();
  expect(memoryBox?.width).toBeGreaterThanOrEqual(44);
  expect(memoryBox?.height).toBeGreaterThanOrEqual(44);
  expect(memoryBox?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  expect(memoryBox?.y).toBeCloseTo(18, 0);
  await heroMusic.getByRole('button').focus();
  // 先到第一屏自己的音量控件，再继续到第二屏的音乐入口
  await page.keyboard.press('Tab');
  await expect(heroMusic.getByRole('slider', {name: '背景音乐音量'})).toBeFocused();
  for (let step = 0; step < 5; step += 1) {
    if (await memoryMusic.getByRole('button').evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(memoryMusic.getByRole('button')).toBeFocused();
  expect(await memoryMusic.getByRole('button').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
  await memoryMusic.getByRole('button', {name: '暂停背景音乐'}).click();
  await expect(memoryMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  await expect(heroMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);

  // 第二屏按钮仍聚焦时，移动端可能在下一帧把视口重新滚回焦点；先释放焦点再回顶。
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // 全局 html { scroll-behavior: smooth } 下，移动端模拟环境用 behavior: 'instant' 回顶会偶发停在
  // 2–10px（第二轮程序化滚动或改用 'auto' 可立即归零）；这里用 'auto' 避免把环境抖动当成产品缺陷。
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'auto'}));
  // 移动端 dvh + scroll-snap 在并行负载下可能残留 1–2px，这里只要求回到首屏顶部
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(4);
  await expect(heroMusic).toBeInViewport();
  await expect(heroMusic.locator('[data-music-muted-mark]')).toBeVisible();
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
  await expect(dialog.getByRole('button', {name: '关闭查看器'})).toHaveCount(0);
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
  if (await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1)) {
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
        await setTheme(page, 'grassland');
      }
    }
  }
});

test('home memory arrows, hover pause and two-screen boundaries stay consistent', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await setTheme(page, 'beach');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  await expect(photo).toBeVisible();
  await expect(memory).toHaveCSS('background-image', /media\/themes\/beach\/home-memory\.webp/);
  await expect(memory.getByRole('button')).toHaveCount(3);
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);
  await expect(memory.getByRole('progressbar',{name:'主回忆进度'})).toHaveCount(1);
  await expect(memory.getByRole('heading',{name:'主回忆'})).toHaveCount(0);
  await expect(memory.getByText(/第 \d+ \/ \d+ 张/)).toHaveCount(0);

  // 照片画框固定 3:2，玻璃底板不带白边
  const frame = await photo.boundingBox();
  expect(Math.abs((frame?.width ?? 0) / (frame?.height || 1) - 1.5)).toBeLessThan(0.02);
  const mat = memory.locator('[data-memory-mat]');
  await expect(mat).toBeVisible();
  const matEdges = await mat.evaluate(node => {
    const style = getComputedStyle(node);
    return {top: style.borderTopWidth, shadow: style.boxShadow};
  });
  expect(matEdges.top).toBe('0px');
  expect(matEdges.shadow).not.toContain('inset');

  await photo.hover();
  const before = await photo.getAttribute('aria-label');
  await memory.getByRole('button',{name:'下一张照片'}).click();
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(before);
  await memory.getByRole('button',{name:'上一张照片'}).click();
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(before);

  // 焦点也需离开；仅移开指针时仍应保持焦点暂停。
  await page.locator('main').focus();
  // 指针停在照片上时暂停自动播放，移开后恢复
  await memory.getByRole('button',{name:'下一张照片'}).hover();
  const held = await photo.getAttribute('aria-label');
  await page.waitForTimeout(4200);
  expect(await photo.getAttribute('aria-label')).toBe(held);
  await page.mouse.move(4,4);
  await expect.poll(()=>photo.getAttribute('aria-label'),{timeout:4500}).not.toBe(held);

  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('home screens meet without a divider and memory controls stay frosted', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  for (const theme of ['beach','grassland'] as const) {
    await setTheme(page, theme);
    // 两屏之间不再渲染 1px 分隔线，也不留缝隙露出页面底色
    const junction = await page.evaluate(() => {
      const hero = document.querySelector('[data-home-section="hero"]')!;
      const memory = document.querySelector('[data-home-section="memory"]')!;
      const edges = (node: Element) => {
        const style = getComputedStyle(node);
        return `${style.borderTopWidth}/${style.borderBottomWidth}`;
      };
      return {
        hero: edges(hero),
        memory: edges(memory),
        gap: memory.getBoundingClientRect().top - hero.getBoundingClientRect().bottom,
      };
    });
    expect(junction.hero).toBe('0px/0px');
    expect(junction.memory).toBe('0px/0px');
    expect(Math.abs(junction.gap)).toBeLessThanOrEqual(1);

    // 交界带用第二屏背景做跨屏淡入；层位在首屏之上、第二屏之下，不覆盖第二屏底板与照片
    const seam = await page.evaluate(() => {
      const layer = document.querySelector('[data-home-seam]') as HTMLElement;
      const style = getComputedStyle(layer);
      const memory = document.querySelector('[data-home-section="memory"]') as HTMLElement;
      return {
        ariaHidden: layer.getAttribute('aria-hidden'),
        pointerEvents: style.pointerEvents,
        mask: style.maskImage || style.webkitMaskImage,
        layerZ: Number(style.zIndex),
        memoryZ: Number(getComputedStyle(memory).zIndex),
      };
    });
    expect(seam.ariaHidden).toBe('true');
    expect(seam.pointerEvents).toBe('none');
    expect(seam.mask).toContain('linear-gradient');
    expect(seam.layerZ).toBeGreaterThan(0);
    expect(seam.memoryZ).toBeGreaterThan(seam.layerZ);

    await page.keyboard.press('ArrowDown');
    const memory = page.locator('[data-home-section="memory"]');
    await expect(memory).toBeInViewport();
    await memory.getByRole('button',{name:/暂停主回忆自动播放/}).click();
    const surfaces = [memory.getByRole('button',{name:'上一张照片'}), memory.getByRole('button',{name:'下一张照片'}), memory.getByRole('button',{name:'继续播放主回忆'}), memory.getByRole('progressbar',{name:'主回忆进度'})];
    for (const surface of surfaces) {
      await expect(surface).toBeVisible();
      const style = await surface.evaluate(node => {
        const computed = getComputedStyle(node);
        return { blur: computed.backdropFilter, background: computed.backgroundColor, border: computed.borderTopWidth };
      });
      expect(style.blur).toContain('blur(');
      expect(style.background).toMatch(/rgba\(\d+, \d+, \d+, 0\.[0-5]/);
      expect(style.border).toBe('0px');
    }
    await page.keyboard.press('ArrowUp');
  }
});

test('home memory photo pauses playback and never opens the viewer', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  await expect(photo).toBeVisible();

  // 点击照片暂停：首页不进入查看器，照片下方出现播放按钮
  await photo.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(photo).toHaveAttribute('aria-label', /^继续主回忆自动播放/);
  const play = memory.getByRole('button',{name:'继续播放主回忆'});
  await expect(play).toBeVisible();
  const playBox = await play.boundingBox();
  expect(playBox?.width).toBeGreaterThanOrEqual(44);
  expect(playBox?.height).toBeGreaterThanOrEqual(44);
  const photoBox = await photo.boundingBox();
  expect(playBox?.y).toBeGreaterThan((photoBox?.y ?? 0) + (photoBox?.height ?? 0) - 2);
  // 键盘顺序聚焦到播放按钮时显示焦点环
  for (let step = 0; step < 10; step += 1) {
    if (await play.evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(play).toBeFocused();
  expect(await play.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');

  // 指针与焦点都离开后暂停状态保持，不再自动前进
  await page.evaluate(()=> (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4,4);
  const paused = await photo.getAttribute('aria-label');
  await page.waitForTimeout(4200);
  expect(await photo.getAttribute('aria-label')).toBe(paused);

  // 播放按钮恢复自动播放并隐藏自身
  await play.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);
  await expect(photo).toHaveAttribute('aria-label', /^暂停主回忆自动播放/);
  await page.evaluate(()=> (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4,4);
  const resumed = await photo.getAttribute('aria-label');
  const resumedAt = Date.now();
  await expect.poll(()=>photo.getAttribute('aria-label'),{timeout:4500}).not.toBe(resumed);
  expect(Date.now() - resumedAt).toBeLessThan(4000);

  // 再次点击照片同样恢复播放，按钮不出现重复入口
  await photo.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  await photo.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);
});

test('mobile memory hides arrows, swipes photos and keeps the two-screen flow', async ({page, isMobile}) => {
  test.skip(!isMobile, '触控滑动只在移动项目验证');
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  await expect(photo).toBeVisible();
  await expect(memory.getByRole('button',{name:'上一张照片'})).toBeHidden();
  await expect(memory.getByRole('button',{name:'下一张照片'})).toBeHidden();
  await expect(memory.getByRole('button')).toHaveCount(1);

  // 点击照片暂停并显示播放按钮，不进入查看器
  await photo.tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  await memory.getByRole('button',{name:'继续播放主回忆'}).tap();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);

  // 第二屏内横向滑动换图
  const before = await photo.getAttribute('aria-label');
  await memory.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:300,clientY:420}]});
  await memory.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:120,clientY:430}]});
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(before);
  const afterSwipe = await photo.getAttribute('aria-label');
  await memory.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:120,clientY:420}]});
  await memory.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:300,clientY:430}]});
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(before);
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);

  // 音乐按钮上的触摸不计入换图
  const music = page.getByTestId('music-toggle');
  await music.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:320,clientY:40}]});
  await music.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:180,clientY:40}]});
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(before);
  await expect(memory).toBeInViewport();
  expect(afterSwipe).not.toBe(before);

  // 纵向滑动仍然切回首屏
  await memory.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:180,clientY:300}]});
  await memory.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:186,clientY:640}]});
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('tablet memory hides arrows and changes photos by horizontal swipe', async ({page, isMobile}) => {
  test.skip(!isMobile, '触控输入由移动项目模拟');
  await page.setViewportSize({width: 768, height: 1024});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  const photo = memory.getByRole('button', {name: /主回忆自动播放/});
  await expect(memory).toBeInViewport();
  await expect(memory.getByRole('button', {name: '上一张照片'})).toBeHidden();
  await expect(memory.getByRole('button', {name: '下一张照片'})).toBeHidden();

  const before = await photo.getAttribute('aria-label');
  await memory.dispatchEvent('touchstart', {touches: [{identifier: 1, clientX: 650, clientY: 480}]});
  await memory.dispatchEvent('touchend', {changedTouches: [{identifier: 1, clientX: 300, clientY: 490}]});
  await expect.poll(() => photo.getAttribute('aria-label')).not.toBe(before);
  await memory.dispatchEvent('touchstart', {touches: [{identifier: 1, clientX: 300, clientY: 480}]});
  await memory.dispatchEvent('touchend', {changedTouches: [{identifier: 1, clientX: 650, clientY: 490}]});
  await expect.poll(() => photo.getAttribute('aria-label')).toBe(before);
});

test('desktop memory switches photos by mouse drag without pausing', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  const play = memory.getByRole('button',{name:'继续播放主回忆'});

  // 先暂停，确保换图只可能来自鼠标拖动
  await photo.click();
  await expect(play).toBeVisible();
  const paused = await photo.getAttribute('aria-label');
  const center = async () => {
    const box = await photo.boundingBox();
    return {x:(box?.x ?? 0) + (box?.width ?? 0) / 2, y:(box?.y ?? 0) + (box?.height ?? 0) / 2};
  };

  // 按住鼠标向左拖动 = 下一张，且不被当作点击
  const start = await center();
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 160,start.y + 6,{steps:6});
  await page.mouse.up();
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(paused);
  await expect(play).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 向右拖动 = 上一张
  const back = await center();
  await page.mouse.move(back.x,back.y);
  await page.mouse.down();
  await page.mouse.move(back.x + 160,back.y + 6,{steps:6});
  await page.mouse.up();
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(paused);
  await expect(play).toBeVisible();

  // 位移不足阈值时仍按点击处理：恢复播放，且不换图
  const small = await center();
  await page.mouse.move(small.x,small.y);
  await page.mouse.down();
  await page.mouse.move(small.x - 20,small.y + 4,{steps:4});
  await page.mouse.up();
  await expect.poll(()=>photo.getAttribute('aria-label')).toMatch(/^暂停主回忆自动播放/);
  await expect(play).toHaveCount(0);
});

test('trackpad horizontal swipe switches memory photos and keeps vertical switching', async ({page}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '移动模拟不提供真实触控板 wheel 输入');
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});

  // 先暂停，换图只可能来自触控板横向滚动
  await photo.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  const paused = await photo.getAttribute('aria-label');
  const progress = memory.getByRole('progressbar',{name:'主回忆进度'});
  const progressState = async () => progress.evaluate(node => ({value:(node as HTMLProgressElement).value, max:(node as HTMLProgressElement).max}));

  // 一次两指滑动会连发多个 wheel 事件（含动量），只应换一张
  const wheelBurst = (deltaX: number, count = 6) => page.evaluate(({deltaX, count}) => {
    for (let index = 0; index < count; index += 1) {
      document.body.dispatchEvent(new WheelEvent('wheel', {deltaX, deltaY:0, bubbles:true, cancelable:true}));
    }
  }, {deltaX, count});

  const before = await progressState();
  await page.mouse.move(720,450);
  await wheelBurst(40);
  await expect.poll(async () => (await progressState()).value).toBe((before.value % before.max) + 1);
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(paused);
  expect(await page.evaluate(()=>scrollX)).toBe(0);

  // 停手超过手势间隔后重新滑动才再换一张，反向滑动回到上一张
  await page.waitForTimeout(450);
  await wheelBurst(-40);
  await expect.poll(async () => (await progressState()).value).toBe(before.value);
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(paused);
  await expect(memory).toBeInViewport();

  // 慢速滑动同样累积到阈值后只换一张：事件间隔约 120ms，远小于 400ms 手势间隔。
  // 派发放在页面内完成：CI 负载下 Playwright 的 waitForTimeout 会漂移到 400ms 以外，
  // 三次 25px 会被拆成三个独立手势，换不了图（实测 CI 失败，期望 2 得到 1）。
  await page.waitForTimeout(450);
  await page.evaluate(async () => {
    for (let index = 0; index < 3; index += 1) {
      document.body.dispatchEvent(new WheelEvent('wheel', {deltaX:25, deltaY:0, bubbles:true, cancelable:true}));
      if (index < 2) await new Promise(resolve => setTimeout(resolve, 120));
    }
  });
  await expect.poll(async () => (await progressState()).value).toBe((before.value % before.max) + 1);

  // 纵向滚动仍然切回首屏
  await page.waitForTimeout(400);
  await page.mouse.wheel(0,-120);
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('music icon reveals a right-aligned volume control on hover and focus', async ({page}, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chrome' ? {width: 360, height: 800} : {width: 1440, height: 900};
  await page.setViewportSize(viewport);
  await page.goto('./');
  const music = page.getByTestId('music-toggle');
  const button = music.getByRole('button', {name: /背景音乐/});
  const panel = page.getByTestId('music-volume');
  // 暂停时面板对整个无障碍树隐藏，因此用数据标记定位；播放态再校验可访问名称
  const slider = panel.locator('[data-music-volume-slider]');
  const surface = music.locator('[data-music-surface]');
  const audio = page.getByTestId('background-music');
  const panelOpacity = () => panel.evaluate(node => getComputedStyle(node).opacity);

  // 暂停状态不提供音量入口：悬停不展开，滑块也不在键盘顺序里
  await expect(music).toHaveAttribute('data-playing','false');
  expect(await panelOpacity()).toBe('0');
  await button.hover();
  await page.waitForTimeout(250);
  expect(await panelOpacity()).toBe('0');
  await expect(slider).toHaveAttribute('tabindex','-1');

  // 播放状态下悬停音乐图标，在图标下方展开
  await button.click();
  await expect(music).toHaveAttribute('data-playing','true');
  await button.hover();
  await expect.poll(panelOpacity).toBe('1');
  await expect(panel.getByRole('slider', {name: '背景音乐音量'})).toBeVisible();
  const surfaceBox = await surface.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(Math.abs((panelBox?.x ?? 0) + (panelBox?.width ?? 0) - ((surfaceBox?.x ?? 0) + (surfaceBox?.width ?? 0)))).toBeLessThanOrEqual(2);
  expect(panelBox?.y ?? 0).toBeGreaterThanOrEqual((surfaceBox?.y ?? 0) + (surfaceBox?.height ?? 0) - 1);
  const sliderBox = await slider.boundingBox();
  expect(sliderBox?.height).toBeGreaterThanOrEqual(44);
  expect(sliderBox?.width).toBeGreaterThanOrEqual(44);

  // 键盘聚焦同样展开，并即时写入实际播放音量
  await slider.focus();
  await expect.poll(panelOpacity).toBe('1');
  await slider.press('Home');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBe(0);
  await slider.press('ArrowRight');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBeCloseTo(0.05, 2);
  await expect(panel.locator('[data-music-volume-slider]')).toHaveValue('0.05');
  // 第二屏入口共享同一音量
  await expect(page.locator('[data-music-volume="memory"] input')).toHaveValue('0.05');

  // 指针与焦点都离开后收起
  await page.mouse.move(4,4);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(panelOpacity).toBe('0');
});

test('mobile long press opens the volume control without toggling playback', async ({page, isMobile}) => {
  test.skip(!isMobile, '长按入口只在触屏项目验证');
  await page.goto('./');
  const music = page.getByTestId('music-toggle');
  const button = music.getByRole('button', {name: /背景音乐/});
  const panel = page.getByTestId('music-volume');
  const slider = panel.getByRole('slider', {name: '背景音乐音量'});
  const audio = page.getByTestId('background-music');
  const panelOpacity = () => panel.evaluate(node => getComputedStyle(node).opacity);
  const box = await button.boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  const pressedBefore = await button.getAttribute('aria-pressed');

  const touchSession = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd', points: Array<{x: number; y: number}>) =>
    touchSession.send('Input.dispatchTouchEvent', {type, touchPoints: points});

  // 暂停状态长按不展开，按普通点击处理（开始播放）
  await touch('touchStart', [{x, y}]);
  await page.waitForTimeout(700);
  await touch('touchEnd', []);
  await expect(music).toHaveAttribute('data-volume-pinned', 'false');
  await expect(music).toHaveAttribute('data-playing', 'true');

  // 播放状态下长按展开音量面板，且不切换播放状态
  await touch('touchStart', [{x, y}]);
  await page.waitForTimeout(700);
  await expect(music).toHaveAttribute('data-volume-pinned', 'true');
  await touch('touchEnd', []);
  await expect.poll(panelOpacity).toBe('1');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(pressedBefore).toBe('false');

  // 展开后的面板可以调音量
  await slider.focus();
  await slider.press('Home');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBe(0);

  // 点击面板外收起
  await page.touchscreen.tap(12, 740);
  await expect(music).toHaveAttribute('data-volume-pinned', 'false');
  await expect.poll(panelOpacity).toBe('0');
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
  await touchSession.detach();
});

test('background music preference survives reload and resumes on first interaction', async ({page}) => {
  // 偏好键与 playback 契约一致：显式切换/调整才写入，浏览器拦截与程序性暂停不写
  const stored = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('wangleyou:background-music') ?? 'null'));
  await page.goto('./');
  const music = page.getByTestId('music-toggle');
  const controls = page.getByTestId('music-controls');
  const button = music.getByRole('button', {name: /背景音乐/});
  const slider = music.locator('[data-music-volume-slider]');
  const audio = page.getByTestId('background-music');

  // 显式开启并调整音量：意图与音量写入本地缓存
  await button.click();
  await expect(music).toHaveAttribute('data-playing', 'true');
  await slider.focus();
  await slider.press('Home');
  await slider.press('ArrowRight');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBeCloseTo(0.05, 2);
  await expect.poll(stored).toMatchObject({intent: 'playing', volume: 0.05});

  // 刷新：无用户手势，自动播放被拒绝进入阻塞视觉；任意首次交互用同一手势恢复播放与音量
  await page.reload();
  await expect(controls).toHaveAttribute('data-music-status', 'blocked');
  await expect.poll(stored).toMatchObject({intent: 'playing', volume: 0.05});
  await page.mouse.click(200, 400);
  await expect(music).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBeCloseTo(0.05, 2);

  // 显式暂停后刷新：缓存为暂停，刷新保持暂停且不尝试自动播放
  await button.click();
  await expect(music).toHaveAttribute('data-playing', 'false');
  await expect.poll(stored).toMatchObject({intent: 'paused'});
  await page.reload();
  await expect.poll(() => music.getAttribute('data-playing')).toBe('false');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);
});

test('review: returning to the foreground waits for explicit resumes', async ({page}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '桌面用例专门验证程序性暂停语义');
  const setVisibility = (visible: boolean) => page.evaluate(state => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible ? 'visible' : 'hidden');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');

  // 背景音乐：隐藏停止，回前台不自动播放，按钮点击显式恢复。
  const music = page.locator('[data-music-screen="hero"]');
  const audio = page.getByTestId('background-music');
  await music.getByRole('button').click();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  await setVisibility(false);
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);
  await setVisibility(true);
  await page.waitForTimeout(100);
  await expect(audio).toHaveJSProperty('paused', true);
  await music.getByRole('button').click();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);

  // 主回忆：回前台仍停住；点击暂停再点击恢复属于显式操作，覆盖指针停留。
  await page.getByRole('button', {name: /开启回忆/}).click();
  await expect(page.locator('[data-home-section="memory"]')).toBeInViewport();
  const memory = page.locator('[data-home-section="memory"]');
  const photo = memory.getByRole('button', {name: /主回忆自动播放/});
  const progress = memory.getByRole('progressbar');
  await setVisibility(false);
  await setVisibility(true);
  const heldValue = await progress.getAttribute('value');
  await page.waitForTimeout(4300);
  await expect(progress).toHaveAttribute('value', heldValue!);
  await photo.hover();
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /^继续主回忆自动播放/);
  const play = memory.getByRole('button', {name: '继续播放主回忆'});
  await play.click();
  await expect(photo).toHaveAttribute('aria-label', /^暂停主回忆自动播放/);
  const resumedValue = await progress.getAttribute('value');
  await expect.poll(() => progress.getAttribute('value'), {timeout: 3500}).not.toBe(resumedValue);
});

for (const theme of ['beach', 'grassland'] as const) {
  test(`review: ${theme} unavailable localStorage still allows music controls`, async ({page}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(name => {
      localStorage.setItem('wangleyou.theme', name);
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new DOMException('Storage disabled', 'SecurityError'); },
      });
    }, theme);
    await page.goto('./');
    await expect(page.getByRole('heading', {level: 1})).toBeVisible();
    // 主题存储同样不可读，按既有约定回退海边；切换后核对另一个主题。
    if (theme === 'grassland') await page.getByTestId('theme-switch').click();
    const music = page.locator('[data-music-screen="hero"]');
    // 切换主题的手势已经恢复音乐；不要按瞬时 paused 状态再次切换意图。
    if (theme === 'beach') await music.getByRole('button').click();
    await expect(music).toHaveAttribute('data-playing', 'true');
    const slider = music.getByRole('slider');
    await slider.focus();
    await slider.press('ArrowLeft');
    await expect(slider).toHaveValue('0.45');
    await music.getByRole('button').click();
    await expect(music).toHaveAttribute('data-playing', 'false');
    expect(errors).toEqual([]);
  });

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

  test(`review: ${theme} focus and hover independently pause memory`, async ({page, isMobile}) => {
    test.skip(isMobile, '悬停验证需要鼠标');
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('./');
    await setTheme(page, theme);
    await page.clock.install();
    await page.keyboard.press('ArrowDown');
    const memory = page.locator('[data-home-section="memory"]');
    const next = memory.getByRole('button', {name: '下一张照片'});
    const progress = memory.getByRole('progressbar');
    await next.click();
    await page.mouse.move(0, 0);
    await expect(next).toBeFocused();
    const focusedValue = await progress.getAttribute('value');
    await page.clock.runFor(2100);
    await expect(progress).toHaveAttribute('value', focusedValue!);
    await memory.getByRole('button', {name: /主回忆自动播放/}).hover();
    await page.locator('main').focus();
    await page.clock.runFor(2100);
    await expect(progress).toHaveAttribute('value', focusedValue!);
    await page.mouse.move(0, 0);
    await page.clock.runFor(2100);
    await expect(progress).not.toHaveAttribute('value', focusedValue!);
  });

  test(`review: ${theme} explicit memory resume overrides the current hover`, async ({page, isMobile}) => {
    test.skip(isMobile, '悬停恢复验证需要鼠标');
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('./');
    await setTheme(page, theme);
    await page.keyboard.press('ArrowDown');
    const memory = page.locator('[data-home-section="memory"]');
    const photo = memory.getByRole('button', {name: /主回忆自动播放/});
    const progress = memory.getByRole('progressbar');

    // 用真实节奏验证：本版 Playwright 的假时钟不冻结时间，真实 2 秒节奏照走而 runFor 又叠加一次，
    // 断言会同时受两套时钟影响（实测同一用例 20 次里失败 5–17 次），因此这里不装假时钟。
    await photo.hover();
    await photo.click();
    await expect(photo).toHaveAttribute('aria-label', /^继续主回忆自动播放/);
    const pausedValue = await progress.getAttribute('value');
    await page.waitForTimeout(3000);
    await expect(progress).toHaveAttribute('value', pausedValue!);

    // 显式恢复覆盖当前悬停：指针仍在播放器内也立即继续计时
    await photo.click();
    await expect(photo).toHaveAttribute('aria-label', /^暂停主回忆自动播放/);
    await expect.poll(() => progress.getAttribute('value'), {timeout: 4000}).not.toBe(pausedValue);

    // 指针与焦点都离开后覆盖结束，播放继续
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.mouse.move(4, 4);
    const leftValue = await progress.getAttribute('value');
    await expect.poll(() => progress.getAttribute('value'), {timeout: 4000}).not.toBe(leftValue);

    // 覆盖已结束：再次进入恢复普通悬停暂停
    await photo.hover();
    const hoveredValue = await progress.getAttribute('value');
    await page.waitForTimeout(3000);
    await expect(progress).toHaveAttribute('value', hoveredValue!);
  });

  test(`review: ${theme} theme switch does not isolate backdrop blur with a wrapper filter`, async ({page}) => {
    await page.goto('./');
    await setTheme(page, theme);
    const dock = page.getByTestId('theme-switch');
    const surface = dock.locator('[data-theme-switch-surface]');
    await expect(dock).toHaveJSProperty('style.filter', '');
    await expect(surface).not.toHaveJSProperty('style.boxShadow', 'none');
  });
}
