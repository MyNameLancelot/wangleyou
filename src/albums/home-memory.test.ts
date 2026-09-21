import { describe, expect, it } from 'vitest'
import type { Photo } from '../content'
import { createHomeMemory, stepHomeMemory } from './home-memory'

const photos: Photo[] = [
  { id: 'third', type: 'photo', src: 'media/photos/a/3.jpg' },
  { id: 'first', type: 'photo', src: 'media/photos/a/1.jpg' },
  { id: 'second', type: 'photo', src: 'media/photos/a/2.jpg' },
]

describe('createHomeMemory', () => {
  it('preserves the explicit JSON order without a limit', () => {
    const memory = createHomeMemory(photos)
    expect(memory.items.map(photo => photo.id)).toEqual(['third', 'first', 'second'])
  })
  it('wraps through explicitly ordered photos', () => {
    expect(stepHomeMemory({ ...createHomeMemory(photos), index: 2 }, 1).index).toBe(0)
  })
})
