import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ControllerRef } from 'yet-another-react-lightbox';

/** 缩略图插件没有触屏横滑；索引仍归官方控制器与 playback。 */
export function useThumbnailSwipe(controller: RefObject<ControllerRef | null>) {
  useEffect(() => {
    let gesture: { id: number; x: number; y: number; strip: HTMLElement; horizontal: boolean; vertical: boolean } | null = null;
    let suppressClick = false;
    const stripOf = (target: EventTarget | null) => target instanceof Element
      ? target.closest<HTMLElement>('.yarl__portal .yarl__thumbnails_container') : null;
    const down = (event: PointerEvent) => {
      if (!event.isPrimary) { gesture = null; suppressClick = true; return; }
      suppressClick = false;
      const strip = stripOf(event.target);
      if (event.pointerType === 'mouse' || !strip) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, strip, horizontal: false, vertical: false };
    };
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const dx = Math.abs(event.clientX - gesture.x);
      const dy = Math.abs(event.clientY - gesture.y);
      if (!gesture.horizontal && !gesture.vertical && Math.max(dx, dy) >= 12) {
        gesture.horizontal = dx > dy;
        gesture.vertical = !gesture.horizontal;
      }
      if (gesture.horizontal) event.preventDefault();
    };
    const up = (event: PointerEvent) => {
      const current = gesture;
      if (!current || event.pointerId !== current.id) return;
      gesture = null;
      const dx = event.clientX - current.x;
      const dy = event.clientY - current.y;
      suppressClick = current.horizontal || current.vertical;
      if (!current.horizontal || !current.strip.isConnected || Math.abs(dx) < 36 || Math.abs(dx) <= Math.abs(dy)) return;
      if (dx < 0) controller.current?.next(); else controller.current?.prev();
    };
    const cancel = () => { gesture = null; suppressClick = true; };
    const click = (event: MouseEvent) => {
      if (suppressClick && stripOf(event.target) && event.detail !== 0) {
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    // 委托监听兼容延迟挂载及插件替换 DOM，无需轮询或新增观察器。
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, { capture: true, passive: false });
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('click', click, true);
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('click', click, true);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      gesture = null;
    };
  }, [controller]);
}
