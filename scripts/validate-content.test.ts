import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { checkVideoSize, validateFiles } from './validate-content';
const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'wangleyou-')); temporary.push(root);
  const pub = join(root, 'public'); await mkdir(pub);
  const config = join(root, 'content.json');
  await writeFile(config, JSON.stringify({site:{ title: '测试', subtitle:'测试相册' },albums:[{id:'test',title:'测试',media:[{id:'photo',type:'photo',src:'photo.jpg'}]}]}));
  return {root,pub,config};
}
it('rejects a missing local file with its config position', async () => {
  const {config,pub}=await fixture();
  await expect(validateFiles(config,pub)).rejects.toThrow('albums[0].media[0].src');
});
it('accepts a new album using only config and resources', async () => {
  const {config,pub}=await fixture(); await writeFile(join(pub,'photo.jpg'),'fixture');
  expect((await validateFiles(config,pub)).albums[0].id).toBe('test');
});
it('rejects symbolic links outside the publishing directory', async () => {
  const {root,config,pub}=await fixture(); await writeFile(join(root,'outside.jpg'),'fixture');
  await symlink(join(root,'outside.jpg'),join(pub,'photo.jpg'));
  await expect(validateFiles(config,pub)).rejects.toThrow('albums[0].media[0].src');
});

async function videoFixture() {
  const {root,pub,config}=await fixture();
  const album = {
    id: 'test', title: '测试', media: [
      { id: 'clip', type: 'video', src: 'media/test/clip.0123456789ab.mp4', poster: 'media/test/clip.poster.0123456789ab.960.webp' },
    ],
  };
  await mkdir(join(pub, 'media/test'), { recursive: true });
  await writeFile(join(pub, 'media/test/clip.0123456789ab.mp4'), 'mp4');
  await writeFile(join(pub, 'media/test/clip.poster.0123456789ab.960.webp'), 'webp');
  await writeFile(config, JSON.stringify({ site: { title: '测试', subtitle: '测试相册' }, albums: [album] }));
  return {root,pub,config};
}

it('accepts a published video with its derived poster', async () => {
  const {pub,config}=await videoFixture();
  expect((await validateFiles(config,pub)).albums[0].media[0]).toMatchObject({ type: 'video' });
});

it('rejects a missing published poster and reports the field position', async () => {
  const {pub,config}=await videoFixture();
  await rm(join(pub,'media/test/clip.poster.0123456789ab.960.webp'));
  await expect(validateFiles(config,pub)).rejects.toThrow('albums[0].media[0].poster');
});

it('reports video size baselines for the hard limit and the recommended limit', () => {
  const location = 'albums[0].media[0].src';
  const path = 'media/test/clip.0123456789ab.mp4';
  expect(checkVideoSize(20 * 1024 * 1024, location, path)).toEqual({ level: 'ok' });
  const warning = checkVideoSize(100 * 1024 * 1024 + 1, location, path);
  expect(warning.level).toBe('warning');
  expect(warning.level === 'warning' ? warning.message : '').toContain(location);
  const error = checkVideoSize(200 * 1024 * 1024 + 1, location, path);
  expect(error.level).toBe('error');
  expect(error.level === 'error' ? error.message : '').toContain('请离线压缩后再入库');
});
