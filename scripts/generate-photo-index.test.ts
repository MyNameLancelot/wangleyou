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
  await writeFile(join(photos, 'home-memory.json'), JSON.stringify([{ id: 'top02', type: 'photo', src: 'media/photos/2024-05-sequence00-破壳/top02.jpg' }]))
  return { photos, album, output: join(root, 'generated.json') }
}

it('orders photos by topNN then natural file order and derives ids from file names', async () => {
  const { photos, output } = await fixture()
  const generated = await generatePhotoIndex(photos, output)
  expect(generated.content.albums[0].media.map(photo => photo.id)).toEqual(['top01', 'top02', '2', '10'])
  expect(generated.content.albums[0].media.map(photo => photo.src)).toEqual([
    'media/photos/2024-05-sequence00-破壳/top01.jpg',
    'media/photos/2024-05-sequence00-破壳/top02.jpg',
    'media/photos/2024-05-sequence00-破壳/2.jpg',
    'media/photos/2024-05-sequence00-破壳/10.jpg',
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

it('rejects photo metadata because order and ids are generated at build time', async () => {
  const { photos } = await fixture({ album: {}, photos: [{ file: 'top01.jpg', id: 'top-one' }] })
  await expect(generatePhotoIndex(photos, join(photos, 'generated.json'))).rejects.toThrow('只支持 album 段')
})

it('rejects album descriptions longer than 16 characters', async () => {
  const { photos, album, output } = await fixture({ album: { description: '一二三四五六七八九十一二三四五六' } })
  expect((await generatePhotoIndex(photos, output)).content.albums[0].description).toHaveLength(16)
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { description: '一二三四五六七八九十一二三四五六七' } }))
  await expect(generatePhotoIndex(photos, output)).rejects.toThrow('不能超过 16 个字符（当前 17 个）')
})

it('rejects uppercase Sequence album directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'photo-index-')); temporary.push(root)
  const photos = join(root, 'photos')
  await mkdir(join(photos, '2024-05-Sequence00-破壳'), { recursive: true })
  await writeFile(join(photos, 'home-memory.json'), '[]')
  await expect(generatePhotoIndex(photos, join(root, 'generated.json'))).rejects.toThrow('YYYY-MM-sequenceNN-相册名')
})
