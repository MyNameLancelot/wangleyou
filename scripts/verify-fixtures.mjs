import { URL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import console from 'node:console';

// Run serially: temporarily add content, then restore the exact original config and build.
const configPath = new URL('../src/content/albums.json', import.meta.url);
const original = await readFile(configPath);
const data = JSON.parse(original.toString());
const photo = data.albums.flatMap(album => album.media).find(media => media.type === 'photo');
if (!photo) throw new Error('Fixture verification needs an existing photo');
if (data.albums.some(album => album.id === 'fixture-single')) throw new Error('Fixture ID already exists');
data.albums.push({ id: 'fixture-single', title: '配置新增的单张相册', media: [{...photo,id:'single'}] });
const run = (args, extra = {}) => execFileSync('npm', args, { stdio: 'inherit', env: {...process.env,...extra} });
try {
  await writeFile(configPath, JSON.stringify(data,null,2)+'\n');
  run(['run','build']);
  run(['run','test:e2e'], { CONTENT_FIXTURE: '1' });
} finally {
  await writeFile(configPath, original);
  run(['run','build']);
  console.log('原始相册配置及静态构建已恢复');
}
