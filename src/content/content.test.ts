import { describe, expect, it } from 'vitest'
import { assertAssetPath, validateContent, validateHomeMemory } from './validate'

describe('content validation', () => {
  it('accepts photo-only generated content', () => {
    expect(validateContent({ site: { title: '王乐悠', subtitle: '' }, albums: [{ id: '2024-05-sequence00', title: '破壳', media: [{ id: 'top', type: 'photo', src: 'media/a/top01.jpg' }] }] }).albums).toHaveLength(1)
  })
  it('accepts a video with its derived poster and responsive poster candidates', () => {
    const content = (media: unknown) => ({ site: { title: '王乐悠', subtitle: '' }, albums: [{ id: '2024-05-sequence00', title: '破壳', media: [media] }] })
    const video = { id: 'clip', type: 'video', src: 'media/a/clip.0a1b2c3d4e5f.mp4', poster: 'media/a/clip.poster.0a1b2c3d4e5f.960.webp', width: 960, height: 540, posterSrcSet: [{ src: 'media/a/clip.poster.0a1b2c3d4e5f.480.webp', width: 480, height: 270 }] }
    expect(validateContent(content(video)).albums[0].media[0]).toMatchObject({ type: 'video', id: 'clip' })
    // 视频封面缺失、容器不是 MP4、候选图比例不符都要在构建期拦住
    expect(() => validateContent(content({ ...video, poster: undefined }))).toThrow('media[0].poster')
    expect(() => validateContent(content({ ...video, src: 'media/a/clip.mov' }))).toThrow('media[0].src: must be a .mp4 file')
    expect(() => validateContent(content({ ...video, posterSrcSet: [{ src: 'media/a/clip.poster.0a1b2c3d4e5f.480.webp', width: 480, height: 480 }] }))).toThrow('preserve the source aspect ratio')
  })
  it('preserves explicit home memory order', () => {
    expect(validateHomeMemory([{ id: 'second', type: 'photo', src: 'media/a/2.jpg' }, { id: 'first', type: 'photo', src: 'media/a/1.jpg' }]).map(photo => photo.id)).toEqual(['second', 'first'])
  })
  it('accepts a short album opening and rejects blank or overlong values', () => {
    const base = { site: { title: '王乐悠', subtitle: '' }, albums: [{ id: '2024-05-sequence00', title: '破壳', media: [] }] }
    expect(validateContent({ ...base, albums: [{ ...base.albums[0], opening: '一岁，向前走。' }] }).albums[0].opening).toBe('一岁，向前走。')
    expect(() => validateContent({ ...base, albums: [{ ...base.albums[0], opening: ' ' }] })).toThrow('opening')
    expect(() => validateContent({ ...base, albums: [{ ...base.albums[0], opening: '一二三四五六七八九十一二三四五六七八九十一' }] })).toThrow('opening')
  })
  it('accepts optional photo captions up to 60 characters and rejects blank or overlong ones', () => {
    const photo = { id: 'top', type: 'photo', src: 'media/a/top01.jpg' }
    const content = (media: unknown) => ({ site: { title: '王乐悠', subtitle: '' }, albums: [{ id: '2024-05-sequence00', title: '破壳', media: [media] }] })
    expect(validateContent(content({ ...photo, caption: '第一次见面。' })).albums[0].media[0].caption).toBe('第一次见面。')
    expect(validateContent(content(photo)).albums[0].media[0].caption).toBeUndefined()
    expect(() => validateContent(content({ ...photo, caption: '  ' }))).toThrow('caption')
    expect(() => validateContent(content({ ...photo, caption: '一'.repeat(61) }))).toThrow('caption')
  })
  it.each(['/media/photo.jpg', 'https://example.com/photo.jpg', 'media\\photo.jpg', '../photo.jpg', 'media/../photo.jpg', 'media/photo.jpg?size=large'])('rejects unsafe asset path %s', path => {
    expect(() => assertAssetPath(path, 'asset')).toThrow('asset')
  })
})
