import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { CAPTION_MAX_LENGTH, validateContent, validateHomeMemory } from '../src/content/validate'
import type { Album, Media, Photo, SiteContent, Video } from '../src/content/model'

const ALBUM_DIR = /^(\d{4})-(\d{2})-sequence(\d{2})-(.+)$/
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
/** 发布形态只收 H.264 + AAC 的 MP4；其它容器由维护者离线转码后再入库。 */
const VIDEO_EXTENSIONS = new Set(['.mp4'])
/** 常见但不在发布形态内的容器：出现在相册目录里就报错，避免被当成无关文件静默忽略。 */
const UNSUPPORTED_VIDEO_EXTENSIONS = new Set(['.mov', '.m4v', '.webm', '.mkv', '.avi', '.wmv', '.flv', '.mpg', '.mpeg', '.3gp', '.ogv', '.hevc', '.ts'])
/** 视频封面源素材的保留名：`<视频同名>.poster.jpg`，与视频同目录维护，构建期派生 WebP。 */
const POSTER_SOURCE = /^(.+)\.poster\.(jpe?g|png|webp)$/i
const TOP_FILE = /^top(\d+)(?=\.|-|_)/i
/** 相册说明只出现在卡片的一行里，超过这个长度就会截断，因此在构建期就拦住。 */
const DESCRIPTION_MAX_LENGTH = 16
const OPENING_MAX_LENGTH = 20

/** 目录级元信息：描述这一段日子本身，而不是某张照片。 */
type AlbumMeta = { title?: string; description?: string; opening?: string; date?: string }
/** 单张照片寄语：photos_meta.captions 里按文件名登记，允许只覆盖一部分照片。 */
type CaptionEntry = { fileName: string; caption: string; location: string }

const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

const stemOf = (file: string) => file.slice(0, file.length - extname(file).length)
const isImage = (file: string) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()) && !POSTER_SOURCE.test(file)
const isVideo = (file: string) => VIDEO_EXTENSIONS.has(extname(file).toLowerCase())
/** 封面源素材对应的视频名，用于把封面绑定到真实视频。 */
const posterOwner = (file: string) => `${POSTER_SOURCE.exec(file)?.[1] ?? stemOf(file)}.mp4`

/** 媒体顺序由构建期决定：topNN 文件优先（N 升序），其余按文件名自然序；照片与视频共用同一条规则。 */
function orderMedia(files: string[]): string[] {
  const tops = files.filter(file => TOP_FILE.test(file)).sort((a, b) => Number(TOP_FILE.exec(a)![1]) - Number(TOP_FILE.exec(b)![1]) || natural.compare(a, b))
  const rest = files.filter(file => !TOP_FILE.test(file)).sort(natural.compare)
  return [...tops, ...rest]
}

/** 媒体 ID 由文件名生成：小写、非字母数字转连字符。 */
function mediaId(file: string): string {
  const base = file.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'media'
}

function readCaptions(name: string, input: unknown): CaptionEntry[] {
  if (input === undefined) return []
  const base = `${name}/meta.json.photos_meta`
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error(`${base}: must be an object`)
  const meta = input as Record<string, unknown>
  const unknownKeys = Object.keys(meta).filter(key => key !== 'captions')
  if (unknownKeys.length) throw new Error(`${base}.${unknownKeys[0]}: 只支持 captions`)
  if (meta.captions === undefined) return []
  if (!Array.isArray(meta.captions)) throw new Error(`${base}.captions: must be an array`)
  return meta.captions.map((item, index) => {
    const location = `${base}.captions[${index}]`
    if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`${location}: must be an object`)
    const entry = item as Record<string, unknown>
    const unknown = Object.keys(entry).filter(key => key !== 'fileName' && key !== 'caption')
    if (unknown.length) throw new Error(`${location}.${unknown[0]}: 只支持 fileName 与 caption`)
    if (typeof entry.fileName !== 'string' || entry.fileName.trim().length === 0) throw new Error(`${location}.fileName: 必须写照片文件名，例如 top01.jpg`)
    if (typeof entry.caption !== 'string') throw new Error(`${location}.caption: must be a string`)
    const caption = entry.caption.trim()
    if (caption.length === 0) throw new Error(`${location}.caption: 必须是非空寄语`)
    if ([...caption].length > CAPTION_MAX_LENGTH) throw new Error(`${location}.caption: 不能超过 ${CAPTION_MAX_LENGTH} 个字符（当前 ${[...caption].length} 个）`)
    return { fileName: entry.fileName, caption, location }
  })
}

/** 寄语按文件名绑定到相册内真实存在的媒体（照片或视频），避免写错文件名后静默丢失。 */
function captionMap(captions: CaptionEntry[], files: string[]): Map<string, string> {
  const known = new Set(files)
  const result = new Map<string, string>()
  for (const entry of captions) {
    if (!known.has(entry.fileName)) throw new Error(`${entry.location}.fileName: 这个相册里没有 ${entry.fileName}`)
    if (result.has(entry.fileName)) throw new Error(`${entry.location}.fileName: ${entry.fileName} 重复登记寄语`)
    result.set(entry.fileName, entry.caption)
  }
  return result
}

