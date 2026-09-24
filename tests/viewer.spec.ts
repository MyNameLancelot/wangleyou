import { test, expect } from '@playwright/test';
import {
  albumId,
  albumPhotoCount,
  firstPhoto,
  firstVideo,
  pressViewerKey,
  routeDistMedia,
  setTheme,
  stepViewer,
  videoAlbumId,
  videoAlbumTitle,
  viewerAt,
  viewerScrollLock,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

const currentSlide = (page: Parameters<typeof viewerAt>[0]) => page.locator('.yarl__slide_current');
const currentVideo = (page: Parameters<typeof viewerAt>[0]) => currentSlide(page).locator('video');

test('album grid shows the video thumbnail with a play badge next to the photos', async ({ page, isMobile }) => {
  await page.goto(`./#/albums/${videoAlbumId}`);
  await expect(page.getByRole('heading', { name: videoAlbumTitle, level: 1 })).toBeVisible();
  const tile = page.getByRole('button', { name: firstVideo });
  await expect(tile).toBeVisible();
  // 缩略图用构建期派生的封面 WebP，并保留响应式候选图
  await expect(tile.locator('img')).toHaveAttribute('src', /weekend-clip\.poster\.[a-f0-9]+\.960\.webp$/);
  await expect(tile.locator('img')).toHaveAttribute('srcset', /weekend-clip\.poster\.[a-f0-9]+\.480\.webp 480w/);
  const badge = tile.locator('[class*="videoBadge"]');
  await expect(badge).toBeVisible();
  // 播放标识是中间凸起的玻璃按钮 + 灰色实心 Play 图标（图标来自 lucide-react，不是字符画）
  await expect(badge.locator('svg')).toHaveCount(1);
  await expect(badge.locator('svg path')).toHaveCount(1);
  expect(await badge.locator('svg').evaluate(node => getComputedStyle(node).fill)).not.toBe('none');
  expect(await badge.evaluate(node => Math.round(node.getBoundingClientRect().width))).toBeGreaterThanOrEqual(isMobile ? 22 : 34);
  const badgeStyle = await badge.evaluate(node => {
    const style = getComputedStyle(node);
    return { radius: style.borderRadius, backdrop: style.backdropFilter, shadow: style.boxShadow, color: style.color, background: style.backgroundImage };
  });
  expect(badgeStyle.radius).toBe('50%');
  expect(badgeStyle.backdrop).toContain('blur');
  expect(badgeStyle.shadow).toContain('inset');
  // 背景通透：渐变使用半透明白（alpha < 0.5），不是实心底
  const alphas = (badgeStyle.background.match(/rgba?\([^)]*\)/g) ?? [])
    .map(value => Number((value.match(/[\d.]+/g) ?? [])[3] ?? 1));
  expect(alphas.length).toBeGreaterThan(0);
  expect(Math.max(...alphas)).toBeLessThanOrEqual(0.5);
  // 图标是灰色（R≈G≈B），不是主题色
  const channels = (badgeStyle.color.match(/\d+/g) ?? []).map(Number);
  expect(channels).toHaveLength(3);
  expect(Math.max(...channels) - Math.min(...channels)).toBeLessThanOrEqual(16);
  // 播放标识居中叠加在缩略图上（不烘焙进封面资源），尺寸足够辨识
  const badgeGeometry = await tile.evaluate(node => {
    const badgeBox = node.querySelector('[class*="videoBadge"]')!.getBoundingClientRect();
    const tileBox = node.getBoundingClientRect();
    return {
      offsetX: Math.abs(badgeBox.left + badgeBox.width / 2 - (tileBox.left + tileBox.width / 2)),
      offsetY: Math.abs(badgeBox.top + badgeBox.height / 2 - (tileBox.top + tileBox.height / 2)),
      size: Math.round(badgeBox.width),
    };
  });
  expect(badgeGeometry.offsetX).toBeLessThanOrEqual(2);
  expect(badgeGeometry.offsetY).toBeLessThanOrEqual(2);
  // 桌面约 38px；手机（≤600px）更小，见下方断言
  expect(badgeGeometry.size).toBeGreaterThanOrEqual(isMobile ? 24 : 34);
  // 手机端更小：≤600px 时约 38px
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  const phoneBadge = await page.getByRole('button', { name: firstVideo }).locator('[class*="videoBadge"]').evaluate(node => Math.round(node.getBoundingClientRect().width));
  expect(phoneBadge).toBeLessThanOrEqual(30);
  expect(phoneBadge).toBeGreaterThanOrEqual(22);
  await page.setViewportSize({ width: 1440, height: 1000 });
  // 视频与照片在同一条构建期顺序里：周岁相册共 9 个媒体，视频按自然序排在最后（瀑布流 DOM 顺序按列分布）
  const labels = await page.locator('[data-testid="album-media-grid"] button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
  expect(labels).toHaveLength(9);
  expect(labels).toContain(firstVideo);
  expect(labels).toContain('查看照片：周岁 第 8 张');
});

test('video plays, pauses, seeks, and stays on the same item after it ends', async ({ page }) => {
  await page.goto(`./#/albums/${videoAlbumId}`);
  await page.getByRole('button', { name: firstVideo }).click();
  const video = currentVideo(page);
  await expect(video).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  // 视频插件渲染原生 HTML5 video：控件、内联播放与派生封面都来自构建产物
  await expect(video).toHaveAttribute('controls', '');
  await expect(video).toHaveAttribute('playsinline', '');
  await expect(video).toHaveAttribute('poster', /weekend-clip\.poster\.[a-f0-9]+\.960\.webp$/);
  // 视频插件用 <source> 挂载地址，媒体 resolver 统一加前缀
  await expect(video.locator('source')).toHaveAttribute('src', /\/media\/2025-05-sequence00-.*\/weekend-clip\.[a-f0-9]{12}\.mp4$/);
  await expect(video.locator('source')).toHaveAttribute('type', 'video/mp4');

  // 打开即尝试播放；被浏览器拒绝时仍可用原生控件主动播放
  await expect.poll(() => video.evaluate(node => !(node as HTMLVideoElement).paused)).toBe(true);
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).currentTime)).toBeGreaterThan(0.3);

  await video.evaluate(node => (node as HTMLVideoElement).pause());
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).paused)).toBe(true);
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).currentTime)).toBeGreaterThan(0.3);

  // 拖到接近结尾：自然结束后停留当前项，不自动推进、不循环
  await video.evaluate(node => {
    const element = node as HTMLVideoElement;
    element.currentTime = element.duration - 0.4;
    void element.play();
  });
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).ended), { timeout: 8000 }).toBe(true);
  await viewerAt(page, 9);
  // 边界语义与可视性无关：末项时「下一项」必须是禁用状态（手机/平板只把它隐藏，不渲染为可点）
  expect(await page.locator('.yarl__navigation_next').evaluate(node => (node as HTMLButtonElement).disabled)).toBe(true);
  const endedAt = await video.evaluate(node => (node as HTMLVideoElement).currentTime);
  await page.waitForTimeout(1500);
  await viewerAt(page, 9);
  expect(await video.evaluate(node => (node as HTMLVideoElement).currentTime)).toBe(endedAt);

  // 关闭查看器后不残留视频或音源
  await pressViewerKey(page, 'Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(0);
  await viewerScrollLock(page, false);
});

