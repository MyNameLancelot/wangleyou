import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { generatePhotoIndex } from './generate-photo-index'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

async function fixture(albumMeta: unknown = { album: { description: '一段演示日子' } }) {
  const root = await mkdtemp(join(tmpdir(), 'photo-index-')); temporary.push(root)
  const photos = join(root, 'photos'); const album = join(photos, '2024-05-sequence00-破壳')
  await mkdir(album, { recursive: true })
  for (const file of ['10.jpg', 'top02.jpg', 'top01.jpg', '2.jpg']) await writeFile(join(album, file), '')
  await writeFile(join(album, 'meta.json'), JSON.stringify(albumMeta))
  await writeFile(join(photos, 'home-memory.json'), JSON.stringify([{ id: 'top02', type: 'photo', src: 'media/2024-05-sequence00-破壳/top02.jpg' }]))
  return { photos, album, output: join(root, 'generated.json') }
}

it('orders photos by topNN then natural file order and derives ids from file names', async () => {
  const { photos, output } = await fixture()
  const generated = await generatePhotoIndex(photos, output)
  expect(generated.content.albums[0].media.map(photo => photo.id)).toEqual(['top01', 'top02', '2', '10'])
  expect(generated.content.albums[0].media.map(photo => photo.src)).toEqual([
    'media/2024-05-sequence00-破壳/top01.jpg',
    'media/2024-05-sequence00-破壳/top02.jpg',
    'media/2024-05-sequence00-破壳/2.jpg',
    'media/2024-05-sequence00-破壳/10.jpg',
  ])
  expect(JSON.parse(await readFile(output, 'utf8')).homeMemory[0].id).toBe('top02')
})

it('reads album metadata from meta.json with folder name and month fallbacks', async () => {
  const { photos, album, output } = await fixture({ album: { title: '自定义标题', description: '一段演示日子', date: '2024-06-01' } })
  const overridden = (await generatePhotoIndex(photos, output)).content.albums[0]
  expect([overridden.id, overridden.title, overridden.date, overridden.description]).toEqual(['2024-05-sequence00', '自定义标题', '2024-06-01', '一段演示日子'])
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { description: '只有说明' } }))
  const fallback = (await generatePhotoIndex(photos, output)).content.albums[0]
  expect([fallback.title, fallback.date, fallback.description]).toEqual(['破壳', '2024-05', '只有说明'])
})

it('rejects unsupported sections because order and ids are generated at build time', async () => {
  const { photos } = await fixture({ album: {}, photos: [{ file: 'top01.jpg', id: 'top-one' }] })
  await expect(generatePhotoIndex(photos, join(photos, 'generated.json'))).rejects.toThrow('只支持 album 与 photos_meta 段')
})

it('reads optional per-photo captions from photos_meta', async () => {
  const { photos, album, output } = await fixture({ album: { description: '一段演示日子' }, photos_meta: { captions: [{ fileName: 'top01.jpg', caption: '第一次见面。' }] } })
  const media = (await generatePhotoIndex(photos, output)).content.albums[0].media
  expect(media.find(item => item.id === 'top01')?.caption).toBe('第一次见面。')
  expect(media.find(item => item.id === '10')?.caption).toBeUndefined()

  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { description: '一段演示日子' } }))
  expect((await generatePhotoIndex(photos, output)).content.albums[0].media.every(item => item.caption === undefined)).toBe(true)
})

it('rejects captions that do not point at a real photo file', async () => {
  const missing = await fixture({ album: {}, photos_meta: { captions: [{ fileName: 'top09.jpg', caption: '找不到这张' }] } })
  await expect(generatePhotoIndex(missing.photos, missing.output)).rejects.toThrow('这个相册里没有 top09.jpg')

  const duplicate = await fixture({ album: {}, photos_meta: { captions: [{ fileName: 'top01.jpg', caption: '一' }, { fileName: 'top01.jpg', caption: '二' }] } })
  await expect(generatePhotoIndex(duplicate.photos, duplicate.output)).rejects.toThrow('重复登记寄语')
})

it('rejects blank, overlong or malformed caption entries', async () => {
  const blank = await fixture({ album: {}, photos_meta: { captions: [{ fileName: 'top01.jpg', caption: '   ' }] } })
  await expect(generatePhotoIndex(blank.photos, blank.output)).rejects.toThrow('必须是非空寄语')

  const long = await fixture({ album: {}, photos_meta: { captions: [{ fileName: 'top01.jpg', caption: '一'.repeat(61) }] } })
  await expect(generatePhotoIndex(long.photos, long.output)).rejects.toThrow('不能超过 60 个字符')

  const extraKey = await fixture({ album: {}, photos_meta: { captions: [{ fileName: 'top01.jpg', caption: '一', extra: true }] } })
  await expect(generatePhotoIndex(extraKey.photos, extraKey.output)).rejects.toThrow('只支持 fileName 与 caption')

  const unknownSection = await fixture({ album: {}, photos_meta: { notes: [] } })
  await expect(generatePhotoIndex(unknownSection.photos, unknownSection.output)).rejects.toThrow('只支持 captions')
})

it('rejects album descriptions longer than 16 characters', async () => {
  const { photos, album, output } = await fixture({ album: { description: '一二三四五六七八九十一二三四五六' } })
  expect((await generatePhotoIndex(photos, output)).content.albums[0].description).toHaveLength(16)
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { description: '一二三四五六七八九十一二三四五六七' } }))
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('不能超过 16 个字符（当前 17 个）')
})

