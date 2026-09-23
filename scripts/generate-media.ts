import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative } from 'node:path'
import sharp from 'sharp'
import { generatePhotoIndex } from './generate-photo-index'
import type { Photo } from '../src/content/model'

const SOURCE_ROOT = 'media-source'
const PUBLIC_ROOT = 'public'
const OUTPUT_ROOT = 'public/media'
const INDEX_PATH = 'src/content/generated-photo-index.json'
const CACHE_PATH = '.cache/media-variants/manifest.json'
const WIDTHS = [480, 960, 1600, 2560] as const
// 编码参数或派生输出布局变化时必须提升版本，避免复用到旧路径的清单条目。
const PROFILE = 'webp-q80-effort4-v2'
type Variant = { src: string; width: number; height: number }
type Entry = { hash: string; variants: Variant[]; width: number; height: number }
type Manifest = { version: 1; entries: Record<string, Entry> }

async function loadManifest(): Promise<Manifest> {
  try { return JSON.parse(await readFile(CACHE_PATH, 'utf8')) as Manifest } catch { return { version: 1, entries: {} } }
}
const exists = async (path: string) => stat(path).then(() => true).catch(() => false)
const digest = async (path: string) => createHash('sha256').update(PROFILE).update(await readFile(path)).digest('hex')

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

export async function generateMedia(): Promise<void> {
  const manifest = await loadManifest()
  await generatePhotoIndex(SOURCE_ROOT, INDEX_PATH)
  const generated = JSON.parse(await readFile(INDEX_PATH, 'utf8')) as { content: { albums: Array<{ media: Photo[] }> }; homeMemory: Photo[] }
  const bySource = new Map<string, Photo>()
  for (const album of generated.content.albums) for (const photo of album.media) {
    const sourcePath = join(SOURCE_ROOT, photo.src.replace(/^media\//, ''))
    const entry = await variants(SOURCE_ROOT, sourcePath, manifest)
    manifest.entries[relative(SOURCE_ROOT, sourcePath).split('\\').join('/')] = entry
    Object.assign(photo, { src: entry.variants.at(-1)!.src, width: entry.width, height: entry.height, srcSet: entry.variants })
    bySource.set(sourcePath, photo)
  }
  generated.homeMemory = generated.homeMemory.map(photo => {
    const generatedPhoto = bySource.get(join(SOURCE_ROOT, photo.src.replace(/^media\//, '')))
    return generatedPhoto ? { ...photo, src: generatedPhoto.src, width: generatedPhoto.width, height: generatedPhoto.height, srcSet: generatedPhoto.srcSet } : photo
  })
  const valid = new Set([...bySource.keys()].map(path => relative(SOURCE_ROOT, path).split('\\').join('/')))
  for (const [key, entry] of Object.entries(manifest.entries)) {
    if (valid.has(key)) continue
    await Promise.all(entry.variants.map(item => rm(join(PUBLIC_ROOT, item.src), { force: true })))
    delete manifest.entries[key]
  }
  await mkdir(join(CACHE_PATH, '..'), { recursive: true })
  await writeFile(CACHE_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(INDEX_PATH, `${JSON.stringify(generated, null, 2)}\n`)
}

if (import.meta.url.endsWith(process.argv[1] || '')) generateMedia().then(() => console.log('媒体派生完成')).catch(error => { console.error(error); process.exitCode = 1 })
