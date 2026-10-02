import { useCallback, useEffect, useRef } from 'react';
import type { SlideshowRef } from 'yet-another-react-lightbox';
import { currentMedia, shouldPlaySession } from '../playback';
import type { Session } from '../playback';
import type { MediaViewerCommands } from './commands';
import { observeViewerMedia } from './observeViewerMedia';

/** 视频与可见性 DOM 适配；只持有资源/请求标记，业务状态由命令回写 playback。 */
export function useViewerPlayback(session: Session, commands: MediaViewerCommands) {
  // 事件回调里只读播放意图，用于判断是否尝试自动播放；索引与进度始终走命令回写 playback。
  const intentRef = useRef(session.intent);
  const visibleRef = useRef(document.visibilityState !== 'hidden');
  const resumeRef = useRef(session.resumeRequired);
  const playEpochRef = useRef(0);
  const slideshowRef = useRef<SlideshowRef | null>(null);
  const current = currentMedia(session);
  useEffect(() => {
    intentRef.current = shouldPlaySession(session) ? 'playing' : 'paused';
    resumeRef.current = session.resumeRequired;
  }, [session]);

  const attachSlideshow = useCallback((ref: SlideshowRef | null) => {
    slideshowRef.current = ref;
    if (!visibleRef.current && ref?.playing) ref.pause();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      visibleRef.current = visible;
      if (!visible) {
        playEpochRef.current += 1;
        resumeRef.current = true;
        slideshowRef.current?.pause();
        document.querySelector<HTMLVideoElement>('.yarl__slide_current video')?.pause();
      }
      commands.reportVisibility(visible);
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => {
      playEpochRef.current += 1;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [commands]);

  /** 视频事件只转发命令；切换媒体、关闭或卸载时全部解绑。 */
  useEffect(() => {
    if (current?.type !== 'video') return;
    const media = session.media;
    const index = session.index;
    let detach = () => {};
    const stopObserving = observeViewerMedia(({ media: found }) => {
      detach();
      detach = () => {};
      if (!(found instanceof HTMLVideoElement)) return;
      const element = found;
      let bound = true;
      let autoplayPending = false;
      const epoch = playEpochRef.current;
      const isCurrent = () => bound && element.isConnected && document.querySelector('.yarl__slide_current video') === element;
      const onPlay = () => {
        if (!isCurrent() || !visibleRef.current || (autoplayPending && epoch !== playEpochRef.current)) {
          element.pause();
          return;
        }
        if (!autoplayPending) {
          resumeRef.current = false;
          intentRef.current = 'playing';
          commands.reportIntent('playing');
        }
        commands.reportStatus('playing');
      };
      const onPause = () => {
        if (!isCurrent() || element.ended) return;
        if (visibleRef.current && !resumeRef.current && !autoplayPending) {
          intentRef.current = 'paused';
          commands.reportIntent('paused');
        }
        commands.reportStatus('paused');
      };
      const onEnded = () => { if (isCurrent()) commands.reportEnded(); };
      const onError = () => { if (isCurrent()) commands.reportError(); };
      const onWaiting = () => { if (isCurrent() && visibleRef.current && !resumeRef.current) commands.reportStatus('loading'); };
      const onProgress = () => {
        if (!isCurrent()) return;
        const duration = element.duration;
        commands.reportProgress(duration > 0 ? element.currentTime / duration : 0, duration);
      };
      const listeners: Array<[string, EventListener]> = [
        ['play', onPlay], ['pause', onPause], ['ended', onEnded], ['error', onError],
        ['waiting', onWaiting], ['loadedmetadata', onProgress], ['timeupdate', onProgress],
      ];
      for (const [type, handler] of listeners) element.addEventListener(type, handler);
      detach = () => {
        bound = false;
        for (const [type, handler] of listeners) element.removeEventListener(type, handler);
        element.pause();
      };
      // 当前 DOM 绑定拥有自己的请求标记；替换元素也会使旧请求失效。
      if (!visibleRef.current || resumeRef.current) element.pause();
      else if (intentRef.current === 'playing' && element.paused) {
        autoplayPending = true;
        void element.play().then(() => {
          if (!isCurrent() || !visibleRef.current || epoch !== playEpochRef.current) element.pause();
        }).catch(() => {
          if (isCurrent() && visibleRef.current && epoch === playEpochRef.current) commands.reportBlocked(media, index);
        }).finally(() => { autoplayPending = false; });
      }
    });
    return () => { stopObserving(); detach(); };
  }, [commands, current, session.media, session.index]);

  return attachSlideshow;
}
