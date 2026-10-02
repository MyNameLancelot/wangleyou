import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, link, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it, vi } from 'vitest'
import { rename } from 'node:fs/promises'
import { generateMedia } from './generate-media'

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, rename: vi.fn(actual.rename) }
})

const temporary: string[] = []
const originalCwd = process.cwd()
afterEach(async () => {
  vi.mocked(rename).mockReset()
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  vi.mocked(rename).mockImplementation(actual.rename)
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


it.each([[320, 213], [479, 100], [1, 1], [1200, 1]])('derives small/rounded photos and posters without upscaling (%i x %i)', async (width, height) => {
  const space = await workspace({ poster: true })
  const album = join(space.root, 'media-source/2025-05-sequence00-周岁')
  for (const file of ['top01.jpg', 'weekend-clip.poster.jpg']) {
    await sharp({ create: { width, height, channels: 3, background: '#2a6f7a' } }).jpeg().toFile(join(album, file))
  }
  await generateMedia()
  for (const media of (await space.index()).content.albums[0].media) {
    const candidates = media.type === 'photo' ? media.srcSet : media.posterSrcSet
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      expect(candidate.width).toBeLessThanOrEqual(width)
      expect(candidate.height).toBeGreaterThan(0)
      const actual = await sharp(join(space.root, 'public', candidate.src)).metadata()
      expect([actual.width, actual.height]).toEqual([candidate.width, candidate.height])
    }
  }
})

it('failed derivation preserves the valid index/cache and all previously published resources', async () => {
  const space = await workspace()
  await generateMedia()
  const index = await readFile('src/content/generated-photo-index.json')
  const manifest = await readFile('.cache/media-variants/manifest.json')
  const files = await space.published()
  await writeFile('media-source/2025-05-sequence00-周岁/top02.jpg', 'broken')
  await expect(generateMedia()).rejects.toThrow()
  expect(await readFile('src/content/generated-photo-index.json')).toEqual(index)
  expect(await readFile('.cache/media-variants/manifest.json')).toEqual(manifest)
  expect(await space.published()).toEqual(files)
})

it.each(['cache', 'index'])('failed %s replacement preserves the valid publication and restores cache', async target => {
  const space = await workspace()
  await generateMedia()
  const index = await readFile('src/content/generated-photo-index.json')
  const manifest = await readFile('.cache/media-variants/manifest.json')
  const files = await space.published()
  await writeFile('media-source/2025-05-sequence00-周岁/weekend-clip.mp4', 'changed')
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
  let failed = false
  vi.mocked(rename).mockImplementation(async (from, to) => {
    if (!failed && String(to) === (target === 'index' ? 'src/content/generated-photo-index.json' : '.cache/media-variants/manifest.json')) {
      failed = true
      throw new Error('injected rename failure')
    }
    await actual.rename(from, to)
  })
  await expect(generateMedia()).rejects.toThrow('injected rename failure')
  expect(await readFile('src/content/generated-photo-index.json')).toEqual(index)
  expect(await readFile('.cache/media-variants/manifest.json')).toEqual(manifest)
  expect(await space.published()).toEqual(files)
  expect((await readdir('src/content')).some(file => file.startsWith('.media-publish-'))).toBe(false)
  expect((await readdir('.cache/media-variants')).some(file => file.startsWith('.media-publish-'))).toBe(false)
})

it.each(['invalid JSON', { version: 2, entries: { bad: { hash: 'a' } } }, { version: 2, entries: {}, videos: { bad: null } }, { version: 999, entries: {}, videos: {} }])('recovers a malformed manifest: %j', async malformed => {
  const space = await workspace()
  await generateMedia()
  await writeFile('.cache/media-variants/manifest.json', typeof malformed === 'string' ? malformed : JSON.stringify(malformed))
  await generateMedia()
  expect((await space.index()).content.albums[0].media).toHaveLength(2)
  expect((await space.manifest()).version).toBe(2)
})

it('does not delete arbitrary files named by an invalid cached path', async () => {
  const space = await workspace()
  await generateMedia()
  await writeFile('keep.txt', 'keep')
  const manifest = await space.manifest()
  Object.values<{ variants: Array<{ src: string }> }>(manifest.entries)[0].variants[0].src = '../keep.txt'
  await writeFile('.cache/media-variants/manifest.json', JSON.stringify(manifest))
  await generateMedia()
  expect(await readFile('keep.txt', 'utf8')).toBe('keep')
})

it('rebuilds a missing variant, uses hot photo cache, and removes obsolete photos only after success', async () => {
  const space = await workspace()
  await generateMedia()
  const photo = (await space.index()).content.albums[0].media.find((item: { type: string }) => item.type === 'photo')
  const path = join('public', photo.srcSet[0].src)
  const before = (await stat(path)).mtimeMs
  await generateMedia()
  expect((await stat(path)).mtimeMs).toBe(before)
  await rm(path)
  await generateMedia()
  expect((await stat(path)).size).toBeGreaterThan(0)
  await rm('media-source/2025-05-sequence00-周岁/top01.jpg')
  await generateMedia()
  expect((await space.index()).content.albums[0].media).toHaveLength(1)
  expect(await space.published()).not.toContain(photo.src.split('/').at(-1))
})


it.each(['symlink', 'hardlink'])('rebuilding cached output through %s cannot alter source bytes', async kind => {
  const space = await workspace()
  await generateMedia()
  const photo = (await space.index()).content.albums[0].media.find((item: { type: string }) => item.type === 'photo')
  const source = join(space.root, 'media-source/2025-05-sequence00-周岁/top01.jpg')
  const output = join(space.root, 'public', photo.srcSet[0].src)
  const before = await readFile(source)
  await rm(output)
  await (kind === 'symlink' ? symlink(source, output) : link(source, output))
  await writeFile('.cache/media-variants/manifest.json', '{}')
  if (kind === 'symlink') await expect(generateMedia()).rejects.toThrow('生成目标不能是链接')
  else await generateMedia()
  expect(await readFile(source)).toEqual(before)
})

it('rejects linked publication directories before any source mutation', async () => {
  const space = await workspace()
  await generateMedia()
  const sourceDir = join(space.root, 'media-source/2025-05-sequence00-周岁')
  const before = (await readdir(sourceDir)).sort()
  await rm('public/media/2025-05-sequence00-周岁', { recursive: true })
  await symlink(sourceDir, 'public/media/2025-05-sequence00-周岁')
  await expect(generateMedia()).rejects.toThrow('生成目录不能是链接')
  expect((await readdir(sourceDir)).sort()).toEqual(before)
})

it('rechecks cached source geometry instead of publishing forged dimensions', async () => {
  const space = await workspace()
  await generateMedia()
  const manifest = await space.manifest()
  const key = '2025-05-sequence00-周岁/top01.jpg'
  manifest.entries[key].width *= 2
  manifest.entries[key].height *= 2
  await writeFile('.cache/media-variants/manifest.json', JSON.stringify(manifest))
  await generateMedia()
  const photo = (await space.index()).content.albums[0].media.find((item: { type: string }) => item.type === 'photo')
  expect([photo.width, photo.height]).toEqual([1200, 800])
})


it('reclaims only new derivatives when a later source fails', async () => {
  const space = await workspace()
  await generateMedia()
  const before = await space.published()
  const index = await readFile('src/content/generated-photo-index.json')
  await sharp({ create: { width: 1000, height: 700, channels: 3, background: '#f00' } }).jpeg().toFile('media-source/2025-05-sequence00-周岁/top01.jpg')
  await writeFile('media-source/2025-05-sequence00-周岁/top02.jpg', 'broken')
  await expect(generateMedia()).rejects.toThrow()
  expect(await space.published()).toEqual(before)
  expect(await readFile('src/content/generated-photo-index.json')).toEqual(index)
})


it('derives small EXIF-rotated photos using upright geometry without changing the source', async () => {
  const space = await workspace()
  const source = 'media-source/2025-05-sequence00-周岁/top01.jpg'
  await sharp({ create: { width: 320, height: 213, channels: 3, background: '#2a6f7a' } }).jpeg().withMetadata({ orientation: 6 }).toFile(source)
  const before = await readFile(source)
  await generateMedia()
  const photo = (await space.index()).content.albums[0].media.find((item: { type: string }) => item.type === 'photo')
  expect([photo.width, photo.height]).toEqual([213, 320])
  expect(photo.srcSet).toEqual([{ src: photo.src, width: 213, height: 320 }])
  const output = await sharp(join('public', photo.src)).metadata()
  expect([output.width, output.height, output.orientation]).toEqual([213, 320, undefined])
  expect(await readFile(source)).toEqual(before)
  await generateMedia()
  expect((await space.index()).content.albums[0].media.find((item: { type: string }) => item.type === 'photo')).toEqual(photo)
})
