import generated from './generated-photo-index.json';
import type { HomeMemoryPhoto, SiteContent } from './model';
import { assertAssetPath, validateContent, validateHomeMemory } from './validate';
export type { Photo, Video, Media, Album, SiteContent, HomeMemoryPhoto } from './model';
export { validateContent, validateHomeMemory, assertAssetPath } from './validate';

const EMPTY_CONTENT: SiteContent = { site: { title: '成长相册', subtitle: '内容暂时无法读取。' }, albums: [] };

/**
 * 配置异常不阻塞渲染：构建期由 scripts/validate-content.ts 直接失败，
 * 运行时把错误暴露给界面展示“配置异常”状态而不是白屏。
 */
const loaded: { data: SiteContent; homeMemory: HomeMemoryPhoto[]; error: string | null } = (() => {
  try {
    const parsed = validateContent(generated.content);
    return { data: parsed, homeMemory: validateHomeMemory(generated.homeMemory), error: null };
  } catch (error) {
    return { data: EMPTY_CONTENT, homeMemory: [], error: error instanceof Error ? error.message : '内容配置无效' };
  }
})();

export const content = loaded.data;
export const homeMemory = loaded.homeMemory;
export const contentErrorMessage = loaded.error;

function resolveAssetUrl(path: string, base: string): string {
  assertAssetPath(path, 'resource');
  return `${base.replace(/\/+$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** 兼容非媒体静态资源的既有站点路径 resolver。 */
export function assetUrl(path: string, base = import.meta.env.BASE_URL): string {
  return resolveAssetUrl(path, base);
}

/**
 * 所有 public/media 资源的统一入口。VITE_MEDIA_BASE_URL 由 Vite 在构建期注入，
 * 未配置时保留 GitHub Pages 或本地开发的页面 BASE_URL 行为。
 */
export function mediaUrl(path: string, base = import.meta.env.VITE_MEDIA_BASE_URL || import.meta.env.BASE_URL): string {
  return resolveAssetUrl(path, base);
}
