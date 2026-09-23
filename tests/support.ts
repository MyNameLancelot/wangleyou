import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

export const albumId = '2024-05-sequence00';
export const albumTitle = '破壳';
export const firstPhoto = '查看照片：破壳 第 1 张';
/** 破壳相册的公开照片数量：卡片数量角标、查看器位置提示都据此断言。 */
export const albumPhotoCount = 8;
/** 含演示视频的相册：周岁（8 张照片 + 1 段视频，视频按自然序排在最后）。 */
export const videoAlbumId = '2025-05-sequence00';
export const videoAlbumTitle = '周岁';
export const firstVideo = '播放视频：周岁 第 9 段';
export const cdnMediaPrefix = 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/';

const mediaTypes: Record<string, string> = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };

/**
 * 构建产物仍保留 jsDelivr URL；E2E 从本次构建的 dist/ 提供同一媒体，
 * 使交互测试不依赖第三方 CDN 的网络可达性或缓存状态。
 * 视频需要按 Range 分片响应（与 Pages/jsDelivr 一致），否则浏览器视为不可拖动进度。
 */
export async function routeDistMedia(page: Page) {
  await page.route(`${cdnMediaPrefix}media/**`, async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const mediaPath = pathname.replace('/gh/MyNameLancelot/wangleyou@main/public/', '');
    const body = await readFile(join(process.cwd(), 'dist', mediaPath));
    const headers = { 'Content-Type': mediaTypes[extname(mediaPath)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes' };
    const match = /^bytes=(\d*)-(\d*)$/.exec(route.request().headers().range ?? '');
    if (!match) return route.fulfill({ headers, body });
    const start = match[1] ? Number(match[1]) : Math.max(0, body.length - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), body.length - 1) : body.length - 1;
    if (start > end || start >= body.length) return route.fulfill({ status: 416, headers: { ...headers, 'Content-Range': `bytes */${body.length}` }, body: '' });
    return route.fulfill({ status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}`, 'Content-Length': String(end - start + 1) }, body: body.subarray(start, end + 1) });
  });
}

/** 不涉及切换控件本身的用例，通过偏好存储直接选择目标主题。 */
export async function setTheme(page: Page, theme: 'beach' | 'grassland') {
  await page.evaluate(name => localStorage.setItem('wangleyou.theme', name), theme);
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
}

export async function enterAlbum(page: Page) {
  await page.goto(`./#/albums/${albumId}`);
  await expect(page.getByRole('heading', {name:albumTitle,level:1})).toBeVisible();
}

export async function openFirst(page: Page) {
  await enterAlbum(page);
  await page.getByRole('button', { name: firstPhoto }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(currentSlide(page).getByRole('img')).toBeVisible();
}

/** 查看器当前影像（库会预渲染相邻影像，断言必须限定在当前项）。 */
export const currentSlide = (page: Page) => page.locator('.yarl__slide_current');

/** 查看器不显示可见计数器：当前位置由查看器给当前影像的可访问名称断言。 */
export const viewerAt = (page: Page, position: number) => expect(page.locator('.yarl__slide_current')).toHaveAttribute('aria-label', new RegExp(`^第 ${position} 项，共 \\d+ 项$`));

/** 查看器打开时锁定页面滚动（库默认行为），关闭后恢复。 */
export const viewerScrollLock = (page: Page, locked: boolean) => expect.poll(() => page.evaluate(() => document.body.classList.contains('yarl__no_scroll'))).toBe(locked);

/**
 * 查看器的键盘命令挂在查看器容器上：打开后由库把焦点交给容器。
 * 测试里先显式确认焦点落点，再发送按键，避免刚打开的那一帧按键被忽略。
 */
export async function pressViewerKey(page: Page, key: 'ArrowLeft' | 'ArrowRight' | 'Escape' | 'Tab') {
  await page.locator('.yarl__container').focus();
  await page.keyboard.press(key);
}

/** 查看器导航带节流（库默认约 250ms），逐次按键并等待当前影像真正切换。 */
export async function stepViewer(page: Page, times = 1, direction: 'next' | 'previous' = 'next') {
  for (let index = 0; index < times; index += 1) {
    const before = await page.locator('.yarl__slide_current').getAttribute('aria-label');
    await pressViewerKey(page, direction === 'next' ? 'ArrowRight' : 'ArrowLeft');
    await expect.poll(() => page.locator('.yarl__slide_current').getAttribute('aria-label'), { timeout: 4000 }).not.toBe(before);
  }
}
