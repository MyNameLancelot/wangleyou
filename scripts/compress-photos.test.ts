import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import sharp from 'sharp';
import { formatReport, main, runCompress as runCompressWithProgress, type CompressDeps, type CompressOptions } from './compress-photos';

/** 断言报告时默认静音进度输出；需要检查文案的用例自行注入 log。 */
const runCompress = (config: CompressOptions, deps: CompressDeps = {}) => runCompressWithProgress(config, { log: () => undefined, ...deps });

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

interface Workspace { root: string; input: string; out: string }
async function workspace(): Promise<Workspace> {
  const root = await mkdtemp(join(tmpdir(), 'wangleyou-compress-'));
  temporary.push(root);
  const input = join(root, 'input');
  await mkdir(input, { recursive: true });
  return { root, input, out: join(root, 'out') };
}

function options(input: string, overrides: Partial<CompressOptions> = {}): CompressOptions {
  return { input, out: `${input}_compressed`, maxEdge: 4096, quality: 82, keepExif: false, concurrency: 4, dryRun: false, heicVia: 'auto', notes: [], ...overrides };
}

function capture() {
  const lines: string[] = [];
  return { lines, log: (line: string) => { lines.push(line); } };
}

async function photo(target: string, width: number, height: number, format: 'jpeg' | 'png' | 'webp' = 'jpeg', orientation = 0): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  let pipeline = sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 200 } } });
  if (orientation) pipeline = pipeline.withMetadata({ orientation, exif: { IFD0: { Make: 'WangleyouTest', Software: 'vitest' } } });
  if (format === 'png') await pipeline.png().toFile(target);
  else if (format === 'webp') await pipeline.webp({ quality: 95 }).toFile(target);
  else await pipeline.jpeg({ quality: 95 }).toFile(target);
}

/** 左半红、右半蓝的 60×40 照片，用于断言 EXIF 方向摆正后的真实像素方向。 */
async function twoTonePhoto(target: string, orientation: number): Promise<void> {
  const half = async (colour: { r: number; g: number; b: number }) =>
    sharp({ create: { width: 30, height: 40, channels: 3, background: colour } }).png().toBuffer();
  const composed = await sharp({ create: { width: 60, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: await half({ r: 255, g: 0, b: 0 }), left: 0, top: 0 }, { input: await half({ r: 0, g: 0, b: 255 }), left: 30, top: 0 }])
    .jpeg({ quality: 95 }).toBuffer();
  await mkdir(dirname(target), { recursive: true });
  await sharp(composed).jpeg({ quality: 95 }).withMetadata({ orientation, exif: { IFD0: { Make: 'WangleyouTest' } } }).toFile(target);
}

const metadata = (file: string) => sharp(file).metadata();
async function shade(file: string, x: number, y: number): Promise<'red' | 'blue' | 'other'> {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  if (data[offset] - data[offset + 2] > 60) return 'red';
  if (data[offset + 2] - data[offset] > 60) return 'blue';
  return 'other';
}

/** 两帧动图：上帧红、下帧蓝，用于验证只取首帧。 */
async function animatedGif(target: string): Promise<void> {
  const frame = (colour: { r: number; g: number; b: number }) => sharp({ create: { width: 20, height: 20, channels: 3, background: colour } }).png().toBuffer();
  const strip = await sharp({ create: { width: 20, height: 40, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: await frame({ r: 255, g: 0, b: 0 }), left: 0, top: 0 }, { input: await frame({ r: 0, g: 0, b: 255 }), left: 0, top: 20 }])
    .png().toBuffer();
  // composite 结果为 RGBA，去掉 alpha 才能按 3 通道重建多帧输入。
  const raw = await sharp(strip).removeAlpha().raw().toBuffer();
  await mkdir(dirname(target), { recursive: true });
  await sharp(raw, { raw: { width: 20, height: 40, channels: 3, pageHeight: 20 }, pages: 2 }).gif({ delay: [120, 120], loop: 0 }).toFile(target);
}

