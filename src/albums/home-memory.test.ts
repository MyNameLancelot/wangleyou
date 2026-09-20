import { describe, expect, it } from 'vitest'

import type { Album } from '../content'
import {
  canChangeHomeSection,
  createHomeMemoryIntervalController,
  getHomeKeyIntent,
  getHomeMemorySwipeIntent,
  getHomeTouchIntent,
  getHomeWheelIntent,
  HOME_MEMORY_INTERVAL_MS,
  createHomeMemoryWheelState,
  createHomeMemory,
  nextHomeSection,
  reduceHomeMemoryWheel,
  setHomeMemoryPlaying,
  shouldRunHomeMemoryInterval,
  stepHomeMemory,
} from './home-memory'

const albums: Album[] = [
  {
    id: 'first',
    title: '第一本',
    media: [
      { id: 'old', type: 'photo', src: 'media/old.jpg', date: '2026-01-01' },
      { id: 'clip', type: 'video', src: 'media/clip.mp4', date: '2026-03-01' },
      { id: 'same-a', type: 'photo', src: 'media/same-a.jpg', date: '2026-02-01' },
    ],
  },
  {
    id: 'second',
    title: '第二本',
    media: [
      { id: 'undated-a', type: 'photo', src: 'media/undated-a.jpg' },
      { id: 'new', type: 'photo', src: 'media/new.jpg', date: '2026-04-01' },
      { id: 'same-b', type: 'photo', src: 'media/same-b.jpg', date: '2026-02-01' },
      { id: 'undated-b', type: 'photo', src: 'media/undated-b.jpg' },
    ],
  },
]

describe('nextHomeSection', () => {
  it('stays at the two section boundaries', () => {
    expect(nextHomeSection('hero', -1)).toBe('hero')
    expect(nextHomeSection('hero', 1)).toBe('memory')
    expect(nextHomeSection('memory', -1)).toBe('hero')
    expect(nextHomeSection('memory', 1)).toBe('memory')
  })
})

describe('home section input', () => {
  it('accumulates small wheel input until the threshold, then resets after one transition', () => {
    expect(getHomeWheelIntent(20, 20)).toEqual({ direction: null, accumulatedDeltaY: 40 })
    expect(getHomeWheelIntent(40, 16)).toEqual({ direction: 1, accumulatedDeltaY: 0 })
    expect(getHomeWheelIntent(-40, -16)).toEqual({ direction: -1, accumulatedDeltaY: 0 })
  })

  it('does not permit a duplicate section transition while locked or at the same section', () => {
    expect(canChangeHomeSection('hero', 'memory', false)).toBe(true)
    expect(canChangeHomeSection('hero', 'memory', true)).toBe(false)
    expect(canChangeHomeSection('hero', 'hero', false)).toBe(false)
  })

  it('keeps navigation keys with interactive controls and the viewer', () => {
    expect(getHomeKeyIntent('ArrowDown', { viewerOpen: false, defaultPrevented: false, interactiveTarget: false })).toBe(1)
    expect(getHomeKeyIntent('PageUp', { viewerOpen: false, defaultPrevented: false, interactiveTarget: false })).toBe(-1)
    expect(getHomeKeyIntent('ArrowDown', { viewerOpen: false, defaultPrevented: false, interactiveTarget: true })).toBeNull()
    expect(getHomeKeyIntent('ArrowDown', { viewerOpen: true, defaultPrevented: false, interactiveTarget: false })).toBeNull()
    expect(getHomeKeyIntent('ArrowDown', { viewerOpen: false, defaultPrevented: true, interactiveTarget: false })).toBeNull()
  })

  it('only treats threshold-crossing vertical swipes as section navigation', () => {
    expect(getHomeTouchIntent({ x: 0, y: 100 }, { x: 10, y: 44 })).toBe(1)
    expect(getHomeTouchIntent({ x: 0, y: 0 }, { x: 10, y: 56 })).toBe(-1)
    expect(getHomeTouchIntent({ x: 0, y: 100 }, { x: 56, y: 44 })).toBeNull()
    expect(getHomeTouchIntent({ x: 0, y: 100 }, { x: 12, y: 55 })).toBeNull()
  })

  it('only treats threshold-crossing horizontal swipes as memory steps', () => {
    expect(getHomeMemorySwipeIntent({ x: 260, y: 200 }, { x: 180, y: 210 })).toBe(1)
    expect(getHomeMemorySwipeIntent({ x: 180, y: 200 }, { x: 260, y: 210 })).toBe(-1)
    expect(getHomeMemorySwipeIntent({ x: 260, y: 200 }, { x: 240, y: 200 })).toBeNull()
    expect(getHomeMemorySwipeIntent({ x: 260, y: 400 }, { x: 180, y: 200 })).toBeNull()
    expect(getHomeMemorySwipeIntent({ x: 260, y: 200 }, { x: 180, y: 210 }, 120)).toBeNull()
  })

  it('merges small horizontal wheel input and only steps once per gesture', () => {
    let state = createHomeMemoryWheelState()
    const first = reduceHomeMemoryWheel(state, { deltaX: 30, at: 1_000 })
    expect(first).toEqual({ state: { accumulatedDeltaX: 30, consumed: false, lastEventAt: 1_000 }, direction: null })

    const second = reduceHomeMemoryWheel(first.state, { deltaX: 30, at: 1_040 })
    expect(second.direction).toBe(1)
    expect(second.state).toEqual({ accumulatedDeltaX: 0, consumed: true, lastEventAt: 1_040 })

    // 触控板动量继续发事件，但同一次手势不再换图
    state = reduceHomeMemoryWheel(second.state, { deltaX: 90, at: 1_080 }).state
    expect(reduceHomeMemoryWheel(state, { deltaX: 90, at: 1_120 }).direction).toBeNull()

    // 停手超过手势间隔（400ms）后开启下一次手势
    const nextGesture = reduceHomeMemoryWheel(state, { deltaX: -80, at: 1_520 })
    expect(nextGesture.direction).toBe(-1)
    expect(createHomeMemoryWheelState()).toEqual({ accumulatedDeltaX: 0, consumed: false, lastEventAt: 0 })
  })
})

