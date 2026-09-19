import { accessSync, constants, statSync } from 'node:fs';
import { mkdir, readdir, realpath, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { cpus, tmpdir } from 'node:os';
import { basename, delimiter, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

/**
 * 发布照片离线预处理命令：统一为 JPEG、长边封顶、剥离元数据。
 * 与站点运行时解耦：不导入 src，不改变页面行为，只读输入目录。
 */

/** 按扩展名判断的可处理图片格式，大小写不敏感。 */
export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif', '.heic', '.heif']);
const HEIC_EXTENSIONS = new Set(['.heic', '.heif']);
export const DEFAULT_MAX_EDGE = 4096;
export const DEFAULT_QUALITY = 82;
export const DEFAULT_CONCURRENCY = 4;

export type HeicStrategy = 'auto' | 'sips' | 'heif-convert' | 'magick' | 'none';
type HeicCommand = Exclude<HeicStrategy, 'auto' | 'none'>;
const HEIC_STRATEGIES: readonly HeicStrategy[] = ['auto', 'sips', 'heif-convert', 'magick', 'none'];
/** auto 模式的探测顺序：macOS 自带 sips 优先，其次 libheif、ImageMagick。 */
const AUTO_HEIC_ORDER: readonly HeicCommand[] = ['sips', 'heif-convert', 'magick'];
/** 并发上限另有 CPU 核数约束，这里只拦明显异常的输入。 */
const MAX_CONCURRENCY = 1024;
const MAX_EDGE_LIMIT = 65535;

const USAGE = [
  '用法：npm run compress:photos -- <输入目录> [选项]',
  '  把目录中的图片统一压缩为发布用 JPEG：长边封顶、剥离元数据、按 EXIF 方向摆正。',
  '',
  '选项：',
  `  --out <目录>        输出根目录，默认 "<输入目录>_compressed"`,
  `  --max-edge <n>      长边上限，默认 ${DEFAULT_MAX_EDGE}（DCI 4K；UHD 口径可传 3840）`,
  `  --quality <1-100>   JPEG 质量，默认 ${DEFAULT_QUALITY}`,
  '  --keep-exif         保留 EXIF 等元数据，默认全部剥离',
  `  --concurrency <n>   并发处理数，默认 ${DEFAULT_CONCURRENCY}，上限为 CPU 核数`,
  '  --dry-run           只扫描并打印计划与预估结果，不写任何文件',
  '  --heic-via <auto|sips|heif-convert|magick|none>  HEIC 解码策略，默认 auto',
  '  -h, --help          显示本帮助',
  '',
  '退出码：0 全部成功；1 存在处理失败；2 参数或环境错误。',
].join('\n');

/** 参数与环境错误：由 CLI 转成可读提示和退出码 2，不打印裸栈。 */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export interface CompressOptions {
  input: string;
  out: string;
  maxEdge: number;
  quality: number;
  keepExif: boolean;
  concurrency: number;
  dryRun: boolean;
  heicVia: HeicStrategy;
  /** 参数被自动调整时给用户的提示。 */
  notes: string[];
}

export interface CompressReport {
  outDir: string;
  dryRun: boolean;
  succeeded: number;
  skipped: number;
  failed: number;
  /** 成功文件的原始总字节。 */
  originalBytes: number;
  /** 成功文件的输出总字节；dry-run 时为估算值。 */
  outputBytes: number;
  renamed: { from: string; to: string }[];
  grown: { rel: string; outRel: string; originalBytes: number; outputBytes: number }[];
  failures: { rel: string; reason: string }[];
  /** 本次实际使用过的 HEIC 解码器绝对路径。 */
  heicDecoderPath: string | null;
  /** 解码器是否真的成功解码过 HEIC 文件。 */
  heicDecoderWorked: boolean;
  /** 本次扫描到的 HEIC/HEIF 文件数。 */
  heicFiles: number;
  /** sharp 直接解码成功的 HEIC/HEIF 文件数。 */
  heicDirectlyDecoded: number;
  /** 外部命令解码成功的 HEIC/HEIF 文件数。 */
  heicExternallyDecoded: number;
  /** 处理失败的 HEIC/HEIF 文件数。 */
  heicFailed: number;
  heicSkipped: boolean;
}

/** 命令探测：返回可执行文件的绝对路径，找不到返回 null。 */
export type CommandProbe = (command: string) => string | null;
export type LogFn = (line: string) => void;
export interface CompressDeps {
  log?: LogFn;
  probeCommand?: CommandProbe;
}
type Context = { log: LogFn; probeCommand: CommandProbe; decoderCache: Map<HeicStrategy, Decoder | null> };

interface Decoder {
  command: HeicCommand;
  path: string;
}

/** HEIC 外部解码失败：携带已探测到的解码器路径，便于汇总说明。 */
class HeicDecodeError extends Error {
  decoderPath: string | null;
  constructor(message: string, decoderPath: string | null, cause: unknown) {
    super(message, { cause });
    this.name = 'HeicDecodeError';
    this.decoderPath = decoderPath;
  }
}

interface PlannedFile {
  /** 相对输入目录的路径，作为报告和命名冲突排序的依据。 */
  rel: string;
  /** 绝对输入路径。 */
  input: string;
  /** 相对输出目录的路径，扩展名统一为 .jpg。 */
  outRel: string;
  renamed: boolean;
}

type Dimension = { width: number; height: number };

interface FileOutcome {
  status: 'success' | 'skipped' | 'failed';
  rel: string;
  outRel?: string;
  renamed?: boolean;
  inputBytes: number;
  outputBytes: number;
  heic?: boolean;
  decoderPath?: string | null;
  reason?: string;
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const oneLine = (value: string): string => value.replace(/\s+/g, ' ').replace(/^(?:Error|error):\s*/, '').replace(/[。.\s]+$/, '');

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

function parseInteger(name: string, raw: string, min: number, max: number): number {
  if (!/^\d+$/.test(raw)) throw new UsageError(`${name} 需要整数，收到 "${raw}"`);
  const value = Number(raw);
  if (value < min || value > max) throw new UsageError(`${name} 需要在 ${min}-${max} 之间，收到 ${value}`);
  return value;
}

export function parseArgs(argv: string[]): CompressOptions {
  let input: string | undefined;
  let out: string | undefined;
  let maxEdge = DEFAULT_MAX_EDGE;
  let quality = DEFAULT_QUALITY;
  let concurrency = DEFAULT_CONCURRENCY;
  let keepExif = false;
  let dryRun = false;
  let heicVia: HeicStrategy = 'auto';
  const notes: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      for (const positional of argv.slice(index + 1)) {
        if (input) throw new UsageError(`只能指定一个输入目录，多余的位置参数：${positional}`);
        input = positional;
      }
      break;
    }
    if (arg === '--keep-exif') {
      keepExif = true;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--out' || arg === '--max-edge' || arg === '--quality' || arg === '--concurrency' || arg === '--heic-via') {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} 缺少取值`);
      index += 1;
      if (arg === '--out') out = value;
      else if (arg === '--max-edge') maxEdge = parseInteger('--max-edge', value, 1, MAX_EDGE_LIMIT);
      else if (arg === '--quality') quality = parseInteger('--quality', value, 1, 100);
      else if (arg === '--concurrency') concurrency = parseInteger('--concurrency', value, 1, MAX_CONCURRENCY);
      else {
        if (!HEIC_STRATEGIES.includes(value as HeicStrategy)) {
          throw new UsageError(`--heic-via 只支持 ${HEIC_STRATEGIES.join('、')}，收到 "${value}"`);
        }
        heicVia = value as HeicStrategy;
      }
      continue;
    }
    if (arg.startsWith('-')) throw new UsageError(`未知参数：${arg}`);
    if (input) throw new UsageError(`只能指定一个输入目录，多余的位置参数：${arg}`);
    input = arg;
  }

  if (!input) throw new UsageError(`缺少输入目录。用法：npm run compress:photos -- <输入目录> [选项]`);

  const inputRoot = resolve(input).replace(/(.)[/\\]+$/, '$1');
  const cores = cpus().length || 1;
  if (concurrency > cores) {
    notes.push(`--concurrency ${concurrency} 超过 CPU 核数 ${cores}，已按 ${cores} 并发处理`);
    concurrency = cores;
  }
  return {
    input: inputRoot,
    out: out ? resolve(out) : `${inputRoot}_compressed`,
    maxEdge,
    quality,
    keepExif,
    concurrency,
    dryRun,
    heicVia,
    notes,
  };
}

function defaultProbe(command: string): string | null {
  const suffixes = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE').split(';') : [''];
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const suffix of suffixes) {
      const candidate = join(dir, `${command}${suffix}`);
      try {
        if (!statSync(candidate).isFile()) continue;
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function assertReadableDirectory(root: string): Promise<void> {
  let info;
  try {
    info = await stat(root);
  } catch (error) {
    throw new UsageError(`输入目录不存在或无法访问：${root}（${messageOf(error)}）`);
  }
  if (!info.isDirectory()) throw new UsageError(`输入路径不是目录：${root}`);
  try {
    await readdir(root);
  } catch (error) {
    throw new UsageError(`输入目录不可读：${root}（${messageOf(error)}）`);
  }
}

const samePath = (left: string, right: string): boolean => resolve(left) === resolve(right);

const pathInside = (ancestor: string, descendant: string): boolean => {
  const rel = relative(ancestor, descendant);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** 归一化已存在部分的 symlink；尚未创建的尾部保留在真实父目录之后。 */
async function canonicalPath(target: string): Promise<string> {
  let cursor = resolve(target);
  const missingParts: string[] = [];
  for (;;) {
    try {
      let result = await realpath(cursor);
      for (const part of missingParts) result = join(result, part);
      return result;
    } catch {
      if (cursor === dirname(cursor)) return cursor;
      missingParts.unshift(basename(cursor));
      cursor = dirname(cursor);
    }
  }
}

/** 递归收集候选文件；隐藏项、目录、非白名单文件和输出目录只计数不处理。 */
async function collectFiles(root: string, outputRoot: string): Promise<{ candidates: Omit<PlannedFile, 'outRel' | 'renamed'>[]; skipped: number }> {
  const candidates: Omit<PlannedFile, 'outRel' | 'renamed'>[] = [];
  let skipped = 0;
  const walk = async (dir: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      throw new UsageError(`无法读取目录 ${dir}（${messageOf(error)}）`);
    }
    entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.name.startsWith('.')) {
        // 隐藏文件和隐藏目录（含 .DS_Store）静默跳过。
        skipped += 1;
        continue;
      }
      if (entry.isDirectory()) {
        skipped += 1;
        if (samePath(full, outputRoot)) continue;
        await walk(full);
        continue;
      }
      if (entry.isSymbolicLink()) {
        const target = await stat(full).catch(() => null);
        if (!target || target.isDirectory()) {
          skipped += 1;
          continue;
        }
      }
      if (!IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        skipped += 1;
        continue;
      }
      candidates.push({ rel: relative(root, full), input: full });
    }
  };
  await walk(root);
  candidates.sort((left, right) => (left.rel < right.rel ? -1 : left.rel > right.rel ? 1 : 0));
  return { candidates, skipped };
}

/** 规划输出路径：扩展名统一为 .jpg，同目录命名冲突按字典序追加 -2、-3。 */
function planFiles(candidates: Omit<PlannedFile, 'outRel' | 'renamed'>[]): PlannedFile[] {
  const key = (dir: string, name: string) => (dir === '.' ? name : `${dir}/${name}`).toLowerCase();
  const used = new Set<string>();
  return candidates.map(candidate => {
    const dir = dirname(candidate.rel);
    const stem = basename(candidate.rel, extname(candidate.rel));
    let name = `${stem}.jpg`;
    let suffix = 1;
    while (used.has(key(dir, name))) {
      suffix += 1;
      name = `${stem}-${suffix}.jpg`;
    }
    used.add(key(dir, name));
    return { ...candidate, outRel: dir === '.' ? name : join(dir, name), renamed: name !== `${stem}.jpg` };
  });
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

/** 统一编码管线：先按 EXIF 方向摆正，再等比缩小，最后输出 JPEG。 */
async function encodeToJpeg(input: string, outPath: string, options: CompressOptions): Promise<Dimension> {
  // 默认不调用 withMetadata/keepMetadata，sharp 会剥离全部 EXIF/GPS/时间等元数据。
  let pipeline = sharp(input)
    // 无参 rotate() 按 EXIF Orientation 自动摆正；GIF 等多帧输入默认只读首帧。
    .rotate()
    // JPEG 没有 alpha；显式填白，避免透明 PNG 被默认落到黑色背景。
    .flatten({ background: '#ffffff' })
    .resize({ width: options.maxEdge, height: options.maxEdge, fit: 'inside', withoutEnlargement: true });
  if (options.keepExif) pipeline = pipeline.withMetadata();
  const info = await pipeline
    .jpeg({ quality: options.quality, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
    .toFile(outPath);
  return { width: info.width, height: info.height };
}

async function resolveDecoder(strategy: HeicStrategy, context: Context): Promise<Decoder | null> {
  if (strategy === 'none') return null;
  // 探测结果按策略缓存，避免每个文件重复探测。
  if (context.decoderCache.has(strategy)) return context.decoderCache.get(strategy) ?? null;
  const order: readonly HeicCommand[] = strategy === 'auto' ? AUTO_HEIC_ORDER : [strategy];
  let found: Decoder | null = null;
  for (const command of order) {
    const path = context.probeCommand(command);
    if (path) {
      found = { command, path };
      break;
    }
  }
  context.decoderCache.set(strategy, found);
  return found;
}

let temporaryCounter = 0;
const temporaryJpegPath = () => join(tmpdir(), `wangleyou-compress-${process.pid}-${(temporaryCounter += 1)}.jpg`);

async function decodeExternally(decoder: Decoder, input: string, outPath: string): Promise<void> {
  const args = decoder.command === 'sips' ? ['-s', 'format', 'jpeg', input, '--out', outPath] : [input, outPath];
  await new Promise<void>((settle, fail) => {
    const child = spawn(decoder.path, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < 4000) stderr += chunk.toString();
    });
    child.on('error', error => fail(new Error(error.message)));
    child.on('close', code => {
      if (code === 0) settle();
      else fail(new Error(stderr.trim().split('\n')[0] || `退出码 ${code}`));
    });
  });
  const info = await stat(outPath).catch(() => null);
  if (!info || info.size === 0) throw new Error('外部命令没有生成有效的 JPEG 文件');
}

async function encodeHeic(input: string, outPath: string, options: CompressOptions, context: Context): Promise<{ dimensions: Dimension; decoderPath: string | null }> {
  try {
    // 6a：运行环境的 libvips 带 libheif/libde265 时可直接解码。
    return { dimensions: await encodeToJpeg(input, outPath, options), decoderPath: null };
  } catch (directError) {
    const decoder = await resolveDecoder(options.heicVia, context);
    if (!decoder) {
      const hint = options.heicVia === 'auto' ? '未找到可用的 HEIC 解码器' : `找不到 --heic-via 指定的 ${options.heicVia}`;
      throw new HeicDecodeError(
        `${hint}；sharp 直接解码也失败（${oneLine(messageOf(directError))}）。建议安装 libheif（heif-convert）或 ImageMagick，或改用带 sips 的 macOS；也可先用 --heic-via 指定可用命令。`,
        null,
        directError,
      );
    }
    const temporary = temporaryJpegPath();
    try {
      await decodeExternally(decoder, input, temporary);
      return { dimensions: await encodeToJpeg(temporary, outPath, options), decoderPath: decoder.path };
    } catch (fallbackError) {
      throw new HeicDecodeError(
        `${decoder.command}（${decoder.path}）解码失败：${oneLine(messageOf(fallbackError))}。建议安装 libheif 或改用 macOS 自带的 sips 后重试。`,
        decoder.path,
        fallbackError,
      );
    } finally {
      // 临时文件一律写在系统临时目录，无论成败都清理。
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }
}

const isHeicPath = (path: string): boolean => HEIC_EXTENSIONS.has(extname(path).toLowerCase());

async function readSize(path: string): Promise<number | null> {
  const info = await stat(path).catch(() => null);
  return info?.isFile() ? info.size : null;
}

function failed(task: PlannedFile, inputBytes: number, reason: string, heic = false, decoderPath: string | null = null): FileOutcome {
  return { status: 'failed', rel: task.rel, outRel: task.outRel, renamed: task.renamed, inputBytes, outputBytes: 0, heic, decoderPath, reason };
}

async function processFile(task: PlannedFile, options: CompressOptions, outputRoot: string, context: Context): Promise<FileOutcome> {
  const { log } = context;
  const inputBytes = await readSize(task.input);
  if (inputBytes === null) return failed(task, 0, '无法读取文件，可能已被移动或删除');
  if (inputBytes === 0) return failed(task, 0, '文件为空（0 字节）', isHeicPath(task.input));

  const heic = isHeicPath(task.input);
  if (heic && options.heicVia === 'none') {
    log(`跳过：${task.rel}（--heic-via none，未处理 HEIC）`);
    return { status: 'skipped', rel: task.rel, inputBytes, outputBytes: 0, heic: true, reason: '--heic-via none' };
  }

  const outPath = join(outputRoot, task.outRel);
  try {
    await mkdir(dirname(outPath), { recursive: true });
  } catch (error) {
    return failed(task, inputBytes, `无法创建输出目录（${messageOf(error)}）`, heic);
  }
  const existedBefore = (await readSize(outPath)) !== null;
  try {
    const result = heic ? await encodeHeic(task.input, outPath, options, context) : { dimensions: await encodeToJpeg(task.input, outPath, options), decoderPath: null };
    const outputBytes = (await readSize(outPath)) ?? 0;
    log(`${task.rel}：${formatBytes(inputBytes)} → ${formatBytes(outputBytes)}${task.renamed ? `（输出 ${task.outRel}）` : ''}`);
    return {
      status: 'success',
      rel: task.rel,
      outRel: task.outRel,
      renamed: task.renamed,
      inputBytes,
      outputBytes,
      heic,
      decoderPath: result.decoderPath,
    };
  } catch (error) {
    // 失败隔离：只记录本次文件，不中断整体任务；同时清理本次可能写出的半成品。
    if (!existedBefore) await rm(outPath, { force: true }).catch(() => undefined);
    const reason = messageOf(error);
    log(`失败：${task.rel}（${reason}）`);
    return failed(task, inputBytes, reason, heic, error instanceof HeicDecodeError ? error.decoderPath : null);
  }
}

async function inspectFile(task: PlannedFile, options: CompressOptions, context: Context): Promise<FileOutcome> {
  const { log } = context;
  const inputBytes = await readSize(task.input);
  if (inputBytes === null) return failed(task, 0, '无法读取文件，可能已被移动或删除');
  if (inputBytes === 0) return failed(task, 0, '文件为空（0 字节）', isHeicPath(task.input));

  const heic = isHeicPath(task.input);
  if (heic && options.heicVia === 'none') {
    log(`跳过：${task.rel}（--heic-via none，未处理 HEIC）`);
    return { status: 'skipped', rel: task.rel, inputBytes, outputBytes: 0, heic: true, reason: '--heic-via none' };
  }
  const renamedNote = task.renamed ? `，输出 ${task.outRel}` : '';
  try {
    const metadata = await sharp(task.input).metadata();
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;
    const scale = Math.min(1, options.maxEdge / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    // 体积按像素比例估算：真实编码只在正式运行时发生。
    const estimated = Math.max(1, Math.round(inputBytes * scale * scale));
    log(`[演练] ${task.rel}：${formatBytes(inputBytes)}（${width}×${height}）→ 预估 ${formatBytes(estimated)}（${targetWidth}×${targetHeight}）${renamedNote}`);
    return {
      status: 'success',
      rel: task.rel,
      outRel: task.outRel,
      renamed: task.renamed,
      inputBytes,
      outputBytes: estimated,
      heic,
      decoderPath: null,
    };
  } catch (error) {
    if (!heic) return failed(task, inputBytes, messageOf(error));
    const decoder = await resolveDecoder(options.heicVia, context);
    if (decoder) {
      log(`[演练] ${task.rel}：sharp 无法直接解码，计划用 ${decoder.command}（${decoder.path}）${renamedNote}`);
      return { status: 'success', rel: task.rel, outRel: task.outRel, renamed: task.renamed, inputBytes, outputBytes: inputBytes, heic: true, decoderPath: decoder.path };
    }
    return failed(task, inputBytes, `未找到可用的 HEIC 解码器，sharp 直接解码失败（${messageOf(error)}）。建议安装 libheif（heif-convert）或 ImageMagick，或改用带 sips 的 macOS。`, true);
  }
}

export async function runCompress(options: CompressOptions, deps: CompressDeps = {}): Promise<CompressReport> {
  const log = deps.log ?? ((line: string) => console.log(line));
  sharp.cache(false);
  await assertReadableDirectory(options.input);
  const inputRoot = await canonicalPath(options.input);
  const outputRoot = await canonicalPath(options.out);
  if (samePath(outputRoot, inputRoot) || pathInside(inputRoot, outputRoot)) {
    throw new UsageError('输出目录不能与输入目录相同或位于输入目录内：输入目录必须保持只读。');
  }
  const existingOut = await stat(outputRoot).catch(() => null);
  if (existingOut && !existingOut.isDirectory()) throw new UsageError(`输出路径已存在且不是目录：${outputRoot}`);

  const { candidates, skipped } = await collectFiles(inputRoot, outputRoot);
  const tasks = planFiles(candidates);
  const context: Context = { log, probeCommand: deps.probeCommand ?? defaultProbe, decoderCache: new Map() };
  const outcomes: FileOutcome[] = [];
  const claim = async (task: PlannedFile) => {
    outcomes.push(options.dryRun ? await inspectFile(task, options, context) : await processFile(task, options, outputRoot, context));
  };
  await runPool(tasks, options.concurrency, claim);
  outcomes.sort((left, right) => (left.rel < right.rel ? -1 : left.rel > right.rel ? 1 : 0));

  const succeeded = outcomes.filter(outcome => outcome.status === 'success');
  const failures = outcomes.filter(outcome => outcome.status === 'failed');
  const heicOutcomes = outcomes.filter(outcome => outcome.heic);
  return {
    outDir: outputRoot,
    dryRun: options.dryRun,
    succeeded: succeeded.length,
    skipped: skipped + outcomes.filter(outcome => outcome.status === 'skipped').length,
    failed: failures.length,
    originalBytes: succeeded.reduce((sum, outcome) => sum + outcome.inputBytes, 0),
    outputBytes: succeeded.reduce((sum, outcome) => sum + outcome.outputBytes, 0),
    renamed: succeeded.filter(outcome => outcome.renamed).map(outcome => ({ from: outcome.rel, to: outcome.outRel ?? outcome.rel })),
    grown: succeeded
      .filter(outcome => outcome.outputBytes > outcome.inputBytes)
      .map(outcome => ({ rel: outcome.rel, outRel: outcome.outRel ?? outcome.rel, originalBytes: outcome.inputBytes, outputBytes: outcome.outputBytes })),
    failures: failures.map(outcome => ({ rel: outcome.rel, reason: outcome.reason ?? '未知原因' })),
    heicDecoderPath: outcomes.find(outcome => outcome.decoderPath)?.decoderPath ?? null,
    heicDecoderWorked: outcomes.some(outcome => outcome.status === 'success' && !!outcome.decoderPath),
    heicFiles: heicOutcomes.length,
    heicDirectlyDecoded: heicOutcomes.filter(outcome => outcome.status === 'success' && !outcome.decoderPath).length,
    heicExternallyDecoded: heicOutcomes.filter(outcome => outcome.status === 'success' && !!outcome.decoderPath).length,
    heicFailed: heicOutcomes.filter(outcome => outcome.status === 'failed').length,
    heicSkipped: heicOutcomes.some(outcome => outcome.status === 'skipped'),
  };
}

export function formatReport(report: CompressReport): string[] {
  const lines: string[] = [];
  lines.push(`处理完成：成功 ${report.succeeded}，跳过 ${report.skipped}，失败 ${report.failed}`);
  if (report.dryRun) lines.push('演练模式：未写入任何文件，体积为按像素比例估算的预估值。');
  const ratio = report.originalBytes > 0 ? 1 - report.outputBytes / report.originalBytes : 0;
  const verdict = ratio >= 0 ? `节省 ${(ratio * 100).toFixed(1)}%` : `增加 ${(-ratio * 100).toFixed(1)}%`;
  lines.push(`${report.dryRun ? '预估体积' : '体积'}（成功文件）：${formatBytes(report.originalBytes)} → ${formatBytes(report.outputBytes)}（${verdict}）`);
  if (report.renamed.length) {
    lines.push(`改名（${report.renamed.length} 个，同名冲突按路径字典序保留第一个）：`);
    for (const item of report.renamed) lines.push(`  ${item.from} → ${item.to}`);
  }
  if (report.grown.length) {
    lines.push(`体积变大（${report.grown.length} 个，建议人工复核）：`);
    for (const item of report.grown) lines.push(`  ${item.rel}：${formatBytes(item.originalBytes)} → ${formatBytes(item.outputBytes)}`);
  }
  if (report.failures.length) {
    lines.push(`失败（${report.failures.length} 个）：`);
    for (const item of report.failures) lines.push(`  ${item.rel}：${item.reason}`);
  }
  if (report.succeeded === 0 && report.failed === 0) lines.push('没有找到可处理的图片。');
  lines.push(`HEIC 解码器：${describeDecoder(report)}`);
  lines.push(`${report.dryRun ? '计划输出目录' : '输出目录'}：${report.outDir}`);
  return lines;
}

function describeDecoder(report: CompressReport): string {
  const total = report.heicFiles;
  if (report.heicDecoderPath) {
    const directNote = report.heicDirectlyDecoded > 0 ? `；sharp 直接解码 ${report.heicDirectlyDecoded} 个` : '';
    if (report.dryRun) {
      return `计划使用 ${report.heicDecoderPath}（本次 ${total} 个 HEIC/HEIF 文件${directNote}）`;
    }
    if (report.heicExternallyDecoded > 0) {
      return `${report.heicDecoderPath}（外部解码 ${report.heicExternallyDecoded}/${total} 个${directNote}）`;
    }
    return `${report.heicDecoderPath}（已尝试，但转换失败）`;
  }
  if (report.heicSkipped) return `未使用（--heic-via none，已跳过 ${total} 个 HEIC/HEIF 文件）`;
  if (report.heicDirectlyDecoded > 0 && report.heicFailed === 0) {
    return `sharp 直接解码（${report.heicDirectlyDecoded}/${total} 个）`;
  }
  if (report.heicDirectlyDecoded > 0) {
    return `sharp 直接解码 ${report.heicDirectlyDecoded} 个；其余未找到可用解码器（${report.heicFailed} 个已计入失败）`;
  }
  if (total > 0) return `未找到（本次 ${total} 个 HEIC/HEIF 文件已计入失败）`;
  return '本次未使用（输入目录没有 HEIC/HEIF 文件）';
}

export async function main(argv: string[], deps: CompressDeps = {}): Promise<number> {
  const log = deps.log ?? ((line: string) => console.log(line));
  if (argv.includes('--help') || argv.includes('-h')) {
    log(USAGE);
    return 0;
  }
  let options: CompressOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    log(`参数错误：${messageOf(error)}`);
    log(USAGE);
    return 2;
  }
  for (const note of options.notes) log(`提示：${note}`);
  try {
    const report = await runCompress(options, deps);
    for (const line of formatReport(report)) log(line);
    return report.failed > 0 ? 1 : 0;
  } catch (error) {
    log(`错误：${messageOf(error)}`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
