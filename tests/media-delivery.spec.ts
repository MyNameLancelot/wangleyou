import { expect, test } from '@playwright/test';
import { loadEnv } from 'vite';
import { firstVideo, videoAlbumId } from './support';

const mediaBase = process.env.VITE_MEDIA_BASE_URL ?? loadEnv('production', process.cwd(), 'VITE_').VITE_MEDIA_BASE_URL;

test('album media use the configured public base while the theme stays same-origin', async ({ page }) => {
  const themeResponse = page.waitForResponse(response => response.url().endsWith('/media/themes/book/album-hero.webp'));
  await page.goto('./#/browse');
  expect((await themeResponse).status()).toBe(200);
  const theme = page.locator('[class*="browseHeroMedia"]');
  const themeUrl = new URL('media/themes/book/album-hero.webp', page.url()).href;
  expect(await theme.evaluate(node => getComputedStyle(node).backgroundImage)).toContain(themeUrl);

  await page.goto(`./#/albums/${videoAlbumId}`);
  const tile = page.getByRole('button', { name: firstVideo });
  const image = tile.locator('img');
  await tile.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const base = mediaBase || new URL('./', page.url()).href;
  const origin = new URL(base, page.url()).origin;
  expect(new URL(await image.evaluate(node => (node as HTMLImageElement).currentSrc)).origin).toBe(origin);
  for (const candidate of (await image.getAttribute('srcset'))!.split(', ')) {
    const candidateUrl = new URL(candidate.split(' ')[0], page.url()).href;
    expect(candidateUrl.startsWith(`${new URL(base, page.url()).href.replace(/\/+$/, '')}/media/`)).toBe(true);
  }
  await tile.click();
  const video = page.locator('.yarl__slide_current video');
  await expect.poll(() => video.evaluate(node => (node as HTMLVideoElement).duration)).toBeGreaterThan(0);
  expect(new URL(await video.evaluate(node => (node as HTMLVideoElement).currentSrc)).origin).toBe(origin);
});
