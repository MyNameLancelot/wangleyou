import { test, expect } from '@playwright/test';
import {
  albumId,
  albumTitle,
  enterAlbum,
  firstPhoto,
  openFirst,
  routeDistMedia,
  setTheme,
  viewerAt,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('image failure can be retried without leaving the viewer',async({page})=>{
  // 查看器加载每张照片的最大 WebP 档位；媒体已从原图 JPG 改为内容哈希命名的派生 WebP。
  await page.route('**/media/**/top01.*.1600.webp',route=>route.abort());
  await enterAlbum(page); await page.getByRole('button',{name:firstPhoto}).click();
  await expect(page.getByText('这张照片暂时无法加载')).toBeVisible();
  // 状态面板文字属于影像展示：点击它不应关闭查看器，否则用户重试时会误关
  await page.getByText('这张照片暂时无法加载').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.unroute('**/media/**/top01.*.1600.webp');
  await page.getByRole('button',{name:'重新加载'}).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  await expect(page.getByText('这张照片暂时无法加载')).toHaveCount(0);
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, 2);
});

test('rapid switching isolates slow image errors, close/reopen resets session',async({page})=>{
  await page.route('**/media/**/002.*.1600.webp',async route=>{await new Promise(resolve=>setTimeout(resolve,300));await route.abort();});
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
