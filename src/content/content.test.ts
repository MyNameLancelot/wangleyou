import { describe, expect, it } from 'vitest'
import { assertAssetPath, validateContent, validateHomeMemory } from './validate'

describe('content validation', () => {
  it('accepts photo-only generated content', () => {
    expect(validateContent({ site: { title: '王乐悠', subtitle: '' }, albums: [{ id: '2024-05-sequence00', title: '破壳', media: [{ id: 'top', type: 'photo', src: 'media/photos/a/top01.jpg' }] }] }).albums).toHaveLength(1)
  })
  it('preserves explicit home memory order', () => {
    expect(validateHomeMemory([{ id: 'second', type: 'photo', src: 'media/photos/a/2.jpg' }, { id: 'first', type: 'photo', src: 'media/photos/a/1.jpg' }]).map(photo => photo.id)).toEqual(['second', 'first'])
  })
  it.each(['/media/photo.jpg', 'https://example.com/photo.jpg', 'media\\photo.jpg', '../photo.jpg', 'media/../photo.jpg', 'media/photo.jpg?size=large'])('rejects unsafe asset path %s', path => {
    expect(() => assertAssetPath(path, 'asset')).toThrow('asset')
  })
})