test('photo viewer opens the clicked media, keeps the full frame and shows captions', async ({ page }) => {
  await page.goto(`./#/albums/${videoAlbumId}`);
  // 打开第 3 张照片：查看器定位到所点击的媒体
  await page.getByRole('button', { name: '查看照片：周岁 第 3 张' }).click();
  const image = currentSlide(page).locator('img');
  await expect(image).toBeVisible();
  await viewerAt(page, 3);
  // 照片按原比例完整显示，不裁切
  expect(await image.evaluate(node => getComputedStyle(node).objectFit)).toBe('contain');
  expect(await image.evaluate(node => {
    const element = node as HTMLImageElement;
    const box = element.getBoundingClientRect();
    return Math.abs(box.width / box.height - element.naturalWidth / element.naturalHeight);
  })).toBeLessThan(0.02);
  // 计数器不再是可见元素
  expect(await page.getByRole('dialog').innerText()).not.toMatch(/\d+\s*\/\s*\d+/);

  // 寄语仍然显示，且属于影像展示：点击寄语不关闭查看器
  await stepViewer(page, 2, 'previous');
  await viewerAt(page, 1);
  const caption = '黄昏把树影拉得很长，我们在这里等天色慢慢暗下来。';
  await expect(currentSlide(page).getByText(caption)).toBeVisible();
  // 寄语贴在「图片的左下角」：相对当前影像左边 12px、底边 12px，且不铺满画面
  const captionLayout = await currentSlide(page).evaluate(node => {
    const image = node.querySelector('img')!.getBoundingClientRect();
    const box = node.querySelector('.yarl__slide_captions_container')!.getBoundingClientRect();
    return {
      leftGap: Math.round(box.left - image.left),
      bottomGap: Math.round(image.bottom - box.bottom),
      insideImage: box.left >= image.left - 1 && box.right <= image.right + 1 && box.bottom <= image.bottom + 1,
      boxWidth: Math.round(box.width),
      imageWidth: Math.round(image.width),
    };
  });
  expect(captionLayout.leftGap).toBeGreaterThanOrEqual(8);
  expect(captionLayout.leftGap).toBeLessThanOrEqual(16);
  expect(captionLayout.bottomGap).toBeGreaterThanOrEqual(8);
  expect(captionLayout.bottomGap).toBeLessThanOrEqual(16);
  expect(captionLayout.insideImage).toBe(true);
  expect(captionLayout.boxWidth).toBeLessThanOrEqual(captionLayout.imageWidth - 20);
  await currentSlide(page).getByText(caption).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await viewerAt(page, 1);
  // 没有寄语的画面不留空位
  await stepViewer(page, 1);
  await viewerAt(page, 2);
  await expect(currentSlide(page).getByText(caption)).toHaveCount(0);
});

