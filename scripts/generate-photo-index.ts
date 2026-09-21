import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateContent, validateHomeMemory } from '../src/content/validate'
import type { Album, Photo, SiteContent } from '../src/content/model'

const ALBUM_DIR = /^(\d{4})-(\d{2})-Sequence(\d{2})-(.+)$/
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const TOP_FILE = /^top(\d+)(?=\.|-|_)/i

type Meta = Record<string, Omit<Photo, 'type' | 'src'>>

const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function photoOrder(a: string, b: string): number {
  const aTop = TOP_FILE.exec(a)
  const bTop = TOP_FILE.exec(b)
  if (aTop && bTop) return Number(aTop[1]) - Number(bTop[1]) || natural.compare(a, b)
  if (aTop) return -1
  if (bTop) return 1
  return natural.compare(a, b)
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
    if (!match) throw new Error(`${entry.name}: 相册目录必须命名为 YYYY-MM-SequenceNN-相册名`)
    const directory = join(photosDir, entry.name)
    const meta = await readJson(join(directory, 'meta.json')) as Meta
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) throw new Error(`${entry.name}/meta.json: must be an object`)
    const photos = (await readdir(directory, { withFileTypes: true }))
      .filter(file => file.isFile() && IMAGE_EXTENSIONS.has(extname(file.name).toLowerCase()))
      .map(file => file.name)
      .sort(photoOrder)
    for (const key of Object.keys(meta)) if (!photos.includes(key)) throw new Error(`${entry.name}/meta.json.${key}: 未找到对应照片文件`)
    const media: Photo[] = photos.map(file => {
      const details = meta[file]
      if (!details || typeof details !== 'object') throw new Error(`${entry.name}/meta.json.${file}: 缺少照片元信息`)
      return { ...details, type: 'photo', src: `media/photos/${entry.name}/${file}` }
    })
    albums.push({ album: { id: `${match[1]}-${match[2]}-sequence${match[3]}`, title: match[4], media }, order: `${match[1]}-${match[2]}-${match[3]}` })
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
