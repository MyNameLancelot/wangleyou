import type { Album, Media } from '../content';

export const LAST_PLAYED_KEY = 'wangleyou.lastPlayed';

export interface LastPlayed {
  albumId: string;
  mediaId: string;
  index: number;
}

type Storage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void };

export function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readLastPlayed(storage: Storage | null = safeStorage()): LastPlayed | null {
  try {
    const raw = storage?.getItem(LAST_PLAYED_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string, unknown>;
    if (typeof value.albumId !== 'string' || typeof value.mediaId !== 'string' || !Number.isInteger(value.index)) return null;
    return { albumId: value.albumId, mediaId: value.mediaId, index: value.index as number };
  } catch {
    return null;
  }
}

export function writeLastPlayed(value: LastPlayed, storage: Storage | null = safeStorage()): void {
  try {
    storage?.setItem(LAST_PLAYED_KEY, JSON.stringify(value));
  } catch {
    /* 存储不可用时只失去"继续浏览"入口 */
  }
}

export function clearLastPlayed(storage: Storage | null = safeStorage()): void {
  try {
    storage?.removeItem?.(LAST_PLAYED_KEY);
  } catch {
    /* 忽略存储异常 */
  }
}

/** 把记录解析回内容；内容被替换或删除时返回 null，界面不展示失效入口。 */
export function resolveLastPlayed(albums: Album[], last: LastPlayed | null): { album: Album; media: Media } | null {
  if (!last) return null;
  const album = albums.find(item => item.id === last.albumId);
  const media = album?.media.find(item => item.id === last.mediaId);
  return album && media ? { album, media } : null;
}