it('accepts optional opening and rejects blank or overlong opening', async () => {
  const { photos, album, output } = await fixture({ album: { opening: '一岁，是好奇心开始有了方向。' } })
  expect((await generatePhotoIndex(photos, output)).content.albums[0].opening).toBe('一岁，是好奇心开始有了方向。')
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { opening: '   ' } }))
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('opening')
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { opening: '一二三四五六七八九十一二三四五六七八九十一' } }))
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('20')
})

it('rejects uppercase Sequence album directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'photo-index-')); temporary.push(root)
  const photos = join(root, 'photos')
  await mkdir(join(photos, '2024-05-Sequence00-破壳'), { recursive: true })
  await writeFile(join(photos, 'home-memory.json'), '[]')
  await expect(generatePhotoIndex(photos, join(root, 'generated.json'))).rejects.toThrow('YYYY-MM-sequenceNN-相册名')
})

async function videoFixture(files: string[]) {
  const root = await mkdtemp(join(tmpdir(), 'video-index-')); temporary.push(root)
  const photos = join(root, 'photos'); const album = join(photos, '2025-05-sequence00-周岁')
  await mkdir(album, { recursive: true })
  for (const file of files) await writeFile(join(album, file), '')
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: {} }))
  await writeFile(join(photos, 'home-memory.json'), '[]')
  return { photos, album, output: join(root, 'generated.json') }
}

it('publishes videos next to photos with the same topNN and natural order', async () => {
  const { photos, output } = await videoFixture(['10.jpg', 'top02.jpg', 'top01.mp4', 'top01.poster.jpg', '2.jpg', 'weekend-clip.mp4', 'weekend-clip.poster.jpg'])
  const media = (await generatePhotoIndex(photos, output)).content.albums[0].media
  // topNN 优先（照片与视频同一条规则），其余按文件名自然序
  expect(media.map(item => item.id)).toEqual(['top01', 'top02', '2', '10', 'weekend-clip'])
  expect(media.map(item => item.type)).toEqual(['video', 'photo', 'photo', 'photo', 'video'])
  expect(media[0]).toMatchObject({ type: 'video', src: 'media/2025-05-sequence00-周岁/top01.mp4', poster: 'media/2025-05-sequence00-周岁/top01.poster.jpg' })
  expect(media[4]).toMatchObject({ type: 'video', src: 'media/2025-05-sequence00-周岁/weekend-clip.mp4', poster: 'media/2025-05-sequence00-周岁/weekend-clip.poster.jpg' })
  // 封面源素材是保留名，不再被当成照片进入索引
  expect(media.filter(item => item.type === 'photo').map(item => item.src)).toEqual([
    'media/2025-05-sequence00-周岁/top02.jpg',
    'media/2025-05-sequence00-周岁/2.jpg',
    'media/2025-05-sequence00-周岁/10.jpg',
  ])
})

it('keeps the poster convention for a video without its own poster source', async () => {
  // 封面源素材可选：索引始终写约定名，generate-media 缺失时生成占位封面。
  const missingPoster = await videoFixture(['top01.jpg', 'weekend-clip.mp4'])
  const media = (await generatePhotoIndex(missingPoster.photos, missingPoster.output)).content.albums[0].media
  expect(media.find(item => item.id === 'weekend-clip')).toMatchObject({
    type: 'video',
    src: 'media/2025-05-sequence00-周岁/weekend-clip.mp4',
    poster: 'media/2025-05-sequence00-周岁/weekend-clip.poster.jpg',
  })
})

it('rejects a poster source without its video', async () => {
  const orphanPoster = await videoFixture(['top01.jpg', 'weekend-clip.poster.jpg'])
  await expect(generatePhotoIndex(orphanPoster.photos, orphanPoster.output)).rejects.toThrow('找不到同名的视频源文件 weekend-clip.mp4')
})

it('rejects video containers outside the publishing format', async () => {
  const { photos, output } = await videoFixture(['top01.jpg', 'weekend-clip.mov', 'weekend-clip.poster.jpg'])
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('视频只接受 H.264 + AAC 的 .mp4')
})

it('accepts captions registered on a video file and keeps rejecting unknown files', async () => {
  const { photos, album, output } = await videoFixture(['top01.jpg', 'weekend-clip.mp4', 'weekend-clip.poster.jpg'])
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: {}, photos_meta: { captions: [{ fileName: 'weekend-clip.mp4', caption: '花园里的一小段风。' }] } }))
  const media = (await generatePhotoIndex(photos, output)).content.albums[0].media
  expect(media.find(item => item.id === 'weekend-clip')?.caption).toBe('花园里的一小段风。')

  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: {}, photos_meta: { captions: [{ fileName: 'weekend-clip.poster.jpg', caption: '封面不是媒体。' }] } }))
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('这个相册里没有 weekend-clip.poster.jpg')
})

it('keeps home memory photo-only: a video cannot enter the main memory queue', async () => {
  const { photos, output } = await videoFixture(['top01.jpg', 'weekend-clip.mp4', 'weekend-clip.poster.jpg'])
  await writeFile(join(photos, 'home-memory.json'), JSON.stringify([{ id: 'clip', type: 'photo', src: 'media/2025-05-sequence00-周岁/weekend-clip.mp4' }]))
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('必须引用相册目录中的照片')
})