describe('createHomeMemory', () => {
  it('keeps photos only, sorts newest first, and preserves ties and missing dates', () => {
    const memory = createHomeMemory(albums)
    expect(memory.items.map(({ media }) => media.id)).toEqual([
      'new',
      'same-a',
      'same-b',
      'old',
      'undated-a',
      'undated-b',
    ])
    expect(memory.index).toBe(0)
    expect(memory.playing).toBe(true)
  })

  it('takes at most the requested limit and defaults to twelve items', () => {
    expect(createHomeMemory(albums, 2).items).toHaveLength(2)
    const many: Album[] = [{ id: 'many', title: '很多', media: Array.from({ length: 13 }, (_, index) => ({
      id: `photo-${index}`,
      type: 'photo' as const,
      src: `media/photo-${index}.jpg`,
      date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    })) }]
    expect(createHomeMemory(many).items).toHaveLength(12)
  })
})

describe('stepHomeMemory', () => {
  it('wraps by default and preserves playing state', () => {
    const memory = { ...createHomeMemory(albums, 2), index: 1, playing: false }
    expect(stepHomeMemory(memory, 1)).toMatchObject({ index: 0, playing: false })
    expect(stepHomeMemory({ ...memory, index: 0 }, -1)).toMatchObject({ index: 1, playing: false })
  })

  it('stays at the edge when looping is disabled', () => {
    const memory = { ...createHomeMemory(albums, 2), index: 1, playing: true }
    expect(stepHomeMemory(memory, 1, false)).toMatchObject({ index: 1, playing: true })
    expect(stepHomeMemory({ ...memory, index: 0 }, -1, false)).toMatchObject({ index: 0, playing: true })
  })

  it('uses a two-second interval', () => {
    expect(HOME_MEMORY_INTERVAL_MS).toBe(2000)
  })

  it('records the explicit play intent without touching the queue', () => {
    const memory = { ...createHomeMemory(albums, 2), index: 1 }
    const paused = setHomeMemoryPlaying(memory, false)
    expect(paused).toMatchObject({ index: 1, playing: false })
    expect(setHomeMemoryPlaying(paused, false)).toBe(paused)
    expect(setHomeMemoryPlaying(paused, true)).toMatchObject({ index: 1, playing: true })
  })
})

describe('home memory interval lifecycle', () => {
  const intervalOptions = {
    section: 'memory' as const,
    playing: true,
    itemCount: 2,
    documentVisible: true,
    viewerOpen: false,
    foregroundResumeRequired: false,
  }

  it('only authorizes the interval for a visible, active memory section', () => {
    expect(shouldRunHomeMemoryInterval(intervalOptions)).toBe(true)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, section: 'hero' })).toBe(false)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, playing: false })).toBe(false)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, itemCount: 0 })).toBe(false)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, itemCount: 1 })).toBe(false)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, documentVisible: false })).toBe(false)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, foregroundResumeRequired: true })).toBe(false)
    expect(shouldRunHomeMemoryInterval({ ...intervalOptions, viewerOpen: true })).toBe(false)
  })

  it('clears an active interval when playback becomes ineligible or the page unmounts', () => {
    const callbacks: Array<() => void> = []
    const cleared: number[] = []
    const controller = createHomeMemoryIntervalController({
      setInterval: callback => {
        callbacks.push(callback)
        return callbacks.length
      },
      clearInterval: handle => cleared.push(handle),
    }, () => undefined)

    controller.sync(true)
    controller.sync(true)
    expect(callbacks).toHaveLength(1)
    controller.sync(false)
    expect(cleared).toEqual([1])

    controller.sync(true)
    controller.dispose()
    expect(cleared).toEqual([1, 2])
  })
})