/** 四通道 PNG：JPEG 编码必须把透明背景落到白色，而不是 sharp 默认的黑色。 */
async function transparentPhoto(target: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  await sharp({ create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } } }).png().toFile(target);
}

/** 每个文件的相对路径、大小、mtime 与哈希，用于证明输入目录未被改动。 */
async function fingerprint(root: string): Promise<string[]> {
  const entries: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((left, right) => (left.name < right.name ? -1 : 1))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { await walk(full); continue; }
      const info = await stat(full);
      const hash = createHash('sha256').update(await readFile(full)).digest('hex');
      entries.push(`${relative(root, full)}|${info.size}|${info.mtimeMs}|${hash}`);
    }
  };
  await walk(root);
  return entries;
}

it('递归遍历并保留子目录结构，全部输出为 JPEG', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'a.jpg'), 400, 300);
  await photo(join(input, 'sub', 'b.png'), 320, 240, 'png');
  await photo(join(input, 'sub', 'deep', 'c.webp'), 300, 200, 'webp');
  const report = await runCompress(options(input, { out }));
  // 跳过计数包含两个子目录 sub、sub/deep。
  expect([report.succeeded, report.skipped, report.failed]).toEqual([3, 2, 0]);
  expect((await readdir(out)).sort()).toEqual(['a.jpg', 'sub']);
  for (const path of ['a.jpg', 'sub/b.jpg', 'sub/deep/c.jpg']) {
    const info = await metadata(join(out, path));
    expect([path, info.format]).toEqual([path, 'jpeg']);
  }
  expect(await metadata(join(out, 'sub', 'b.jpg'))).toMatchObject({ width: 320, height: 240 });
});

it('超过长边上限的图缩到上限并保持宽高比，未超过的图不放大', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'huge.jpg'), 5000, 4000);
  await photo(join(input, 'small.jpg'), 800, 600);
  await runCompress(options(input, { out }));
  const huge = await metadata(join(out, 'huge.jpg'));
  expect(huge.width).toBe(4096);
  expect(Math.abs(huge.height - 3276.8)).toBeLessThanOrEqual(1);
  expect(Math.abs(huge.width / huge.height - 1.25)).toBeLessThan(0.002);
  expect(await metadata(join(out, 'small.jpg'))).toMatchObject({ width: 800, height: 600 });

  const custom = await runCompress(options(input, { out: `${out}-custom`, maxEdge: 1200 }));
  expect(custom.failed).toBe(0);
  const wide = await metadata(join(`${out}-custom`, 'huge.jpg'));
  expect([wide.width, wide.height]).toEqual([1200, 960]);
  expect(await metadata(join(`${out}-custom`, 'small.jpg'))).toMatchObject({ width: 800, height: 600 });
});

it('按 EXIF Orientation 摆正竖拍照片', async () => {
  const { input, out } = await workspace();
  await twoTonePhoto(join(input, 'rotated6.jpg'), 6);
  await twoTonePhoto(join(input, 'rotated8.jpg'), 8);
  const report = await runCompress(options(input, { out }));
  expect([report.succeeded, report.failed]).toEqual([2, 0]);
  const six = await metadata(join(out, 'rotated6.jpg'));
  expect([six.width, six.height]).toEqual([40, 60]);
  expect([await shade(join(out, 'rotated6.jpg'), 2, 2), await shade(join(out, 'rotated6.jpg'), 2, 57)]).toEqual(['red', 'blue']);
  const eight = await metadata(join(out, 'rotated8.jpg'));
  expect([eight.width, eight.height]).toEqual([40, 60]);
  expect([await shade(join(out, 'rotated8.jpg'), 2, 2), await shade(join(out, 'rotated8.jpg'), 2, 57)]).toEqual(['blue', 'red']);
});

