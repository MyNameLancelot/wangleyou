import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { generatePhotoIndex } from './generate-photo-index'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'photo-index-')); temporary.push(root)
  const photos = join(root, 'photos'); const album = join(photos, '2024-05-sequence00-破壳')
  await mkdir(album, { recursive: true })
  await writeFile(join(album, '10.jpg'), '')
  await writeFile(join(album, 'top02.jpg'), '')
  await writeFile(join(album, 'top01.jpg'), '')
  await writeFile(join(album, '2.jpg'), '')
  await writeFile(join(album, 'meta.json'), JSON.stringify({
    album: { description: '一段演示日子' },
    photos: [
      { file: '10.jpg', id: 'ten', date: '2024-05-09' },
      { file: 'top02.jpg', id: 'top-two' },
      { file: 'top01.jpg', id: 'top-one', date: '2024-05-01' },
      { file: '2.jpg', id: 'two' },
    ],
  }))
  await writeFile(join(photos, 'home-memory.json'), JSON.stringify([{ id: 'top-two', type: 'photo', src: 'media/photos/2024-05-sequence00-破壳/top02.jpg' }]))
  return { photos, output: join(root, 'generated.json') }
}

it('prioritizes topNN then keeps the meta order for the remaining photos', async () => {
  const { photos, output } = await fixture()
  const generated = await generatePhotoIndex(photos, output)
  expect(generated.content.albums[0].media.map(photo => photo.id)).toEqual(['top-one', 'top-two', 'ten', 'two'])
  expect(JSON.parse(await readFile(output, 'utf8')).homeMemory[0].id).toBe('top-two')
})

it('carries album level metadata and falls back to the directory name and earliest date', async () => {
  const { photos, output } = await fixture()
  const { albums } = (await generatePhotoIndex(photos, output)).content
  expect(albums[0].title).toBe('破壳')
  expect(albums[0].description).toBe('一段演示日子')
  expect(albums[0].date).toBe('2024-05-01')
  const album = join(photos, '2024-05-sequence00-破壳')
  await writeFile(join(album, 'meta.json'), JSON.stringify({ album: { title: '自定义标题', date: '2024-06-01' }, photos: [{ file: 'top01.jpg', id: 'top-one' }, { file: 'top02.jpg', id: 'top-two' }, { file: '2.jpg', id: 'two' }, { file: '10.jpg', id: 'ten' }] }))
  const overridden = (await generatePhotoIndex(photos, output)).content.albums[0]
  expect([overridden.title, overridden.date, overridden.description]).toEqual(['自定义标题', '2024-06-01', undefined])
})

it('rejects the retired filename keyed meta structure', async () => {
  const { photos } = await fixture()
  await writeFile(join(photos, '2024-05-sequence00-破壳/meta.json'), JSON.stringify({ 'top01.jpg': { id: 'top-one' } }))
  await expect(generatePhotoIndex(photos, join(photos, 'generated.json'))).rejects.toThrow('旧格式已废弃')
})

it('rejects photos that do not cover the directory exactly', async () => {
  const { photos } = await fixture()
  const meta = join(photos, '2024-05-sequence00-破壳/meta.json')
  await writeFile(meta, JSON.stringify({ photos: [{ file: 'top01.jpg', id: 'top-one' }, { file: 'missing.jpg', id: 'gone' }] }))
  await expect(generatePhotoIndex(photos, join(photos, 'generated.json'))).rejects.toThrow('目录中没有照片 missing.jpg')
  await writeFile(meta, JSON.stringify({ photos: [{ file: 'top01.jpg', id: 'top-one' }, { file: 'top01.jpg', id: 'top-one-again' }] }))
  await expect(generatePhotoIndex(photos, join(photos, 'generated.json'))).rejects.toThrow('重复引用照片 top01.jpg')
  await writeFile(meta, JSON.stringify({ photos: [{ file: 'top01.jpg', id: 'top-one' }] }))
  await expect(generatePhotoIndex(photos, join(photos, 'generated.json'))).rejects.toThrow('缺少 2.jpg 的照片元信息')
})

it('rejects uppercase Sequence album directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'photo-index-')); temporary.push(root)
  const photos = join(root, 'photos')
  await mkdir(join(photos, '2024-05-Sequence00-破壳'), { recursive: true })
  await writeFile(join(photos, 'home-memory.json'), '[]')
  await expect(generatePhotoIndex(photos, join(root, 'generated.json'))).rejects.toThrow('YYYY-MM-sequenceNN-相册名')
})