test('viewer closes with Esc, close button and backdrop, then restores focus', async ({ page }) => {
  const trigger = page.getByRole('button', { name: firstPhoto });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./#/albums/${albumId}`);
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await viewerScrollLock(page, true);
  // PC 端不再渲染关闭按钮：退出靠 Esc 与背景点击
  await expect(dialog.getByRole('button', { name: '关闭查看器' })).toHaveCount(0);

  // 点击影像与导航不关闭查看器
  await currentSlide(page).locator('img').click();
  await expect(dialog).toBeVisible();
  await viewerAt(page, 1);
  await dialog.getByRole('button', { name: '下一项' }).click();
  await expect(dialog).toBeVisible();
  await viewerAt(page, 2);
  // 鼠标点击不留残留聚焦框：指针交互后的焦点既不显示焦点环，也不在页面内容上
  expect(await page.evaluate(() => {
    const node = document.activeElement as HTMLElement | null;
    return { focusVisible: node?.matches(':focus-visible') ?? false, outline: node ? getComputedStyle(node).outlineStyle : 'none' };
  })).toEqual({ focusVisible: false, outline: 'none' });

  // 模态语义：库把其余页面标记为 inert，主题包装再把 Tab 回绕在查看器内部
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.yarl__portal'))).toBe(true);
    expect(await page.evaluate(() => document.querySelector('#root')?.hasAttribute('inert'))).toBe(true);
  }

  // Esc 关闭并把焦点交回触发元素
  await pressViewerKey(page, 'Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await viewerScrollLock(page, false);

  // 关闭按钮
  // 关闭按钮在全端都不渲染：手机上同样靠点击黑色背景退出
  await page.setViewportSize({ width: 360, height: 800 });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '关闭查看器' })).toHaveCount(0);
  await page.locator('.yarl__portal').click({ position: { x: 8, y: 8 } });
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 1000 });

  // 黑色背景点击
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.locator('.yarl__portal').click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);

  // 路由变化关闭查看器并释放滚动锁
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(dialog).toHaveCount(0);
  await viewerScrollLock(page, false);
  await expect(page.locator('body')).not.toHaveClass(/yarl__no_scroll/);
});