function readAlbumMeta(name: string, input: unknown): { album: AlbumMeta; captions: CaptionEntry[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error(`${name}/meta.json: must be an object`)
  const meta = input as Record<string, unknown>
  const unknown = Object.keys(meta).filter(key => key !== 'album' && key !== 'photos_meta')
  if (unknown.length) throw new Error(`${name}/meta.json.${unknown[0]}: 只支持 album 与 photos_meta 段；照片顺序由构建期脚本按文件名生成`)
  const album = (meta.album ?? {}) as Record<string, unknown>
  if (typeof album !== 'object' || album === null || Array.isArray(album)) throw new Error(`${name}/meta.json.album: must be an object`)
  for (const key of ['title', 'description', 'opening', 'date'] as const) {
    if (album[key] !== undefined && typeof album[key] !== 'string') throw new Error(`${name}/meta.json.album.${key}: must be a string when provided`)
  }
  if (typeof album.description === 'string' && [...album.description].length > DESCRIPTION_MAX_LENGTH) {
    throw new Error(`${name}/meta.json.album.description: 不能超过 ${DESCRIPTION_MAX_LENGTH} 个字符（当前 ${[...album.description].length} 个）`)
  }
  if (typeof album.opening === 'string' && (album.opening.trim().length === 0 || [...album.opening.trim()].length > OPENING_MAX_LENGTH)) {
    throw new Error(`${name}/meta.json.album.opening: 必须为 1 至 ${OPENING_MAX_LENGTH} 个非空白字符`)
  }
  return { album: album as AlbumMeta, captions: readCaptions(name, meta.photos_meta) }
}

async function readJson(path: string): Promise<unknown> {
  try { return JSON.parse(await readFile(path, 'utf8')) } catch (error) {
    throw new Error(`${path}: 无法读取 JSON`, { cause: error })
  }
}

export async function generatePhotoIndex(photosDir: string, outputPath: string): Promise<{ content: SiteContent; homeMemory: Photo[] }> {
  const entries = await readdir(photosDir, { withFileTypes: true })
  const albums: Array<{ album: Album; order: string }> = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const match = ALBUM_DIR.exec(entry.name)
    if (!match) throw new Error(`${entry.name}: 相册目录必须命名为 YYYY-MM-sequenceNN-相册名`)
    const directory = join(photosDir, entry.name)
    const details = readAlbumMeta(entry.name, await readJson(join(directory, 'meta.json')))
    const names = (await readdir(directory, { withFileTypes: true })).filter(file => file.isFile()).map(file => file.name)
    const unsupported = names.filter(file => UNSUPPORTED_VIDEO_EXTENSIONS.has(extname(file).toLowerCase())).sort(natural.compare)
    if (unsupported.length) {
      throw new Error(`${entry.name}/${unsupported[0]}: 视频只接受 H.264 + AAC 的 .mp4；请先离线转码（例如 ffmpeg -c:v libx264 -crf 23 -movflags +faststart）再入库`)
    }
    const posters = new Map(names.filter(file => POSTER_SOURCE.test(file)).map(file => [posterOwner(file), file]))
    for (const [owner, poster] of posters) {
      if (!names.includes(owner)) throw new Error(`${entry.name}/${poster}: 找不到同名的视频源文件 ${owner}；封面源素材必须与视频同名`)
    }
    const videos = names.filter(isVideo).sort(natural.compare)
    const images = names.filter(isImage).sort(natural.compare)
    const captions = captionMap(details.captions, [...images, ...videos])
    const media: Media[] = orderMedia([...images, ...videos]).map(file => {
      const caption = captions.get(file)
      const id = mediaId(file)
      if (isVideo(file)) {
        // 封面源素材可选：缺失时 generate-media 会生成中立的占位封面，索引里始终写约定名。
        const poster = posters.get(file) ?? `${stemOf(file)}.poster.jpg`
        return { id, type: 'video', src: `media/${entry.name}/${file}`, poster: `media/${entry.name}/${poster}`, ...(caption ? { caption } : {}) } satisfies Video
      }
      return { id, type: 'photo', src: `media/${entry.name}/${file}`, ...(caption ? { caption } : {}) } satisfies Photo
    })
    albums.push({
      album: {
        id: `${match[1]}-${match[2]}-sequence${match[3]}`,
        title: details.album.title?.trim() || match[4],
        description: details.album.description,
        opening: details.album.opening,
        date: details.album.date || `${match[1]}-${match[2]}`,
        media,
      },
      order: `${match[1]}-${match[2]}-${match[3]}`,
    })
  }

  const content = validateContent({ site: { title: '王乐悠', subtitle: '把一起长大的日子，好好收藏。' }, albums: albums.sort((a, b) => b.order.localeCompare(a.order)).map(item => item.album) })
  const homeMemory = validateHomeMemory(await readJson(join(photosDir, 'home-memory.json')))
  const knownPhotos = new Set(content.albums.flatMap(album => album.media).filter((media): media is Photo => media.type === 'photo').map(photo => photo.src))
  homeMemory.forEach((photo, index) => { if (!knownPhotos.has(photo.src)) throw new Error(`home-memory[${index}].src: 必须引用相册目录中的照片`) })
  await mkdir(join(outputPath, '..'), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({ content, homeMemory }, null, 2)}\n`)
  return { content, homeMemory }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = process.cwd()
  generatePhotoIndex(join(root, 'media-source'), join(root, 'src/content/generated-photo-index.json'))
    .then(({ content, homeMemory }) => {
      const all = content.albums.flatMap(album => album.media)
      const videos = all.filter(media => media.type === 'video').length
      console.log(`媒体索引已生成：${content.albums.length} 个相册，${all.length - videos} 张照片，${videos} 段视频，${homeMemory.length} 张主回忆`)
    })
    .catch((error: Error) => { console.error(error.message); process.exitCode = 1 })
}
