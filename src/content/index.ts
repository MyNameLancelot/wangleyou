import rawContent from './albums.json';
import { assertAssetPath, sortAlbums, validateContent } from './validate';
export type { Photo, Video, Media, Album, SiteContent } from './model';
export { validateContent, sortAlbums, assertAssetPath } from './validate';

const parsed = validateContent(rawContent);
export const content = { ...parsed, albums: sortAlbums(parsed.albums) };
export function assetUrl(path: string, base = import.meta.env.BASE_URL): string {
  assertAssetPath(path, 'resource');
  return `${base.replace(/\/$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
