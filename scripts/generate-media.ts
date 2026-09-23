import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'
import sharp from 'sharp'
import { generatePhotoIndex } from './generate-photo-index'
import type { Media, Photo } from '../src/content/model'

const SOURCE_ROOT = 'media-source'
const PUBLIC_ROOT = 'public'
const OUTPUT_ROOT = 'public/media'
const INDEX_PATH = 'src/content/generated-photo-index.json'
const CACHE_PATH = '.cache/media-variants/manifest.json'
const WIDTHS = [480, 960, 1600, 2560] as const
// 编码参数或派生输出布局变化时必须提升版本，避免复用到旧路径的清单条目。
const PROFILE = 'webp-q80-effort4-v2'
// 缺封面源素材时用占位封面；提升版本即可让占位封面重新生成。
const POSTER_PLACEHOLDER_PROFILE = 'video-poster-placeholder-v1'
const POSTER_PLACEHOLDER_SIZE = { width: 1600, height: 900 } as const
type Variant = { src: string; width: number; height: number }
type Entry = { hash: string; variants: Variant[]; width: number; height: number }
/** 已发布的视频：源文件相对路径 → 内容哈希与发布地址，用于跳过重复复制并清理旧产物。 */
type VideoEntry = { hash: string; src: string }
type Manifest = { version: 2; entries: Record<string, Entry>; videos: Record<string, VideoEntry> }

