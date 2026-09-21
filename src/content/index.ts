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

export function assetUrl(path: string, base = import.meta.env.BASE_URL): string {
  assertAssetPath(path, 'resource');
  return `${base.replace(/\/$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
}
