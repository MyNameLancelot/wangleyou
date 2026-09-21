import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateContent, validateHomeMemory } from '../src/content/validate'
import type { Album, Photo, SiteContent } from '../src/content/model'

const ALBUM_DIR = /^(\d{4})-(\d{2})-sequence(\d{2})-(.+)$/
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const TOP_FILE = /^top(\d+)(?=\.|-|_)/i

/** 目录级元信息：描述这一段日子本身，而不是某张照片。 */
type AlbumMeta = { title?: string; description?: string; date?: string }
type PhotoEntry = Omit<Photo, 'type' | 'src'> & { file: string }
type Meta = { album?: AlbumMeta; photos: PhotoEntry[] }

const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** topNN 文件优先（N 升序），其余按 meta.json 的 photos 数组顺序。 */
function orderPhotos(files: string[], entries: PhotoEntry[]): string[] {
  const tops = files.filter(file => TOP_FILE.test(file)).sort((a, b) => Number(TOP_FILE.exec(a)![1]) - Number(TOP_FILE.exec(b)![1]) || natural.compare(a, b))
  return [...tops, ...entries.map(entry => entry.file).filter(file => !tops.includes(file))]
}

function readAlbumMeta(name: string, input: unknown): { album: AlbumMeta; photos: PhotoEntry[] } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error(`${name}/meta.json: must be an object`)
  const meta = input as Partial<Meta>
  if (!('photos' in meta)) throw new Error(`${name}/meta.json: 需要 { "album": {...}, "photos": [...] } 结构；以照片文件名为键的旧格式已废弃，请迁移`)
  if (!Array.isArray(meta.photos)) throw new Error(`${name}/meta.json.photos: must be an array`)
  const album = meta.album ?? {}
  if (typeof album !== 'object' || album === null || Array.isArray(album)) throw new Error(`${name}/meta.json.album: must be an object`)
  for (const key of ['title', 'description', 'date'] as const) {
    if (album[key] !== undefined && typeof album[key] !== 'string') throw new Error(`${name}/meta.json.album.${key}: must be a string when provided`)
  }
  meta.photos.forEach((entry, index) => {
    const location = `${name}/meta.json.photos[${index}]`
    if (typeof entry !== 'object' || entry === null) throw new Error(`${location}: must be an object`)
    if (typeof entry.file !== 'string' || !entry.file) throw new Error(`${location}.file: 必须填写目录内的照片文件名`)
  })
  return { album, photos: meta.photos }
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
    const { album: details, photos: declared } = readAlbumMeta(entry.name, await readJson(join(directory, 'meta.json')))
    const files = (await readdir(directory, { withFileTypes: true }))
      .filter(file => file.isFile() && IMAGE_EXTENSIONS.has(extname(file.name).toLowerCase()))
      .map(file => file.name)
      .sort(natural.compare)
    declared.forEach((item, index) => {
      if (!files.includes(item.file)) throw new Error(`${entry.name}/meta.json.photos[${index}].file: 目录中没有照片 ${item.file}`)
      if (declared.findIndex(other => other.file === item.file) !== index) throw new Error(`${entry.name}/meta.json.photos[${index}].file: 重复引用照片 ${item.file}`)
    })
    const missing = files.find(file => !declared.some(item => item.file === file))
    if (missing) throw new Error(`${entry.name}/meta.json.photos: 缺少 ${missing} 的照片元信息`)
    const media: Photo[] = orderPhotos(files, declared).map(file => {
      const item = declared.find(candidate => candidate.file === file)!
      const photo: Omit<Photo, 'type' | 'src'> = {
        id: item.id, date: item.date, description: item.description,
        alt: item.alt, width: item.width, height: item.height,
      }
      return { ...photo, type: 'photo', src: `media/photos/${entry.name}/${file}` }
    })
    const dates = media.map(photo => photo.date).filter((date): date is string => Boolean(date)).sort()
    albums.push({
      album: {
        id: `${match[1]}-${match[2]}-sequence${match[3]}`,
        title: details.title?.trim() || match[4],
        description: details.description,
        date: details.date || dates[0],
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
  generatePhotoIndex(join(root, 'public/media/photos'), join(root, 'src/content/generated-photo-index.json'))
    .then(({ content, homeMemory }) => console.log(`照片索引已生成：${content.albums.length} 个相册，${content.albums.reduce((count, album) => count + album.media.length, 0)} 张照片，${homeMemory.length} 张主回忆`))
    .catch((error: Error) => { console.error(error.message); process.exitCode = 1 })
}
