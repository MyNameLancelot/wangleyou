import type { Album, Photo } from '../content'

export type HomeSection = 'hero' | 'memory'
export type HomeDirection = -1 | 1

export type HomeMemory = {
  items: Array<{ album: Album; media: Photo }>
  index: number
  playing: boolean
}

export const HOME_MEMORY_INTERVAL_MS = 5_000
export const HOME_GESTURE_THRESHOLD = 56

export function getHomeWheelIntent(accumulatedDeltaY: number, deltaY: number, threshold = HOME_GESTURE_THRESHOLD): {
  direction: HomeDirection | null
  accumulatedDeltaY: number
} {
  const nextDeltaY = accumulatedDeltaY + deltaY
  if (Math.abs(nextDeltaY) < threshold) return { direction: null, accumulatedDeltaY: nextDeltaY }
  return { direction: nextDeltaY > 0 ? 1 : -1, accumulatedDeltaY: 0 }
}

export function canChangeHomeSection(current: HomeSection, next: HomeSection, transitionLocked: boolean): boolean {
  return !transitionLocked && current !== next
}

export function getHomeKeyIntent(key: string, options: {
  viewerOpen: boolean
  defaultPrevented: boolean
  interactiveTarget: boolean
}): HomeDirection | null {
  if (options.viewerOpen || options.defaultPrevented || options.interactiveTarget) return null
  if (key === 'ArrowDown' || key === 'PageDown') return 1
  if (key === 'ArrowUp' || key === 'PageUp') return -1
  return null
}

export function getHomeTouchIntent(start: { x: number; y: number }, end: { x: number; y: number }, threshold = HOME_GESTURE_THRESHOLD): HomeDirection | null {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  if (Math.abs(deltaY) < threshold || Math.abs(deltaY) <= Math.abs(deltaX)) return null
  return deltaY < 0 ? 1 : -1
}

export function shouldRunHomeMemoryInterval(options: {
  section: HomeSection
  playing: boolean
  itemCount: number
  documentVisible: boolean
  viewerOpen: boolean
}): boolean {
  return options.section === 'memory'
    && options.playing
    && options.itemCount > 0
    && options.documentVisible
    && !options.viewerOpen
}

export type HomeMemoryIntervalScheduler<Handle> = {
  setInterval: (callback: () => void, delay: number) => Handle
  clearInterval: (handle: Handle) => void
}

export function createHomeMemoryIntervalController<Handle>(
  scheduler: HomeMemoryIntervalScheduler<Handle>,
  onTick: () => void,
  interval = HOME_MEMORY_INTERVAL_MS,
) {
  let handle: Handle | undefined

  const stop = () => {
    if (handle === undefined) return
    scheduler.clearInterval(handle)
    handle = undefined
  }

  return {
    sync(shouldRun: boolean) {
      if (!shouldRun) {
        stop()
        return
      }
      if (handle === undefined) handle = scheduler.setInterval(onTick, interval)
    },
    dispose: stop,
  }
}

export function nextHomeSection(section: HomeSection, delta: HomeDirection): HomeSection {
  if (section === 'hero' && delta === 1) return 'memory'
  if (section === 'memory' && delta === -1) return 'hero'
  return section
}

export function createHomeMemory(albums: Album[], limit = 12): HomeMemory {
  const candidates: Array<{ album: Album; media: Photo; order: number }> = []
  let order = 0

  for (const album of albums) {
    for (const media of album.media) {
      if (media.type === 'photo') {
        candidates.push({ album, media, order })
      }
      order += 1
    }
  }

  candidates.sort((a, b) => {
    if (a.media.date === undefined) return b.media.date === undefined ? a.order - b.order : 1
    if (b.media.date === undefined) return -1
    return b.media.date.localeCompare(a.media.date) || a.order - b.order
  })

  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 12
  const items = candidates.slice(0, count).map(({ album, media }) => ({ album, media }))
  return { items, index: 0, playing: true }
}

export function stepHomeMemory(memory: HomeMemory, delta: HomeDirection, loop = true): HomeMemory {
  if (memory.items.length === 0) return { ...memory, index: 0 }

  const nextIndex = memory.index + delta
  if (nextIndex >= 0 && nextIndex < memory.items.length) {
    return { ...memory, index: nextIndex }
  }

  if (!loop) {
    return { ...memory, index: Math.min(Math.max(memory.index, 0), memory.items.length - 1) }
  }

  return { ...memory, index: nextIndex < 0 ? memory.items.length - 1 : 0 }
}