it('默认输出不含 EXIF/GPS，--keep-exif 时保留', async () => {
  const { root, input } = await workspace();
  await photo(join(input, 'tagged.jpg'), 120, 90, 'jpeg', 6);
  const stripped = join(root, 'stripped');
  const kept = join(root, 'kept');
  await runCompress(options(input, { out: stripped }));
  const clean = await metadata(join(stripped, 'tagged.jpg'));
  expect(clean.exif).toBeUndefined();
  expect(clean.orientation).toBeUndefined();
  expect((await readFile(join(stripped, 'tagged.jpg'))).includes(Buffer.from('WangleyouTest'))).toBe(false);

  const report = await runCompress(options(input, { out: kept, keepExif: true }));
  expect(report.failed).toBe(0);
  const tagged = await metadata(join(kept, 'tagged.jpg'));
  expect(tagged.exif?.length ?? 0).toBeGreaterThan(0);
  expect((await readFile(join(kept, 'tagged.jpg'))).includes(Buffer.from('WangleyouTest'))).toBe(true);
  // 像素已按方向摆正，方向标记必须归零，否则查看器会二次旋转。
  expect(tagged.orientation ?? 1).toBe(1);
  expect([tagged.width, tagged.height]).toEqual([90, 120]);
});

it('同一输出目录内的命名冲突按路径字典序保留第一个并追加序号', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'a.jpg'), 40, 30);
  await photo(join(input, 'a.png'), 60, 50, 'png');
  const report = await runCompress(options(input, { out }));
  expect((await readdir(out)).sort()).toEqual(['a-2.jpg', 'a.jpg']);
  expect(await metadata(join(out, 'a.jpg'))).toMatchObject({ width: 40, height: 30 });
  expect(await metadata(join(out, 'a-2.jpg'))).toMatchObject({ width: 60, height: 50 });
  expect(report.renamed).toEqual([{ from: 'a.png', to: 'a-2.jpg' }]);
});

it('非图片、隐藏文件与目录被跳过并计入跳过计数', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'keep.jpg'), 100, 100);
  await photo(join(input, 'sub', 'nested.png'), 100, 100, 'png');
  await photo(join(input, '.hidden', 'secret.jpg'), 100, 100);
  await writeFile(join(input, 'notes.txt'), 'notes');
  await writeFile(join(input, '.DS_Store'), 'junk');
  const report = await runCompress(options(input, { out }));
  expect([report.succeeded, report.failed]).toEqual([2, 0]);
  // 跳过计数包含 notes.txt、.DS_Store、隐藏目录 .hidden 与子目录 sub。
  expect(report.skipped).toBe(4);
  expect((await readdir(out)).sort()).toEqual(['keep.jpg', 'sub']);
  expect((await readdir(join(out, 'sub'))).sort()).toEqual(['nested.jpg']);
  await expect(stat(join(out, 'notes.txt'))).rejects.toThrow();
});

it('动图 GIF 只取首帧', async () => {
  const { input, out } = await workspace();
  const source = join(input, 'animated.gif');
  await animatedGif(source);
  expect((await sharp(source, { animated: true }).metadata()).pages).toBe(2);
  const report = await runCompress(options(input, { out }));
  expect([report.succeeded, report.failed]).toEqual([1, 0]);
  const info = await metadata(join(out, 'animated.jpg'));
  expect([info.width, info.height, info.pages ?? 1]).toEqual([20, 20, 1]);

  // 输出应与首帧一致，而不是整段动图的拼接结果。
  const first = await sharp(source, { page: 0, pages: 1 }).raw().toBuffer({ resolveWithObject: true });
  const produced = await sharp(join(out, 'animated.jpg')).raw().toBuffer({ resolveWithObject: true });
  expect([produced.info.width, produced.info.height]).toEqual([first.info.width, first.info.height]);
  const sample = (image: typeof first, x: number, y: number) => {
    const offset = (y * image.info.width + x) * image.info.channels;
    return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
  };
  for (const [x, y] of [[0, 0], [10, 10], [19, 19]]) {
    const before = sample(first, x, y);
    expect(Math.max(...sample(produced, x, y).map((value, channel) => Math.abs(value - before[channel])))).toBeLessThan(16);
  }
});

