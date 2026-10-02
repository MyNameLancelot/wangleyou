import { createHash } from 'node:crypto'
import { copyFile, lstat, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { readPhotoIndex } from './generate-photo-index'
import { validatePublishedContent } from './validate-content'
import { assertAssetPath, validateHomeMemory } from '../src/content/validate'
import type { Photo } from '../src/content/model'

const SOURCE_ROOT = 'media-source'
const PUBLIC_ROOT = 'public'
const OUTPUT_ROOT = 'public/media'
const INDEX_PATH = 'src/content/generated-photo-index.json'
const CACHE_PATH = '.cache/media-variants/manifest.json'
const WIDTHS = [480, 960, 1600, 2560] as const
// 编码参数或派生输出布局变化时必须提升版本，避免复用到旧路径的清单条目。
const PROFILE = 'webp-q80-effort4-v3'
// 缺封面源素材时用占位封面；提升版本即可让占位封面重新生成。
const POSTER_PLACEHOLDER_PROFILE = 'video-poster-placeholder-v1'
const POSTER_PLACEHOLDER_SIZE = { width: 1600, height: 900 } as const
type Variant = { src: string; width: number; height: number }
type Entry = { hash: string; variants: Variant[]; width: number; height: number }
/** 已发布的视频：源文件相对路径 → 内容哈希与发布地址，用于跳过重复复制并清理旧产物。 */
type VideoEntry = { hash: string; src: string }
type Manifest = { version: 2; entries: Record<string, Entry>; videos: Record<string, VideoEntry> }

const emptyManifest = (): Manifest => ({ version: 2, entries: {}, videos: {} })
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0
const validHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

/** 缓存是可重建的提示，不信任未知结构/版本及任意删除路径。 */
async function loadManifest(): Promise<Manifest> {
  try {
    const stored: unknown = JSON.parse(await readFile(CACHE_PATH, 'utf8'))
    if (!record(stored) || ![1, 2].includes(stored.version as number) || !record(stored.entries) || (stored.videos !== undefined && !record(stored.videos))) return emptyManifest()
    const partsOf = (key: string) => {
      const source = key.replace(/#poster$/, '')
      assertAssetPath(source, 'manifest key')
      const parts = source.split('/')
      if (parts.length !== 2 || !/^\d{4}-\d{2}-sequence\d{2}-.+$/.test(parts[0])) throw new Error('invalid cache source')
      return parts
    }
    for (const [key, entry] of Object.entries(stored.entries)) {
      const [album, file] = partsOf(key)
      if (!record(entry) || !validHash(entry.hash) || !positiveInteger(entry.width) || !positiveInteger(entry.height) || !Array.isArray(entry.variants) || !entry.variants.length) return emptyManifest()
      const stem = basename(file, extname(file)) + (key.endsWith('#poster') ? '.poster' : '')
      const seen = new Set<number>()
      for (const variant of entry.variants) {
        if (!record(variant) || !positiveInteger(variant.width) || !positiveInteger(variant.height) || variant.width > entry.width || seen.has(variant.width) || Math.abs(variant.height - variant.width * entry.height / entry.width) > 1) return emptyManifest()
        if (variant.src !== `media/${album}/${stem}.${entry.hash.slice(0, 12)}.${variant.width}.webp`) return emptyManifest()
        seen.add(variant.width)
      }
    }
    for (const [key, video] of Object.entries(stored.videos ?? {})) {
      const [album, file] = partsOf(key)
      if (!record(video) || !validHash(video.hash) || extname(file).toLowerCase() !== '.mp4' || video.src !== `media/${album}/${basename(file, extname(file))}.${video.hash.slice(0, 12)}${extname(file)}`) return emptyManifest()
    }
    return { version: 2, entries: stored.entries as Record<string, Entry>, videos: (stored.videos ?? {}) as Record<string, VideoEntry> }
  } catch {
    return emptyManifest()
  }
}

/** 两个文件先完整暂存；索引作为最后提交点，失败恢复缓存，旧媒体仍然有效。 */
async function commitPublishedFiles(manifest: Manifest, generated: unknown): Promise<void> {
  const staged: string[] = []
  let cacheCommitted = false
  let backup: string | undefined
  try {
    for (const path of [CACHE_PATH, INDEX_PATH]) {
      const target = await lstat(path).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return null
        throw error
      })
      if (target && !target.isFile()) throw new Error(`${path}: 发布目标必须是普通文件`)
      await mkdir(dirname(path), { recursive: true })
      staged.push(await mkdtemp(join(dirname(path), '.media-publish-')))
    }
    const cacheStage = join(staged[0], 'next.json')
    const indexStage = join(staged[1], 'next.json')
    await writeFile(cacheStage, `${JSON.stringify(manifest, null, 2)}\n`)
    await writeFile(indexStage, `${JSON.stringify(generated, null, 2)}\n`)
    try {
      const previous = await readFile(CACHE_PATH)
      backup = join(staged[0], 'previous.json')
      await writeFile(backup, previous)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await rename(cacheStage, CACHE_PATH)
    cacheCommitted = true
    await rename(indexStage, INDEX_PATH)
  } catch (error) {
    if (cacheCommitted) {
      if (backup) await rename(backup, CACHE_PATH)
      else await rm(CACHE_PATH, { force: true })
    }
    throw error
  } finally {
    await Promise.all(staged.map(path => rm(path, { recursive: true, force: true }).catch(error => console.warn(`暂存目录清理失败 ${path}: ${String(error)}`))))
  }
}
const exists = async (path: string) => stat(path).then(() => true).catch(() => false)
const digest = async (path: string) => createHash('sha256').update(PROFILE).update(await readFile(path)).digest('hex')
const sourceKeyOf = (path: string) => relative(SOURCE_ROOT, path).split('\\').join('/')
const sourcePathOf = (src: string) => join(SOURCE_ROOT, src.replace(/^media\//, ''))

/** 生成目录不能通过祖先 symlink 逃逸；逐层建立，避免 mkdir 先写入链接目标。 */
async function prepareMediaFolder(folder: string): Promise<void> {
  let cursor = '.'
  for (const part of folder.split('/')) {
    if (part === '..') throw new Error(`${folder}: 非法生成目录`)
    cursor = join(cursor, part)
    await mkdir(cursor).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error })
    const info = await lstat(cursor)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${cursor}: 生成目录不能是链接`)
  }
}

async function writeMedia<T>(output: string, encode: (temporary: string) => Promise<T>, created: Set<string>): Promise<T> {
  await prepareMediaFolder(dirname(output))
  const target = await lstat(output).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return null
    throw error
  })
  if (target && !target.isFile()) throw new Error(`${output}: 生成目标不能是链接或目录`)
  const temporary = await mkdtemp(join(dirname(output), '.media-encode-'))
  try {
    const stage = join(temporary, basename(output))
    const result = await encode(stage)
    await prepareMediaFolder(dirname(output))
    await rename(stage, output)
    if (!target) created.add(output)
    return result
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

async function cachedVariantsPresent(entry: Entry): Promise<boolean> {
  const results = await Promise.all(entry.variants.map(async item => {
    try {
      const path = join(PUBLIC_ROOT, item.src)
      if (!(await lstat(path)).isFile()) return false
      const actual = await sharp(path).metadata()
      return actual.format === 'webp' && actual.width === item.width && actual.height === item.height
    } catch { return false }
  }))
  return results.every(Boolean)
}

async function variants(sourceRoot: string, sourcePath: string, manifest: Manifest, created: Set<string>): Promise<Entry> {
  const rel = relative(sourceRoot, sourcePath).split('\\').join('/')
  const hash = await digest(sourcePath)
  const old = manifest.entries[rel]
  const sourceInfo = await sharp(sourcePath).metadata()
  const sourceWidth = sourceInfo.autoOrient.width
  const sourceHeight = sourceInfo.autoOrient.height
  if (old?.hash === hash && old.width === sourceWidth && old.height === sourceHeight && await cachedVariantsPresent(old)) return old
  const normalized = await sharp(sourcePath).rotate().raw().toBuffer({ resolveWithObject: true })
  const width = normalized.info.width
  const height = normalized.info.height
  if (!width || !height) throw new Error(`${rel}: 无法读取图片尺寸`)
  const stem = basename(rel, extname(rel))
  const folder = join(OUTPUT_ROOT, relative(sourceRoot, sourcePath), '..')
  const result: Variant[] = []
  const widths = WIDTHS.filter(value => value <= width)
  for (const targetWidth of widths.length ? widths : [width]) {
    const filename = `${stem}.${hash.slice(0, 12)}.${targetWidth}.webp`
    const output = join(folder, filename)
    const encoded = await writeMedia(output, temporary => sharp(normalized.data, { raw: { width, height, channels: normalized.info.channels } }).resize({ width: targetWidth, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(temporary), created)
    result.push({ src: `media/${relative(OUTPUT_ROOT, output).split('\\').join('/')}`, width: encoded.width, height: encoded.height })
  }
  if (!result.length) throw new Error(`${rel}: 图片宽度无效`)
  return { hash, variants: result, width, height }
}

/**
 * 视频按内容哈希发布到相册目录，与照片派生资源同层。
 * 目标文件名由内容决定：字节不变时目标已存在，因此不会重复复制。
 */
async function publishVideo(sourcePath: string, created: Set<string>): Promise<VideoEntry> {
  const hash = createHash('sha256').update(await readFile(sourcePath)).digest('hex')
  const extension = extname(sourcePath)
  const folder = join(OUTPUT_ROOT, relative(SOURCE_ROOT, sourcePath), '..')
  const target = join(folder, `${basename(sourcePath, extension)}.${hash.slice(0, 12)}${extension}`)
  const src = `media/${relative(OUTPUT_ROOT, target).split('\\').join('/')}`
  if (!(await exists(target))) {
    await writeMedia(target, temporary => copyFile(sourcePath, temporary), created)
  }
  return { hash, src }
}

/**
 * 视频没有提供封面源素材时的占位封面：构建期渲染中立的深色底纹，再走同一套 WebP 派生与缓存。
 * 播放标识由页面按媒体类型叠加，不烘焙进资源，因此相册层叠封面与查看器海报都保持干净。
 */
async function placeholderPoster(sourceKey: string, videoPath: string, videoHash: string, manifest: Manifest, created: Set<string>): Promise<Entry> {
  const key = `${sourceKey}#poster`
  const hash = createHash('sha256').update(POSTER_PLACEHOLDER_PROFILE).update(videoHash).digest('hex')
  const old = manifest.entries[key]
  if (old?.hash === hash && old.width === POSTER_PLACEHOLDER_SIZE.width && old.height === POSTER_PLACEHOLDER_SIZE.height && await cachedVariantsPresent(old)) return old
  const { width, height } = POSTER_PLACEHOLDER_SIZE
  const stem = basename(videoPath, extname(videoPath))
  const folder = join(OUTPUT_ROOT, relative(SOURCE_ROOT, videoPath), '..')
  const source = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="base" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#243138"/><stop offset="1" stop-color="#121a1e"/></linearGradient><radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#7fb0b6" stop-opacity="0.26"/><stop offset="1" stop-color="#7fb0b6" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#base)"/><rect width="${width}" height="${height}" fill="url(#glow)"/></svg>`)
  const result: Variant[] = []
  for (const targetWidth of WIDTHS.filter(value => value <= width)) {
    const output = join(folder, `${stem}.poster.${hash.slice(0, 12)}.${targetWidth}.webp`)
    await writeMedia(output, temporary => sharp(source).resize({ width: targetWidth }).webp({ quality: 80, effort: 4 }).toFile(temporary), created)
    result.push({ src: `media/${relative(OUTPUT_ROOT, output).split('\\').join('/')}`, width: targetWidth, height: Math.round(height * targetWidth / width) })
  }
  const entry: Entry = { hash, variants: result, width, height }
  manifest.entries[key] = entry
  return entry
}

export async function generateMedia(): Promise<void> {
  const created = new Set<string>()
  try {
    const manifest = await loadManifest()
    const previousEntries = { ...manifest.entries }
    const previousVideos = { ...manifest.videos }
    const generated = await readPhotoIndex(SOURCE_ROOT)
    const bySource = new Map<string, Photo>()
    const publishedVideos = new Map<string, VideoEntry>()
    const derivable = new Set<string>()
    /** 照片与视频封面共用同一套 WebP 派生与缓存。 */
    const derive = async (sourcePath: string): Promise<Entry> => {
      const entry = await variants(SOURCE_ROOT, sourcePath, manifest, created)
      manifest.entries[sourceKeyOf(sourcePath)] = entry
      derivable.add(sourceKeyOf(sourcePath))
      return entry
    }
    for (const album of generated.content.albums) for (const media of album.media) {
      const sourcePath = sourcePathOf(media.src)
      const sourceKey = sourceKeyOf(sourcePath)
      if (media.type === 'video') {
        const published = await publishVideo(sourcePath, created)
        const posterSource = sourcePathOf(media.poster)
        // 有封面源素材就派生真实帧；没有则由构建期生成中立的占位封面，视频仍然可发布。
        let poster: Entry
        if (await exists(posterSource)) {
          poster = await derive(posterSource)
        } else {
          poster = await placeholderPoster(sourceKey, sourcePath, published.hash, manifest, created)
          derivable.add(`${sourceKey}#poster`)
        }
        Object.assign(media, {
          src: published.src,
          poster: poster.variants.at(-1)!.src,
          posterSrcSet: poster.variants,
          width: poster.width,
          height: poster.height,
        })
        publishedVideos.set(sourceKey, published)
        continue
      }
      const entry = await derive(sourcePath)
      Object.assign(media, { src: entry.variants.at(-1)!.src, width: entry.width, height: entry.height, srcSet: entry.variants })
      bySource.set(sourcePath, media)
    }
    generated.homeMemory = generated.homeMemory.map(photo => {
      const generatedPhoto = bySource.get(sourcePathOf(photo.src))
      return generatedPhoto ? { ...photo, src: generatedPhoto.src, width: generatedPhoto.width, height: generatedPhoto.height, srcSet: generatedPhoto.srcSet } : photo
    })
    validateHomeMemory(generated.homeMemory)
    await validatePublishedContent(generated.content, PUBLIC_ROOT)
    const obsolete: string[] = []
    for (const [key, entry] of Object.entries(previousEntries)) {
      const current = derivable.has(key) ? manifest.entries[key] : undefined
      const retained = new Set(current?.variants.map(item => item.src))
      obsolete.push(...entry.variants.filter(item => !retained.has(item.src)).map(item => item.src))
      if (!current) delete manifest.entries[key]
    }
    for (const [key, entry] of Object.entries(previousVideos)) {
      if (publishedVideos.get(key)?.src !== entry.src) obsolete.push(entry.src)
    }
    manifest.videos = Object.fromEntries(publishedVideos)
    manifest.version = 2
    await commitPublishedFiles(manifest, generated)
    // 发布后才删除旧哈希；清理失败不把成功提交伪装为派生失败，下轮仍可重建。
    await Promise.all(obsolete.map(async path => {
      try {
        await prepareMediaFolder(dirname(join(PUBLIC_ROOT, path)))
        await rm(join(PUBLIC_ROOT, path), { force: true })
      } catch (error) { console.warn(`旧媒体清理失败 ${path}: ${String(error)}`) }
    }))
  } catch (error) {
    // 只回收当前调用明确拥有的新产物，绝不删除先前发布索引可能引用的文件。
    await Promise.all([...created].map(async path => {
      try {
        await prepareMediaFolder(dirname(path))
        await rm(path, { force: true })
      } catch (cleanupError) { console.warn(`未发布媒体清理失败 ${path}: ${String(cleanupError)}`) }
    }))
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) generateMedia().then(() => console.log('媒体派生完成')).catch(error => { console.error(error); process.exitCode = 1 })