async function loadManifest(): Promise<Manifest> {
  try {
    // 旧清单（version 1）没有 videos 段，读取时按空段处理，等价于首次发布视频。
    const stored = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as Partial<Manifest>
    return { version: 2, entries: stored.entries ?? {}, videos: stored.videos ?? {} }
  } catch {
    return { version: 2, entries: {}, videos: {} }
  }
}
const exists = async (path: string) => stat(path).then(() => true).catch(() => false)
const digest = async (path: string) => createHash('sha256').update(PROFILE).update(await readFile(path)).digest('hex')
const sourceKeyOf = (path: string) => relative(SOURCE_ROOT, path).split('\\').join('/')
const sourcePathOf = (src: string) => join(SOURCE_ROOT, src.replace(/^media\//, ''))

async function variants(sourceRoot: string, sourcePath: string, manifest: Manifest): Promise<Entry> {
  const rel = relative(sourceRoot, sourcePath).split('\\').join('/')
  const hash = await digest(sourcePath)
  const old = manifest.entries[rel]
  if (old?.hash === hash && await Promise.all(old.variants.map(item => exists(join(PUBLIC_ROOT, item.src)))).then(values => values.every(Boolean))) return old
  const normalized = await sharp(sourcePath).rotate().raw().toBuffer({ resolveWithObject: true })
  const width = normalized.info.width
  const height = normalized.info.height
  if (!width || !height) throw new Error(`${rel}: 无法读取图片尺寸`)
  const stem = basename(rel, extname(rel))
  const folder = join(OUTPUT_ROOT, relative(sourceRoot, sourcePath), '..')
  const result: Variant[] = []
  for (const targetWidth of WIDTHS.filter(value => value <= width)) {
    const targetHeight = Math.round(height * targetWidth / width)
    const filename = `${stem}.${hash.slice(0, 12)}.${targetWidth}.webp`
    const output = join(folder, filename)
    await mkdir(folder, { recursive: true })
    await sharp(normalized.data, { raw: { width, height, channels: normalized.info.channels } }).resize({ width: targetWidth, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toFile(output)
    result.push({ src: `media/${relative(OUTPUT_ROOT, output).split('\\').join('/')}`, width: targetWidth, height: targetHeight })
  }
  if (!result.length) throw new Error(`${rel}: 图片宽度无效`)
  return { hash, variants: result, width, height }
}

/**
 * 视频按内容哈希发布到相册目录，与照片派生资源同层。
 * 目标文件名由内容决定：字节不变时目标已存在，因此不会重复复制。
 */
async function publishVideo(sourcePath: string): Promise<VideoEntry> {
  const hash = createHash('sha256').update(await readFile(sourcePath)).digest('hex')
  const extension = extname(sourcePath)
  const folder = join(OUTPUT_ROOT, relative(SOURCE_ROOT, sourcePath), '..')
  const target = join(folder, `${basename(sourcePath, extension)}.${hash.slice(0, 12)}${extension}`)
  const src = `media/${relative(OUTPUT_ROOT, target).split('\\').join('/')}`
  if (!(await exists(target))) {
    await mkdir(folder, { recursive: true })
    await copyFile(sourcePath, target)
  }
  return { hash, src }
}

/**
 * 视频没有提供封面源素材时的占位封面：构建期渲染中立的深色底纹，再走同一套 WebP 派生与缓存。
 * 播放标识由页面按媒体类型叠加，不烘焙进资源，因此相册层叠封面与查看器海报都保持干净。
 */
async function placeholderPoster(sourceKey: string, videoPath: string, videoHash: string, manifest: Manifest): Promise<Entry> {
  const key = `${sourceKey}#poster`
  const hash = createHash('sha256').update(POSTER_PLACEHOLDER_PROFILE).update(videoHash).digest('hex')
  const old = manifest.entries[key]
  if (old?.hash === hash && await Promise.all(old.variants.map(item => exists(join(PUBLIC_ROOT, item.src)))).then(values => values.every(Boolean))) return old
  const { width, height } = POSTER_PLACEHOLDER_SIZE
  const stem = basename(videoPath, extname(videoPath))
  const folder = join(OUTPUT_ROOT, relative(SOURCE_ROOT, videoPath), '..')
  const source = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="base" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#243138"/><stop offset="1" stop-color="#121a1e"/></linearGradient><radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#7fb0b6" stop-opacity="0.26"/><stop offset="1" stop-color="#7fb0b6" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#base)"/><rect width="${width}" height="${height}" fill="url(#glow)"/></svg>`)
  const result: Variant[] = []
  for (const targetWidth of WIDTHS.filter(value => value <= width)) {
    const output = join(folder, `${stem}.poster.${hash.slice(0, 12)}.${targetWidth}.webp`)
    await mkdir(folder, { recursive: true })
    await sharp(source).resize({ width: targetWidth }).webp({ quality: 80, effort: 4 }).toFile(output)
    result.push({ src: `media/${relative(OUTPUT_ROOT, output).split('\\').join('/')}`, width: targetWidth, height: Math.round(height * targetWidth / width) })
  }
  const entry: Entry = { hash, variants: result, width, height }
  manifest.entries[key] = entry
  return entry
}

export async function generateMedia(): Promise<void> {
  const manifest = await loadManifest()
  await generatePhotoIndex(SOURCE_ROOT, INDEX_PATH)
  const generated = JSON.parse(await readFile(INDEX_PATH, 'utf8')) as { content: { albums: Array<{ media: Media[] }> }; homeMemory: Photo[] }
  const bySource = new Map<string, Photo>()
  const publishedVideos = new Map<string, VideoEntry>()
  const derivable = new Set<string>()
  /** 照片与视频封面共用同一套 WebP 派生与缓存。 */
  const derive = async (sourcePath: string): Promise<Entry> => {
    const entry = await variants(SOURCE_ROOT, sourcePath, manifest)
    manifest.entries[sourceKeyOf(sourcePath)] = entry
    derivable.add(sourceKeyOf(sourcePath))
    return entry
  }
  for (const album of generated.content.albums) for (const media of album.media) {
    const sourcePath = sourcePathOf(media.src)
    const sourceKey = sourceKeyOf(sourcePath)
    if (media.type === 'video') {
      const published = await publishVideo(sourcePath)
      const posterSource = sourcePathOf(media.poster)
      // 有封面源素材就派生真实帧；没有则由构建期生成中立的占位封面，视频仍然可发布。
      let poster: Entry
      if (await exists(posterSource)) {
        poster = await derive(posterSource)
      } else {
        poster = await placeholderPoster(sourceKey, sourcePath, published.hash, manifest)
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
  for (const [key, entry] of Object.entries(manifest.entries)) {
    if (derivable.has(key)) continue
    await Promise.all(entry.variants.map(item => rm(join(PUBLIC_ROOT, item.src), { force: true })))
    delete manifest.entries[key]
  }
  for (const [key, entry] of Object.entries(manifest.videos)) {
    if (publishedVideos.has(key)) continue
    await rm(join(PUBLIC_ROOT, entry.src), { force: true })
    delete manifest.videos[key]
  }
  manifest.videos = Object.fromEntries([...publishedVideos].map(([key, entry]) => [key, entry]))
  manifest.version = 2
  await mkdir(join(CACHE_PATH, '..'), { recursive: true })
  await writeFile(CACHE_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(INDEX_PATH, `${JSON.stringify(generated, null, 2)}\n`)
}

if (import.meta.url.endsWith(process.argv[1] || '')) generateMedia().then(() => console.log('媒体派生完成')).catch(error => { console.error(error); process.exitCode = 1 })
