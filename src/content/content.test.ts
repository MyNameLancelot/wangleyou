import { describe, expect, it } from 'vitest'

import type { Album, SiteContent, Video } from './model'
import { assertAssetPath, sortAlbums, validateContent } from './validate'

const validContent = (): SiteContent => ({
  site: { title: '王乐悠 · 成长相册', subtitle: '记录温暖时光' },
  albums: [
    {
      id: 'summer-2026',
      title: '夏日散步',
      date: '2026-08-02',
      cover: 'media/thumbs/lake.webp',
      media: [
        {
          id: 'lake',
          type: 'photo',
          src: 'media/lake.jpg',
          thumbnail: 'media/thumbs/lake.webp',
          date: '2026-08-02',
          description: '傍晚的湖边',
          alt: '湖边晚霞',
          width: 1800,
          height: 1200,
        },
        {
          id: 'walk',
          type: 'video',
          src: 'media/walk.mp4',
          thumbnail: 'media/thumbs/walk-small.webp',
          poster: 'media/thumbs/walk.webp',
          duration: 18.5,
        },
      ],
    },
  ],
})

describe('validateContent', () => {
  it('returns valid photo and video content', () => {
    expect(validateContent(validContent())).toEqual(validContent())
  })

  it.each([
    ['album id', (content: SiteContent) => { content.albums[0].id = 'Summer_2026' }, 'albums[0].id'],
    ['empty album title', (content: SiteContent) => { content.albums[0].title = '   ' }, 'albums[0].title'],
    ['media id', (content: SiteContent) => { content.albums[0].media[0].id = 'lake/view' }, 'albums[0].media[0].id'],
    ['optional description', (content: SiteContent) => { content.albums[0].description = 12 as unknown as string }, 'albums[0].description'],
    ['optional photo width', (content: SiteContent) => { content.albums[0].media[0].width = 0 }, 'albums[0].media[0].width'],
    ['optional video thumbnail', (content: SiteContent) => { (content.albums[0].media[1] as Video).thumbnail = 12 as unknown as string }, 'albums[0].media[1].thumbnail'],
    ['optional video duration', (content: SiteContent) => { (content.albums[0].media[1] as Video).duration = Number.NaN }, 'albums[0].media[1].duration'],
  ])('rejects an invalid %s with its location', (_label, mutate, location) => {
    const content = validContent()
    mutate(content)
    expect(() => validateContent(content)).toThrow(location)
  })

  it.each(['2025-02-29', '2026-13-01', '2026-04-31', '2026-1-01', 'not-a-date'])(
    'rejects invalid calendar date %s',
    (date) => {
      const content = validContent()
      content.albums[0].date = date
      expect(() => validateContent(content)).toThrow('albums[0].date')
    },
  )

  it('accepts a real leap day', () => {
    const content = validContent()
    content.albums[0].date = '2024-02-29'
    expect(validateContent(content).albums[0].date).toBe('2024-02-29')
  })

  it('rejects duplicate album ids globally', () => {
    const content = validContent()
    content.albums.push({ id: 'summer-2026', title: '重复相册', media: [] })
    expect(() => validateContent(content)).toThrow('albums[1].id')
  })

  it('rejects duplicate media ids within an album but permits them in different albums', () => {
    const duplicate = validContent()
    duplicate.albums[0].media.push({ id: 'lake', type: 'photo', src: 'media/other.jpg' })
    expect(() => validateContent(duplicate)).toThrow('albums[0].media[2].id')

    const separateAlbums = validContent()
    separateAlbums.albums.push({
      id: 'spring-2026',
      title: '春日',
      media: [{ id: 'lake', type: 'photo', src: 'media/spring-lake.jpg' }],
    })
    expect(validateContent(separateAlbums)).toEqual(separateAlbums)
  })

  it.each([
    '/media/photo.jpg',
    'https://example.com/photo.jpg',
    'data:image/png;base64,abc',
    'media\\photo.jpg',
    '../photo.jpg',
    'media/../photo.jpg',
    'media/%2e%2e/photo.jpg',
    'media/%252e%252e/photo.jpg',
    'media/%2Fetc/passwd',
    'media/photo.jpg?size=large',
    'media/photo.jpg%3Fsize=large',
    'media/photo.jpg#large',
    'media/photo.jpg%23large',
  ])('rejects unsafe asset path %s', (path) => {
    expect(() => assertAssetPath(path, 'asset')).toThrow('asset')
  })

  it('reports the exact path field for unsafe assets', () => {
    const content = validContent()
    const video = content.albums[0].media[1] as Video
    video.poster = '../poster.jpg'
    expect(() => validateContent(content)).toThrow('albums[0].media[1].poster')
  })

  it('rejects malformed root structures and unknown media types', () => {
    expect(() => validateContent(null)).toThrow('content')
    expect(() => validateContent({ site: {}, albums: [] })).toThrow('site.title')

    const content = validContent()
    content.albums[0].media[0] = {
      id: 'audio',
      type: 'audio',
      src: 'media/audio.mp3',
    } as unknown as SiteContent['albums'][number]['media'][number]
    expect(() => validateContent(content)).toThrow('albums[0].media[0].type')
  })
})

describe('sortAlbums', () => {
  it('sorts albums newest first and media oldest first, with missing dates last', () => {
    const albums: Album[] = [
      { id: 'undated-a', title: '无日期一', media: [] },
      {
        id: 'newer-a',
        title: '较新一',
        date: '2026-05-01',
        media: [
          { id: 'undated-a', type: 'photo', src: 'media/a.jpg' },
          { id: 'later', type: 'photo', src: 'media/later.jpg', date: '2026-05-03' },
          { id: 'early-a', type: 'photo', src: 'media/early-a.jpg', date: '2026-05-01' },
          { id: 'early-b', type: 'photo', src: 'media/early-b.jpg', date: '2026-05-01' },
          { id: 'undated-b', type: 'photo', src: 'media/b.jpg' },
        ],
      },
      { id: 'older', title: '较旧', date: '2025-12-01', media: [] },
      { id: 'newer-b', title: '较新二', date: '2026-05-01', media: [] },
      { id: 'undated-b', title: '无日期二', media: [] },
    ]

    const sorted = sortAlbums(albums)

    expect(sorted.map(({ id }) => id)).toEqual(['newer-a', 'newer-b', 'older', 'undated-a', 'undated-b'])
    expect(sorted[0].media.map(({ id }) => id)).toEqual(['early-a', 'early-b', 'later', 'undated-a', 'undated-b'])
  })

  it('does not mutate album or media arrays', () => {
    const albums = validContent().albums
    const albumOrder = albums.map(({ id }) => id)
    const mediaOrder = albums[0].media.map(({ id }) => id)

    const sorted = sortAlbums(albums)

    expect(sorted).not.toBe(albums)
    expect(sorted[0].media).not.toBe(albums[0].media)
    expect(albums.map(({ id }) => id)).toEqual(albumOrder)
    expect(albums[0].media.map(({ id }) => id)).toEqual(mediaOrder)
  })
})