test('viewer is a shared component: identical structure and styling in both themes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./#/albums/${albumId}`);
  const ringColors: string[] = [];
  const portalClasses: string[] = [];
  for (const theme of ['beach', 'grassland'] as const) {
    await setTheme(page, theme);
    await page.getByRole('button', { name: firstPhoto }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // 查看器内不提供主题入口；照片模式也保留库默认关闭按钮
    await expect(dialog.getByRole('button', { name: /切换主题/ })).toHaveCount(0);
    const slideshowButton = dialog.getByRole('button', { name: '播放幻灯片' });
    await expect(slideshowButton).toBeVisible();
    // 工具栏按钮用库默认样式（透明底、无边框、白色图标）
    expect(await slideshowButton.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    // 查看器是共用组件：根节点由共用模块加类，主题不参与
    portalClasses.push(await page.locator('.yarl__portal').getAttribute('class') ?? '');
    const next = dialog.getByRole('button', { name: '下一项' });

    // 按钮任何状态都不使用边框
    expect(await next.evaluate(node => getComputedStyle(node).borderTopWidth)).toBe('0px');
    await next.hover();
    expect(await next.evaluate(node => getComputedStyle(node).borderTopWidth)).toBe('0px');
    // 键盘焦点可见（主题色外环）：用 Tab 进入控件，确保是键盘导航获得的焦点
    for (let step = 0; step < 6; step += 1) {
      if (await next.evaluate(node => node === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await expect(next).toBeFocused();
    expect(await next.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
    expect(await next.evaluate(node => parseFloat(getComputedStyle(node).outlineWidth))).toBeGreaterThanOrEqual(2);
    // 焦点环固定为白色（共用样式，与主题色无关）
    ringColors.push(await next.evaluate(node => getComputedStyle(node).outlineColor));
    // 字体继承站点正文（来自 body），不引入主题级查看器样式
    expect(await page.locator('.yarl__portal').evaluate(node => getComputedStyle(node).fontFamily)).toContain('PingFang SC');
    await pressViewerKey(page, 'Escape');
    await expect(dialog).toHaveCount(0);
  }
  // 主题不可定制：两个主题下查看器根类名与焦点环完全一致
  expect(portalClasses[0]).toBe(portalClasses[1]);
  expect(portalClasses[0]).toMatch(/viewer/);
  expect(ringColors).toEqual(['rgb(255, 255, 255)', 'rgb(255, 255, 255)']);
});

test('viewer enables the official plugin set: captions, fullscreen, slideshow, thumbnails, video, zoom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button', { name: firstPhoto }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 工具栏：幻灯片、全屏、缩略图开关与关闭（库默认按钮，中文可访问名称）
  for (const name of ['播放幻灯片', '进入全屏']) {
    await expect(dialog.getByRole('button', { name })).toBeVisible();
  }
  // PC 端隐去放大/缩小、缩略图开关与关闭按钮
  for (const name of ['放大', '缩小', '显示缩略图', '隐藏缩略图', '关闭查看器']) {
    await expect(dialog.getByRole('button', { name })).toHaveCount(0);
  }
  await expect(page.locator('.yarl__toolbar button')).toHaveCount(2);

  // 缩略图带（库默认常显 + 开关）：只渲染当前项附近的缩略图，点击即切换当前项
  const track = page.locator('.yarl__thumbnails_track');
  await expect(track).toBeVisible();
  const thumbs = track.getByRole('button');
  expect(await thumbs.count()).toBeGreaterThanOrEqual(3);
  await thumbs.nth(1).click();
  await viewerAt(page, 2);

  // 幻灯片由工具栏显式启动，默认不自动播放；启动后按钮变为暂停
  const slideshow = dialog.getByRole('button', { name: '播放幻灯片' });
  await slideshow.click();
  await expect(dialog.getByRole('button', { name: '暂停幻灯片' })).toBeVisible();
  await expect.poll(() => page.locator('.yarl__slide_current').getAttribute('aria-label')).not.toBe('第 2 项，共 8 项');
  await dialog.getByRole('button', { name: '暂停幻灯片' }).click();
  await expect(dialog.getByRole('button', { name: '播放幻灯片' })).toBeVisible();
  const paused = await page.locator('.yarl__slide_current').getAttribute('aria-label');
  await page.waitForTimeout(3500);
  expect(await page.locator('.yarl__slide_current').getAttribute('aria-label')).toBe(paused);

  // 全屏（库默认 Fullscreen 插件）：进入后只展示影像（工具条被隐藏），用浏览器级退出恢复
  await dialog.getByRole('button', { name: '进入全屏' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(dialog.getByRole('button', { name: '进入全屏' })).toBeVisible();

  // 缩放（库默认 Zoom 插件）：双击放大当前照片
  await currentSlide(page).locator('img').dblclick();
  await expect.poll(() => page.locator('.yarl__slide_current .yarl__slide_wrapper').evaluate(node => (node as HTMLElement).style.transform)).toMatch(/scale\((?!1\))/);
  await pressViewerKey(page, 'Escape');
  await expect(dialog).toHaveCount(0);
});

test('zoom, thumbnails toggle and close buttons are gone on every device', async ({ page }) => {
  await page.goto(`./#/albums/${albumId}`);
  // PC（1440）、平板（1024）与手机（360）：工具栏都只留幻灯片与全屏
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 768 }, { width: 360, height: 800 }] as const) {
    await page.setViewportSize(viewport);
    await page.reload();
    await page.getByRole('button', { name: firstPhoto }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: '播放幻灯片' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: '进入全屏' })).toBeVisible();
    for (const name of ['放大', '缩小', '关闭查看器']) {
      await expect(dialog.getByRole('button', { name })).toHaveCount(0);
    }
    await expect(page.locator('.yarl__toolbar button')).toHaveCount(2);
    // 缩略图带与收起条在三种视口都保留
    await expect(page.locator('.yarl__thumbnails_track')).toBeVisible();
    await expect(page.getByRole('button', { name: '收起缩略图' })).toBeVisible();
    // 打开后焦点由库交给查看器容器，这里显式确认落点再发 Esc，避免首帧按键丢失
    await pressViewerKey(page, 'Escape');
    await expect(dialog).toHaveCount(0);
  }

  // 上一项/下一项只在桌面（≥1200px）显示
  for (const [width, height, visible] of [[1440, 1000, true], [1024, 768, false], [360, 800, false]] as const) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.getByRole('button', { name: firstPhoto }).click();
    await expect(page.locator('.yarl__navigation_next'))[visible ? 'toBeVisible' : 'toBeHidden']();
    await pressViewerKey(page, 'Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }

});

test('fullscreen shows only the image', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button', { name: firstPhoto }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '进入全屏' })).toBeVisible();
  await expect(page.locator('.yarl__thumbnails_track')).toBeVisible();
  await expect(page.getByRole('button', { name: '收起缩略图' })).toBeVisible();

  await dialog.getByRole('button', { name: '进入全屏' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  // 全屏只留影像：工具栏、导航、缩略图带、收起条与寄语全部隐藏
  await expect(page.locator('.yarl__toolbar')).toBeHidden();
  await expect(page.locator('.yarl__navigation_next')).toBeHidden();
  await expect(page.locator('.yarl__thumbnails_container')).toBeHidden();
  await expect(page.getByRole('button', { name: /缩略图/ })).toBeHidden();
  await expect(currentSlide(page).locator('img')).toBeVisible();
  expect(await page.evaluate(() => {
    const image = document.querySelector('.yarl__slide_current img')!.getBoundingClientRect();
    return { width: Math.round(image.width), viewport: window.innerWidth };
  })).toMatchObject({ viewport: 1440 });
  // 全屏下键盘方向键仍可切图（焦点被交回查看器容器）
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, 2);
  await page.keyboard.press('ArrowLeft');
  await viewerAt(page, 1);

  // 退出全屏（浏览器 Esc/F11 走的是 document.exitFullscreen）后控件恢复
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  await expect(page.locator('.yarl__toolbar')).toBeVisible();
  await expect(page.locator('.yarl__thumbnails_track')).toBeVisible();
  await expect(page.getByRole('button', { name: '收起缩略图' })).toBeVisible();
  await pressViewerKey(page, 'Escape');
  await expect(dialog).toHaveCount(0);
});

test('platforms without the Fullscreen API keep the viewer usable', async ({ page }) => {
  // 模拟 iPhone Safari：没有元素级 Fullscreen API（document.fullscreenEnabled 为 false）
  await page.addInitScript(() => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => false });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button', { name: firstPhoto }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // 库在全屏不可用时直接不渲染该按钮，不会留下灰按钮
  await expect(dialog.getByRole('button', { name: /全屏/ })).toHaveCount(0);
  // 其余能力保持可用：幻灯片、缩略图带、收起条与键盘/触摸切换
  await expect(dialog.getByRole('button', { name: '播放幻灯片' })).toBeVisible();
  await expect(page.locator('.yarl__thumbnails_track')).toBeVisible();
  await expect(page.getByRole('button', { name: '收起缩略图' })).toBeVisible();
  await pressViewerKey(page, 'ArrowRight');
  await viewerAt(page, 2);
  await pressViewerKey(page, 'Escape');
  await expect(dialog).toHaveCount(0);
});

test('thumbnail strip collapses from the full-width bar above it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button', { name: firstPhoto }).click();
  const dialog = page.getByRole('dialog');
  const track = page.locator('.yarl__thumbnails_track');
  await expect(track).toBeVisible();

  const collapse = page.getByRole('button', { name: '收起缩略图' });
  await expect(collapse).toBeVisible();
  const geometry = await collapse.evaluate(node => {
    const bar = node.getBoundingClientRect();
    const strip = document.querySelector('.yarl__thumbnails_track')!.getBoundingClientRect();
    const icon = node.querySelector('svg')!.getBoundingClientRect();
    return {
      left: Math.round(bar.left),
      width: Math.round(bar.width),
      centerOffset: Math.round(Math.abs((icon.left + icon.width / 2) - (bar.left + bar.width / 2))),
      barBottom: bar.bottom,
      stripTop: strip.top,
    };
  });
  // 屏幕同宽、图标居中、位于缩略图上方
  expect([geometry.left, geometry.width]).toEqual([0, 1440]);
  expect(geometry.centerOffset).toBeLessThanOrEqual(2);
  expect(geometry.barBottom).toBeLessThanOrEqual(geometry.stripTop + 1);

  // 收起：带子消失、图标变为向上；再展开
  await collapse.click();
  await expect(track).toBeHidden();
  await expect(page.getByRole('button', { name: '展开缩略图' })).toBeVisible();
  await page.getByRole('button', { name: '展开缩略图' }).click();
  await expect(track).toBeVisible();
  await expect(page.getByRole('button', { name: '收起缩略图' })).toBeVisible();
  await pressViewerKey(page, 'Escape');
  await expect(dialog).toHaveCount(0);
});

