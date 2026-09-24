import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import VideoPlugin from 'yet-another-react-lightbox/plugins/video';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import { mediaUrl } from '../content';
import type { Media } from '../content';
import { currentMedia } from '../playback';
import type { PlaybackStatus, Session } from '../playback';
import styles from './MediaViewer.module.css';

/** 查看器命令：主题与 App 只负责装配，不拥有查看器状态。 */
export interface MediaViewerCommands {
  /** 查看器内部翻页后回写会话索引；会话仍是索引的唯一事实来源。 */
  stepTo(index: number): void;
  close(): void;
  reportProgress(progress: number, duration: number): void;
  reportStatus(status: PlaybackStatus): void;
  reportEnded(): void;
  reportError(): void;
  reportBlocked(media: Media[], index: number): void;
}

/**
 * 全站共用的媒体查看器。
 *
 * 这是共用组件：两套主题只负责在会话存在时挂载它，样式与功能都由本模块和
 * `yet-another-react-lightbox` 官方示例（Captions、Fullscreen、Slideshow、Thumbnails、
 * Video、Zoom 全部启用、库默认样式）决定，主题不得覆盖它的类名、样式或行为，
 * 也不得复制出第二份查看器。
 *
 * 会话、索引与播放状态由 playback 唯一持有：这里受控渲染 `open`/`index`，
 * 把库的翻页事件与原生 video 事件翻译成命令，不保存第二份索引或播放状态。
 */
