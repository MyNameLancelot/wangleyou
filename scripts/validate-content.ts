import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateContent } from '../src/content/validate';

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
      if (media.type === 'video' && media.poster) refs.push({ path: media.poster, location: `${location}.poster` });
      if (media.type === 'video' && media.captions) refs.push({ path: media.captions, location: `${location}.captions` });
    });
  });
  for (const ref of refs) {
    try {
      const actual = await realpath(resolve(root, ref.path));
      const rel = relative(root, actual);
      if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || !(await stat(actual)).isFile()) throw new Error('不是发布目录内的文件');
    } catch (error) {
      throw new Error(`${ref.location}: 无法读取发布资源 ${ref.path}`, { cause: error });
    }
  }
  return parsed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  validateFiles(process.argv[2] || 'src/content/generated-photo-index.json', process.argv[3] || 'public')
    .then(data => console.log(`内容校验通过：${data.albums.length} 个相册，${data.albums.reduce((sum, a) => sum + a.media.length, 0)} 个媒体`))
    .catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
