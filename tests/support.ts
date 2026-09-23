import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { join } from 'node:path';

export const albumId = '2024-05-sequence00';
export const albumTitle = '破壳';
export const firstPhoto = '查看照片：破壳 第 1 张';
/** 破壳相册的公开照片数量：卡片数量角标、查看器位置提示都据此断言。 */
export const albumPhotoCount = 8;
export const cdnMediaPrefix = 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/';

/**
 * 构建产物仍保留 jsDelivr URL；E2E 从本次构建的 dist/ 提供同一媒体，
 * 使交互测试不依赖第三方 CDN 的网络可达性或缓存状态。
 */
export async function routeDistMedia(page: Page) {
  await page.route(`${cdnMediaPrefix}media/**`, route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const mediaPath = pathname.replace('/gh/MyNameLancelot/wangleyou@main/public/', '');
    return route.fulfill({path: join(process.cwd(), 'dist', mediaPath)});
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
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
}

/** 查看器不再显示可见计数器：位置改用 dialog 上的机器可读属性断言。 */
export const viewerAt = (page: Page, position: number) => expect(page.getByRole('dialog')).toHaveAttribute('data-media-position', String(position));
