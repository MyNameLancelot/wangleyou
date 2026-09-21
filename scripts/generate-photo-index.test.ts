import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { generatePhotoIndex } from './generate-photo-index'

const temporary: string[] = []
afterEach(async () => { await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true }))) })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'photo-index-')); temporary.push(root)
  const photos = join(root, 'photos'); const album = join(photos, '2024-05-Sequence00-破壳')
  await mkdir(album, { recursive: true })
  await writeFile(join(album, '10.jpg'), '')
  await writeFile(join(album, 'top02.jpg'), '')
  await writeFile(join(album, 'top01.jpg'), '')
  await writeFile(join(album, '2.jpg'), '')
  await writeFile(join(album, 'meta.json'), JSON.stringify({ '10.jpg': { id: 'ten' }, 'top02.jpg': { id: 'top-two' }, 'top01.jpg': { id: 'top-one' }, '2.jpg': { id: 'two' } }))
  await writeFile(join(photos, 'home-memory.json'), JSON.stringify([{ id: 'top-two', type: 'photo', src: 'media/photos/2024-05-Sequence00-破壳/top02.jpg' }]))
  return { photos, output: join(root, 'generated.json') }
}

it('prioritizes topNN then naturally sorts remaining photo files', async () => {
  const { photos, output } = await fixture()
  const generated = await generatePhotoIndex(photos, output)
  expect(generated.content.albums[0].media.map(photo => photo.id)).toEqual(['top-one', 'top-two', 'two', 'ten'])
  expect(JSON.parse(await readFile(output, 'utf8')).homeMemory[0].id).toBe('top-two')
})