it('损坏文件只计入失败，其他文件照常处理并以退出码 1 结束', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'good.jpg'), 200, 150);
  await writeFile(join(input, 'broken.jpg'), 'this is not an image');
  const sink = capture();
  expect(await main([input, '--out', out], { log: sink.log })).toBe(1);
  expect(await readdir(out)).toEqual(['good.jpg']);
  const report = await runCompress(options(input, { out }));
  expect(report.failures.map(failure => failure.rel)).toEqual(['broken.jpg']);
  expect(report.failures[0].reason).toContain('unsupported image format');
  expect(sink.lines).toContain('处理完成：成功 1，跳过 0，失败 1');
});

it('--dry-run 只扫描并打印计划，不产生任何输出文件', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'a.jpg'), 1200, 800);
  await photo(join(input, 'sub', 'b.png'), 200, 100, 'png');
  const sink = capture();
  expect(await main([input, '--out', out, '--dry-run'], { log: sink.log })).toBe(0);
  await expect(stat(out)).rejects.toThrow();
  expect(sink.lines).toContainEqual(expect.stringMatching(/^\[演练\] a\.jpg：.+（1200×800）→ 预估 .+（1200×800）$/));
  expect(sink.lines).toContainEqual(expect.stringMatching(/^\[演练\] sub\/b\.png：/));
  expect(sink.lines.join('\n')).toContain('演练模式：未写入任何文件');
});

it('输入目录不存在或参数非法时以退出码 2 结束', async () => {
  const { root, input } = await workspace();
  await photo(join(input, 'a.jpg'), 100, 100);
  const sink = capture();
  expect(await main([join(root, 'missing')], { log: sink.log })).toBe(2);
  expect(sink.lines.join('\n')).toContain('输入目录不存在或无法访问');
  expect(await main([], { log: sink.log })).toBe(2);
  expect(await main(['--quality', '0'], { log: sink.log })).toBe(2);
  expect(await main([input, '--out', input], { log: sink.log })).toBe(2);
  expect(sink.lines.join('\n')).toContain('输出目录不能与输入目录相同');
});

it('重复运行覆盖既有输出，且不删除输出目录中的无关文件', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'a.jpg'), 300, 200);
  expect((await runCompress(options(input, { out }))).succeeded).toBe(1);
  await writeFile(join(out, 'keep-me.txt'), 'unrelated');
  const second = await runCompress(options(input, { out }));
  expect([second.succeeded, second.failed]).toEqual([1, 0]);
  expect(await readFile(join(out, 'keep-me.txt'), 'utf8')).toBe('unrelated');
  expect(await metadata(join(out, 'a.jpg'))).toMatchObject({ width: 300, height: 200 });
});

it('源目录在处理前后哈希与 mtime 完全一致', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'a.jpg'), 300, 200);
  await photo(join(input, 'sub', 'b.png'), 200, 300, 'png');
  await writeFile(join(input, 'notes.txt'), 'notes');
  await writeFile(join(input, 'broken.jpg'), 'broken');
  const before = await fingerprint(input);
  const report = await runCompress(options(input, { out }));
  expect(report.succeeded).toBe(2);
  expect(await fingerprint(input)).toEqual(before);
});

it('无 HEIC 解码器时计入失败并给出可执行建议', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'ok.jpg'), 200, 200);
  await writeFile(join(input, 'clip.heic'), 'not a real heic file');
  const sink = capture();
  // 注入探测替身：模拟系统里没有任何 HEIC 解码器，不依赖真实 HEIC 文件。
  const code = await main([input, '--out', out], { log: sink.log, probeCommand: () => null });
  expect(code).toBe(1);
  expect(await readdir(out)).toEqual(['ok.jpg']);
  const text = sink.lines.join('\n');
  expect(text).toContain('未找到可用的 HEIC 解码器');
  expect(text).toContain('libheif');
  expect(text).toContain('HEIC 解码器：未找到');
});

