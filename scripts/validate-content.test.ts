import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { validateFiles } from './validate-content';
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
