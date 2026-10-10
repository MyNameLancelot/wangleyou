import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());
import { assetUrl, mediaUrl } from './index';
it('resolves root and nested publishing bases without losing subpaths',()=>{
  expect(assetUrl('media/photo.jpg','/')).toBe('/media/photo.jpg');
  expect(assetUrl('media/photo.jpg','/wangleyou/')).toBe('/wangleyou/media/photo.jpg');
  expect(assetUrl('media/photo.jpg','/nested/gallery/')).toBe('/nested/gallery/media/photo.jpg');
  expect(assetUrl('media/一起散步.jpg','/gallery/')).toBe('/gallery/media/%E4%B8%80%E8%B5%B7%E6%95%A3%E6%AD%A5.jpg');
});
it('does not allow resource paths to escape base',()=>{
  expect(()=>assetUrl('../photo.jpg','/gallery/')).toThrow();
  expect(()=>assetUrl('/photo.jpg','/gallery/')).toThrow();
});
it('resolves media against a versioned jsDelivr prefix without duplicate slashes', () => {
  expect(mediaUrl('media/photo.jpg', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/')).toBe('https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/media/photo.jpg');
  expect(mediaUrl('media/一起散步.jpg', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public////')).toBe('https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/media/%E4%B8%80%E8%B5%B7%E6%95%A3%E6%AD%A5.jpg');
});
it('keeps the publishing-base fallback and rejects unsafe media paths', () => {
  expect(mediaUrl('media/photo.jpg', '/wangleyou/')).toBe('/wangleyou/media/photo.jpg');
  expect(()=>mediaUrl('media/../photo.jpg', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public')).toThrow();
  expect(()=>mediaUrl('media/photo.jpg?size=large', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public')).toThrow();
});

it.each(['/', '/wangleyou/'])('keeps themes same-origin while album assets use the public R2 base (%s)', pageBase => {
  vi.stubEnv('BASE_URL', pageBase);
  vi.stubEnv('VITE_MEDIA_BASE_URL', 'https://pub-61801102583343938a91e117b81957b9.r2.dev/');
  for (const name of ['一起散步.480.webp', 'clip.abc123.mp4', 'clip.poster.960.webp']) {
    expect(mediaUrl(`media/2026-10-sequence01-相册/${name}`)).toBe(
      `https://pub-61801102583343938a91e117b81957b9.r2.dev/media/${encodeURIComponent('2026-10-sequence01-相册')}/${encodeURIComponent(name)}`,
    );
  }
  expect(mediaUrl('media/themes/book/album-hero.webp')).toBe(`${pageBase}media/themes/book/album-hero.webp`);
  expect(mediaUrl('media/themes/book/music.mp3')).toBe(`${pageBase}media/themes/book/music.mp3`);
});

it('uses local publishing base in development when no album prefix is configured', () => {
  vi.stubEnv('BASE_URL', '/wangleyou/');
  vi.stubEnv('VITE_MEDIA_BASE_URL', '');
  expect(mediaUrl('media/2026-10-sequence01-相册/photo.webp')).toBe('/wangleyou/media/2026-10-sequence01-%E7%9B%B8%E5%86%8C/photo.webp');
});
