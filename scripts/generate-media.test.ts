import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it } from 'vitest'
import { generateMedia } from './generate-media'

const temporary: string[] = []
const originalCwd = process.cwd()
afterEach(async () => {
  process.chdir(originalCwd)
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

/** 在临时工作区里造一个最小相册：一张照片、一段（内容不重要的）视频，可选一张真实封面。 */
async function workspace(options: { poster?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'media-pipeline-'))
  temporary.push(root)
  const album = join(root, 'media-source', '2025-05-sequence00-周岁')
  await mkdir(join(root, 'src', 'content'), { recursive: true })
  await mkdir(album, { recursive: true })
  await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#2a6f7a' } }).jpeg().toFile(join(album, 'top01.jpg'))
  const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom-demo-video-bytes')])
  await writeFile(join(album, 'weekend-clip.mp4'), video)
  if (options.poster) await sharp({ create: { width: 960, height: 540, channels: 3, background: '#b4472f' } }).jpeg().toFile(join(album, 'weekend-clip.poster.jpg'))
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: {} }))
  await writeFile(join(root, 'media-source', 'home-memory.json'), '[]')
  process.chdir(root)
  return {
    root,
    video,
    index: () => readFile(join(root, 'src/content/generated-photo-index.json'), 'utf8').then(JSON.parse),
    manifest: () => readFile(join(root, '.cache/media-variants/manifest.json'), 'utf8').then(JSON.parse),
    published: async () => (await readdir(join(root, 'public/media/2025-05-sequence00-周岁'))).sort(),
  }
}

it('publishes a video by content hash and generates a placeholder poster when no poster source exists', async () => {
  const space = await workspace()
  await generateMedia()
  const hash = createHash('sha256').update(space.video).digest('hex').slice(0, 12)
  const video = (await space.index()).content.albums[0].media.find((item: { id: string }) => item.id === 'weekend-clip')
  expect(video).toMatchObject({
    type: 'video',
    src: `media/2025-05-sequence00-周岁/weekend-clip.${hash}.mp4`,
    width: 1600,
    height: 900,
  })
  expect(video.poster).toMatch(new RegExp(`^media/2025-05-sequence00-周岁/weekend-clip\\.poster\\.[a-f0-9]{12}\\.1600\\.webp$`))
  expect(video.posterSrcSet.map((item: { width: number }) => item.width)).toEqual([480, 960, 1600])
  // 发布产物：内容哈希命名的 MP4 与占位封面 WebP，源素材不进入 public
  const files = await space.published()
  expect(files).toContain(`weekend-clip.${hash}.mp4`)
  expect(files.filter(file => file.endsWith('.webp')).length).toBeGreaterThanOrEqual(4)
  expect(files.some(file => file.endsWith('.jpg'))).toBe(false)
  const poster = await sharp(join(space.root, 'public', video.poster)).metadata()
  expect([poster.format, poster.width, poster.height]).toEqual(['webp', 1600, 900])
  // 重复运行命中清单：视频不重复复制，封面不重新编码
  const before = await stat(join(space.root, 'public', video.src))
  await generateMedia()
  expect((await stat(join(space.root, 'public', video.src))).mtimeMs).toBe(before.mtimeMs)
  expect(Object.keys((await space.manifest()).videos)).toEqual(['2025-05-sequence00-周岁/weekend-clip.mp4'])
})

it('derives the poster from the source frame when the album provides one', async () => {
  const space = await workspace({ poster: true })
  await generateMedia()
  const video = (await space.index()).content.albums[0].media.find((item: { id: string }) => item.id === 'weekend-clip')
  expect([video.width, video.height]).toEqual([960, 540])
  expect(video.poster).toMatch(new RegExp('^media/2025-05-sequence00-周岁/weekend-clip\\.poster\\.[a-f0-9]{12}\\.960\\.webp$'))
  // 封面源素材不进 public：派生产物仍放在相册目录里
  expect((await space.published()).some(file => file.endsWith('.jpg'))).toBe(false)
})

it('removes the previous video and placeholder poster when video bytes change', async () => {
  const space = await workspace()
  await generateMedia()
  const previous = (await space.index()).content.albums[0].media.find((item: { id: string }) => item.id === 'weekend-clip')
  const previousPosters = previous.posterSrcSet.map((item: { src: string }) => item.src)

  await writeFile(join(space.root, 'media-source/2025-05-sequence00-周岁/weekend-clip.mp4'), Buffer.from('updated-video-bytes'))
  await generateMedia()

  const current = (await space.index()).content.albums[0].media.find((item: { id: string }) => item.id === 'weekend-clip')
  const files = await space.published()
  expect(current.src).not.toBe(previous.src)
  expect(current.poster).not.toBe(previous.poster)
  expect(files).not.toContain(previous.src.split('/').at(-1))
  for (const poster of previousPosters) expect(files).not.toContain(poster.split('/').at(-1))
  expect(files).toContain(current.src.split('/').at(-1))
  expect(Object.values((await space.manifest()).videos)).toEqual([{ hash: expect.any(String), src: current.src }])
})
