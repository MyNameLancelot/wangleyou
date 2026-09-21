import { expect, it } from 'vitest';
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
