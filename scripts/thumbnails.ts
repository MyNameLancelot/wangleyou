import { mkdir, readdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import sharp from 'sharp';
const sourceDir = 'public/media';
const outputDir = join(sourceDir, 'thumbs');
await mkdir(outputDir, { recursive: true });
for (const file of await readdir(sourceDir)) {
  if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
  await sharp(join(sourceDir, file)).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toFile(join(outputDir, `${parse(file).name}.webp`));
  console.log(`缩略图：${file}`);
}