it('HEIC 按策略调用外部解码器，临时文件用后清理', async () => {
  const { root, input, out } = await workspace();
  await writeFile(join(input, 'clip.heic'), 'not a real heic file');
  const prepared = join(root, 'decoded.jpg');
  await photo(prepared, 144, 96);
  const decoder = join(root, 'fake-heif-convert');
  await writeFile(decoder, `#!/bin/sh\ncp "${prepared}" "$2"\n`, { mode: 0o755 });
  const sink = capture();
  const code = await main([input, '--out', out, '--heic-via', 'heif-convert'], { log: sink.log, probeCommand: command => (command === 'heif-convert' ? decoder : null) });
  expect(code).toBe(0);
  expect(await metadata(join(out, 'clip.jpg'))).toMatchObject({ width: 144, height: 96 });
  expect(sink.lines.join('\n')).toContain(decoder);
  const leftovers = (await readdir(tmpdir())).filter(name => name.startsWith(`wangleyou-compress-${process.pid}-`));
  expect(leftovers).toEqual([]);
});

it('--heic-via none 跳过 HEIC 文件并警告', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'ok.jpg'), 100, 100);
  await writeFile(join(input, 'clip.heif'), 'not a real heic file');
  const sink = capture();
  expect(await main([input, '--out', out, '--heic-via', 'none'], { log: sink.log, probeCommand: () => null })).toBe(0);
  const report = await runCompress(options(input, { out, heicVia: 'none' }));
  expect([report.succeeded, report.skipped, report.failed]).toEqual([1, 1, 0]);
  expect(sink.lines.join('\n')).toContain('跳过：clip.heif');
  expect((await readdir(out)).sort()).toEqual(['ok.jpg']);
});

it('sharp 直接解码 HEIC 时报告成功，而不是误报未找到解码器', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'direct.heic'), 120, 80);
  const sink = capture();
  const report = await runCompress(options(input, { out }), { log: sink.log, probeCommand: () => null });
  expect([report.succeeded, report.failed, report.heicFiles]).toEqual([1, 0, 1]);
  expect([report.heicDirectlyDecoded, report.heicExternallyDecoded, report.heicFailed]).toEqual([1, 0, 0]);
  expect(await metadata(join(out, 'direct.jpg'))).toMatchObject({ width: 120, height: 80 });
  const summary = formatReport(report).join('\n');
  expect(summary).toContain('sharp 直接解码（1/1 个）');
  expect(summary).not.toContain('HEIC 解码器：未找到');
});

it('透明 PNG 输出 JPEG 时填白背景', async () => {
  const { input, out } = await workspace();
  await transparentPhoto(join(input, 'transparent.png'));
  const report = await runCompress(options(input, { out }));
  expect([report.succeeded, report.failed]).toEqual([1, 0]);
  const { data, info } = await sharp(join(out, 'transparent.jpg')).raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([20, 20, 3]);
  expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]);
});

it('输出目录位于输入目录内或通过 symlink 指向输入目录时拒绝执行', async () => {
  const { root, input } = await workspace();
  await photo(join(input, 'a.jpg'), 100, 80);
  const nested = join(input, 'compressed');
  const sink = capture();
  expect(await main([input, '--out', nested], { log: sink.log, probeCommand: () => null })).toBe(2);
  expect(sink.lines.join('\n')).toContain('输出目录不能与输入目录相同或位于输入目录内');
  await expect(stat(nested)).rejects.toThrow();

  const realInput = join(root, 'real-input');
  await mkdir(realInput, { recursive: true });
  await photo(join(realInput, 'a.jpg'), 100, 80);
  const inputAlias = join(root, 'input-alias');
  await symlink(realInput, inputAlias);
  const aliasSink = capture();
  expect(await main([inputAlias, '--out', realInput], { log: aliasSink.log, probeCommand: () => null })).toBe(2);
  expect(aliasSink.lines.join('\n')).toContain('输出目录不能与输入目录相同或位于输入目录内');
});

it('体积变大时单独列出', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'tiny.png'), 8, 8, 'png');
  const report = await runCompress(options(input, { out }));
  expect(report.grown.map(item => item.rel)).toEqual(['tiny.png']);
  expect(report.grown[0].outputBytes).toBeGreaterThan(report.grown[0].originalBytes);
});