export function MediaViewer({ session, commands }: { session: Session; commands: MediaViewerCommands }) {
  // 事件回调里只读播放意图，用于判断是否尝试自动播放；索引与进度始终走命令回写 playback。
  const intentRef = useRef(session.intent);
  const thumbnailsRef = useRef<{ visible: boolean; show: () => void; hide: () => void } | null>(null);
  const [thumbnailsVisible, setThumbnailsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const current = currentMedia(session);
  const slides = useMemo(() => session.media.map(media => slideOf(media)), [session.media]);

  useEffect(() => {
    intentRef.current = session.intent;
  }, [session.intent]);

  /** 收起/展开缩略图：状态由插件持有，这里只读回可见性并渲染自己的收起条。 */
  const toggleThumbnails = useCallback(() => {
    const ref = thumbnailsRef.current;
    if (!ref) return;
    const next = !ref.visible;
    if (next) ref.show(); else ref.hide();
    setThumbnailsVisible(next);
  }, []);

  /**
   * 寄语贴在当前影像的左下角：量出影像相对舞台的位置，把换算结果写成查看器根节点上的
   * 自定义属性，由共用样式消费（影像没渲染出来时清掉，退回舞台左下角）。
   */
  useEffect(() => {
    const properties = ['--viewer-caption-left', '--viewer-caption-bottom', '--viewer-caption-max-width']
    const clear = (root: HTMLElement | null | undefined) => {
      for (const name of properties) root?.style.removeProperty(name)
    }
    const measure = () => {
      const slide = document.querySelector<HTMLElement>('.yarl__slide_current');
      const root = slide?.closest<HTMLElement>('.yarl__portal');
      const media = slide?.querySelector<HTMLElement>('img, video');
      if (!slide || !media || !root) return clear(root);
      const slideBox = slide.getBoundingClientRect();
      const mediaBox = media.getBoundingClientRect();
      if (!mediaBox.width || !mediaBox.height) return clear(root);
      root.style.setProperty('--viewer-caption-left', `${Math.round(mediaBox.left - slideBox.left + 12)}px`);
      root.style.setProperty('--viewer-caption-bottom', `${Math.round(slideBox.bottom - mediaBox.bottom + 12)}px`);
      root.style.setProperty('--viewer-caption-max-width', `${Math.max(160, Math.round(mediaBox.width - 24))}px`);
    };
    // portal 与影像由库异步挂载、图片尺寸也要等加载完成，因此先扫描到元素再观察它的尺寸变化。
    const observer = new ResizeObserver(() => measure());
    let media: HTMLElement | null = null;
    let frame = 0;
    let attempts = 0;
    const attach = () => {
      const slide = document.querySelector<HTMLElement>('.yarl__slide_current');
      const found = slide?.querySelector<HTMLElement>('img, video') ?? null;
      if (!slide || !found) {
        if (attempts < 240) { attempts += 1; frame = requestAnimationFrame(attach); }
        return;
      }
      media = found;
      media.addEventListener('load', measure);
      media.addEventListener('loadedmetadata', measure);
      observer.observe(media);
      observer.observe(slide);
      measure();
    };
    attach();
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media?.removeEventListener('load', measure);
      media?.removeEventListener('loadedmetadata', measure);
      window.removeEventListener('resize', measure);
      clear(media?.closest<HTMLElement>('.yarl__portal'));
    };
  }, [session.index, slides]);

  /**
   * 键盘焦点环：查看器打开时 Tab 只在查看器内部循环。
   * 库把其余页面标记为 inert，但焦点越过最后一个控件会落到浏览器 chrome 上，
   * 那时 Esc 与方向键都不再送达查看器；因此在边界处显式回绕。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const portal = document.querySelector('.yarl__portal');
      if (!portal) return;
      // 只收真正可 Tab 到的控件：缩略图带有隐藏占位项（visibility: hidden），
      // 若把它们算进来，边界回绕就会算错位置、焦点仍旧逃到浏览器 chrome。
      const focusables = Array.from(portal.querySelectorAll<HTMLElement>('button:not([disabled]), video[controls], a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(node => node.getClientRects().length > 0 && node.tabIndex >= 0 && getComputedStyle(node).visibility !== 'hidden');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && portal.contains(active);
      if (event.shiftKey && (!inside || active === first)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (!inside || active === last)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  /** 视频事件只转发命令；切换媒体、关闭或卸载时全部解绑。 */
  useEffect(() => {
    if (current?.type !== 'video') return;
    const media = session.media;
    const index = session.index;
    const elementOf = () => document.querySelector<HTMLVideoElement>('.yarl__slide_current video');
    const deadline = performance.now() + 3000;
    let active = true;
    let element: HTMLVideoElement | null = null;
    let frame = 0;
    const onPlay = () => commands.reportStatus('playing');
    const onPause = () => { if (!element?.ended) commands.reportStatus('paused'); };
    const onEnded = () => commands.reportEnded();
    const onError = () => commands.reportError();
    const onWaiting = () => commands.reportStatus('loading');
    const onLoadedMetadata = () => commands.reportProgress(0, element?.duration ?? 0);
    const onTimeUpdate = () => {
      const duration = element?.duration ?? 0;
      commands.reportProgress(duration > 0 ? element!.currentTime / duration : 0, duration);
    };
    const listeners: Array<[string, EventListener]> = [
      ['play', onPlay],
      ['pause', onPause],
      ['ended', onEnded],
      ['error', onError],
      ['waiting', onWaiting],
      ['loadedmetadata', onLoadedMetadata],
      ['timeupdate', onTimeUpdate],
    ];
    const detach = () => {
      if (!element) return;
      for (const [type, handler] of listeners) element.removeEventListener(type, handler);
      element = null;
    };
    const attach = () => {
      const next = elementOf();
      if (!next) return false;
      element = next;
      for (const [type, handler] of listeners) next.addEventListener(type, handler);
      // 打开视频即尝试播放；被浏览器拒绝时停留当前项，交给原生控件作为主动播放入口。
      if (intentRef.current === 'playing' && next.paused) void next.play().catch(() => {
        if (active) commands.reportBlocked(media, index);
      });
      return true;
    };
    const scan = () => { if (!attach() && performance.now() < deadline) frame = requestAnimationFrame(scan); };
    scan();
    return () => {
      active = false;
      if (frame) cancelAnimationFrame(frame);
      detach();
    };
  }, [commands, current, session.media, session.index]);

  return <Lightbox
    open
    close={commands.close}
    index={session.index}
    slides={slides}
    plugins={[Captions, Fullscreen, Slideshow, Thumbnails, VideoPlugin, Zoom]}
    on={{
      view: ({ index }) => commands.stepTo(index),
      // 全屏时只留影像：工具栏、导航、缩略图带、收起条与寄语都在 CSS 里隐藏。
      // 触发全屏的按钮随工具栏隐藏，焦点会掉到 body，方向键与 Esc 就送不到查看器，
      // 因此进出全屏后都把焦点交回查看器容器，键盘切图在任何状态下都可用。
      enterFullscreen: () => {
        setFullscreen(true);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.yarl__container')?.focus());
      },
      exitFullscreen: () => {
        setFullscreen(false);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.yarl__container')?.focus());
      },
    }}
    render={{
      // 放大、缩小与关闭按钮在全端都不需要：工具栏只留幻灯片与全屏，退出靠 Esc 与背景点击。
      buttonZoom: () => null,
      buttonClose: () => null,
      // 缩略图上方通栏的收起条：向下箭头收起、向上箭头展开，图标取自 lucide-react。
      controls: () => <div className={styles.thumbBar}>
        <button
          type="button"
          className={styles.thumbBarButton}
          onClick={toggleThumbnails}
          aria-label={thumbnailsVisible ? '收起缩略图' : '展开缩略图'}
          aria-expanded={thumbnailsVisible}
        >
          {thumbnailsVisible ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
        </button>
      </div>,
    }}
    labels={{
      Lightbox: '影像查看器',
      Carousel: '影像轮播',
      Slide: '影像',
      'Photo gallery': '影像查看器',
      Previous: '上一项',
      Next: '下一项',
      Close: '关闭查看器',
      Caption: '影像寄语',
      '{index} of {total}': '第 {index} 项，共 {total} 项',
      Play: '播放幻灯片',
      Pause: '暂停幻灯片',
      'Enter Fullscreen': '进入全屏',
      'Exit Fullscreen': '退出全屏',
      Thumbnails: '缩略图',
      'Show thumbnails': '显示缩略图',
      'Hide thumbnails': '隐藏缩略图',
      'Zoom in': '放大',
      'Zoom out': '缩小',
    }}
    // 两处行为保留：不循环（首尾按钮禁用）与点击黑色背景关闭；其余沿用库默认。
    carousel={{ finite: true }}
    controller={{ closeOnBackdropClick: true }}
    thumbnails={{ ref: thumbnailsRef, showToggle: false }}
    video={{ controls: true, playsInline: true, preload: 'metadata' }}
    className={fullscreen ? `${styles.viewer} ${styles.fullscreen}` : styles.viewer}
  />;
}

/** 照片用派生 srcSet 与完整比例舞台，视频用视频插件的原生控件与派生封面。 */
function slideOf(media: Media) {
  const caption = media.caption ?? media.description;
  if (media.type === 'video') {
    return {
      type: 'video' as const,
      sources: [{ src: mediaUrl(media.src), type: 'video/mp4' }],
      poster: mediaUrl(media.poster),
      width: media.width,
      height: media.height,
      description: caption,
    };
  }
  return {
    src: mediaUrl(media.src),
    srcSet: media.srcSet?.map(item => ({ src: mediaUrl(item.src), width: item.width, height: item.height })),
    width: media.width,
    height: media.height,
    alt: media.alt || media.description || '相册照片',
    description: caption,
  };
}
