import type { Photo } from '../content'

export type HomeSection = 'hero' | 'memory'
export type HomeDirection = -1 | 1

export type HomeMemory = {
  items: Photo[]
  index: number
  playing: boolean
}

/** 主回忆自动播放间隔：照片为视觉主体，2 秒保持轻快又不至于看不清。 */
export const HOME_MEMORY_INTERVAL_MS = 2_000
export const HOME_GESTURE_THRESHOLD = 56

/** 主回忆横滑换图：横向位移达到阈值且大于纵向位移，纵向滑动留给页面滚动。 */
export function getHomeMemorySwipeIntent(start: { x: number; y: number }, end: { x: number; y: number }, threshold = HOME_GESTURE_THRESHOLD): HomeDirection | null {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return null
  return deltaX < 0 ? 1 : -1
}

export function shouldRunHomeMemoryInterval(options: {
  section: HomeSection
  playing: boolean
  itemCount: number
  documentVisible: boolean
  viewerOpen: boolean
  /** 页面隐藏造成的待恢复状态；回前台必须由用户显式恢复。 */
  foregroundResumeRequired?: boolean
}): boolean {
  return options.section === 'memory'
    && options.playing
    && options.itemCount > 1
    && options.documentVisible
    && !options.foregroundResumeRequired
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
    /** 手动换图后丢弃旧周期；仅已运行的自动播放重新从完整间隔开始。 */
    restart() {
      if (handle === undefined) return
      stop()
      handle = scheduler.setInterval(onTick, interval)
    },
    dispose: stop,
  }
}

export function createHomeMemory(items: Photo[]): HomeMemory {
  return { items: [...items], index: 0, playing: true }
}

export function stepHomeMemory(memory: HomeMemory, delta: HomeDirection, loop = true): HomeMemory {
  if (memory.items.length === 0) return { ...memory, index: 0 }

  const nextIndex = memory.index + delta
  if (nextIndex >= 0 && nextIndex < memory.items.length) {
    return { ...memory, index: nextIndex }
  }

  if (!loop) {
    const index = Math.min(Math.max(nextIndex, 0), memory.items.length)
    return { ...memory, index, playing: index === memory.items.length ? false : memory.playing }
  }

  return { ...memory, index: nextIndex < 0 ? memory.items.length - 1 : 0 }
}

/** 用户点击照片或播放按钮后的播放意图，不改动当前照片与队列。 */
export function setHomeMemoryPlaying(memory: HomeMemory, playing: boolean): HomeMemory {
  return memory.playing === playing ? memory : { ...memory, playing }
}