test('phone and tablet keep full-frame photos and switch with the library defaults', async ({ page }) => {
  for (const [width, height] of [[360, 800], [1024, 768]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`./#/albums/${albumId}`);
    await page.getByRole('button', { name: firstPhoto }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // 照片保持原比例完整显示，不裁切
    const geometry = await page.evaluate(() => {
      const image = document.querySelector<HTMLImageElement>('.yarl__slide_current img')!;
      const box = image.getBoundingClientRect();
      return { objectFit: getComputedStyle(image).objectFit, ratio: box.width / box.height, natural: image.naturalWidth / image.naturalHeight, right: box.right, viewport: window.innerWidth };
    });
    expect(geometry.objectFit).toBe('contain');
    expect(Math.abs(geometry.ratio - geometry.natural)).toBeLessThan(0.02);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);

    // 移动端与平板也可以滑动切换（库默认手势）；等查看器入场动画与手势传感器就绪再滑动
    await page.waitForTimeout(500);
    const touch = await page.context().newCDPSession(page);
    const start = { x: width - 70, y: 260 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
    for (let step = 1; step <= 8; step += 1) {
      await page.waitForTimeout(20);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - step * 20, y: start.y + step, id: 1, radiusX: 6, radiusY: 6, force: 1 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await viewerAt(page, 2);

    // 全屏状态下同样可以左右滑动切图
    await dialog.getByRole('button', { name: '进入全屏' }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await page.waitForTimeout(300);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 2, radiusX: 6, radiusY: 6, force: 1 }] });
    for (let step = 1; step <= 8; step += 1) {
      await page.waitForTimeout(20);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - step * 20, y: start.y + step, id: 2, radiusX: 6, radiusY: 6, force: 1 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await viewerAt(page, 3);
    await page.evaluate(() => document.exitFullscreen());
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);

    await touch.detach();
    await pressViewerKey(page, 'Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('first and last items disable navigation instead of looping', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./#/albums/${albumId}`);
  await page.getByRole('button', { name: firstPhoto }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: '上一项' })).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await viewerAt(page, 1);
  await stepViewer(page, albumPhotoCount - 1);
  await viewerAt(page, albumPhotoCount);
  await expect(dialog.getByRole('button', { name: '下一项' })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await viewerAt(page, albumPhotoCount);
});

test('opening a video never leaves a second audio source behind', async ({ page }) => {
  // 首页背景音乐：相册页没有背景音乐控件，打开视频时不存在第二路音源
  await page.goto('./');
  const audio = page.getByTestId('background-music');
  const music = page.locator('[data-music-screen="hero"]');
  if (await audio.evaluate(node => (node as HTMLAudioElement).paused)) await music.getByRole('button').click();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);

  await page.goto(`./#/albums/${videoAlbumId}`);
  await expect(page.locator('audio')).toHaveCount(0);
  await page.getByRole('button', { name: firstVideo }).click();
  await expect(page.locator('video')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveCount(0);
  await expect.poll(() => page.locator('video').evaluate(node => !(node as HTMLVideoElement).paused)).toBe(true);
  await pressViewerKey(page, 'Escape');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('audio')).toHaveCount(0);

  // 回到首页：仍按原规则由用户意图与首次手势决定，不出现重复音源
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.getByTestId('background-music')).toHaveCount(1);
  await expect(page.locator('audio')).toHaveCount(1);
});
