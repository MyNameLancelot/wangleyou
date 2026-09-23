import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { VIDEO_EXTENSION, VIDEO_MAX_BYTES, VIDEO_RECOMMENDED_MAX_BYTES, validateContent } from '../src/content/validate';

const MEGABYTE = 1024 * 1024;
const formatSize = (bytes: number) => `${(bytes / MEGABYTE).toFixed(1)} MB`;

export type VideoSizeVerdict = { level: 'ok' } | { level: 'warning' | 'error'; message: string };

/** 视频体积基线：>200 MB 失败，>100 MB 警告；位置写到具体媒体与字段。 */
export function checkVideoSize(size: number, location: string, path: string): VideoSizeVerdict {
  if (size > VIDEO_MAX_BYTES) {
    return { level: 'error', message: `${location}: ${path} 体积 ${formatSize(size)} 超过单个视频上限 ${formatSize(VIDEO_MAX_BYTES)}；请离线压缩后再入库` };
  }
  if (size > VIDEO_RECOMMENDED_MAX_BYTES) {
    return { level: 'warning', message: `${location}: ${path} 体积 ${formatSize(size)} 超过建议上限 ${formatSize(VIDEO_RECOMMENDED_MAX_BYTES)}（硬上限 ${formatSize(VIDEO_MAX_BYTES)}）` };
  }
  return { level: 'ok' };
}

export async function validateFiles(configPath: string, publicDir: string) {
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  const parsed = validateContent(raw.content ?? raw);
  const root = await realpath(publicDir);
  const refs: { path: string; location: string }[] = [];
  parsed.albums.forEach((album, ai) => {
    if (album.cover) refs.push({ path: album.cover, location: `albums[${ai}].cover` });
    album.media.forEach((media, mi) => {
      const location = `albums[${ai}].media[${mi}]`;
      refs.push({ path: media.src, location: `${location}.src` });
      if (media.type === 'photo') {
        media.srcSet?.forEach((candidate, index) => refs.push({ path: candidate.src, location: `${location}.srcSet[${index}].src` }));
        return;
      }
      refs.push({ path: media.poster, location: `${location}.poster` });
      media.posterSrcSet?.forEach((candidate, index) => refs.push({ path: candidate.src, location: `${location}.posterSrcSet[${index}].src` }));
    });
  });
  const warnings: string[] = [];
  for (const ref of refs) {
    let actual: string;
    let size: number;
    try {
      actual = await realpath(resolve(root, ref.path));
      const rel = relative(root, actual);
      const info = await stat(actual);
      if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || !info.isFile()) throw new Error('不是发布目录内的文件');
      size = info.size;
    } catch (error) {
      throw new Error(`${ref.location}: 无法读取发布资源 ${ref.path}`, { cause: error });
    }
    // 视频发布基线：容器与体积在构建期拦截，位置写到具体媒体与字段。
    if (extname(actual).toLowerCase() !== VIDEO_EXTENSION) continue;
    const verdict = checkVideoSize(size, ref.location, ref.path);
    if (verdict.level === 'error') throw new Error(verdict.message);
    if (verdict.level === 'warning') warnings.push(verdict.message);
  }
  warnings.forEach(warning => console.warn(`警告 ${warning}`));
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateFiles(process.argv[2] || 'src/content/generated-photo-index.json', process.argv[3] || 'public')
    .then(data => console.log(`内容校验通过：${data.albums.length} 个相册，${data.albums.reduce((sum, a) => sum + a.media.length, 0)} 个媒体`))
    .catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
