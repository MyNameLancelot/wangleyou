import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchEvent, WheelEvent } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { mediaUrl } from '../../content';
import type { Photo, Video } from '../../content';
import { isVideo } from '../../playback';
import type { PlaybackStatus, Session } from '../../playback';
import styles from './ThemeViewer.module.css';

/** 查看器只投影 session 并转发命令；播放业务状态仍归 playback。 */
export interface ViewerCommands {
  step(delta: number): void;
  close(): void;
  toggleIntent(): void;
  reportProgress(progress: number, duration: number): void;
  reportStatus(status: PlaybackStatus): void;
  reportEnded(): void;
  reportError(): void;
  reportBlocked(): void;
}

/** 桌面滚轮阈值与冷却：一次滚动只推进一步。 */
const SCROLL_STEP = 45;
const SCROLL_GAP = 420;

const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
};

function PhotoPane({ photo, caption, onReload }: { photo: Photo; caption?: string; onReload: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadCount, setReloadCount] = useState(0);

  if (phase === 'error') {
    return <div className={styles.noticeCard} role="status">
      <p className={styles.noticeTitle}>这张照片暂时无法加载</p>
      <p className={styles.noticeText}>可以重新加载，或用上一项、下一项继续浏览。</p>
      <button type="button" onClick={() => { setReloadCount(count => count + 1); setPhase('loading'); onReload(); }}>重新加载</button>
    </div>;
  }

  return <figure className={styles.photoPane} aria-busy={phase === 'loading'}>
    <img
      key={reloadCount}
      className={styles.photo}
      data-ready={phase === 'ready'}
      src={mediaUrl(photo.src)}
      alt={photo.alt || photo.description || '相册照片'}
      draggable={false}
      onLoad={() => setPhase('ready')}
      onError={() => setPhase('error')}
    />
    {phase === 'loading' && <p className={styles.photoLoading} role="status">正在读取影像…</p>}
    {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
  </figure>;
}

function VideoPane({ video, caption, session, commands, onReload }: { video: Video; caption?: string; session: Session; commands: ViewerCommands; onReload: () => void }) {
  const element = useRef<HTMLVideoElement>(null);
  const [silent, setSilent] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const node = element.current;
    if (!node || session.status === 'error') return;
    if (session.intent === 'playing' && node.paused) void node.play().catch(commands.reportBlocked);
    if (session.intent === 'paused' && !node.paused) node.pause();
  }, [reloadCount, commands, session.intent, session.status, video.id]);

  if (session.status === 'error') {
    return <div className={styles.noticeCard} role="status">
      <p className={styles.noticeTitle}>这段视频暂时无法播放</p>
      <p className={styles.noticeText}>可以重新加载，或用上一项、下一项继续浏览。</p>
      <button type="button" onClick={() => { setReloadCount(count => count + 1); commands.reportStatus('loading'); onReload(); }}>重新加载</button>
    </div>;
  }

  const scrub = (ratio: number) => {
    const node = element.current;
    if (!node || !Number.isFinite(node.duration) || node.duration <= 0) return;
    node.currentTime = ratio * node.duration;
    commands.reportProgress(ratio, node.duration);
  };

  return <section className={styles.videoPane} aria-label="视频播放器">
    <video
      key={video.id + ':' + reloadCount}
      ref={element}
      className={styles.video}
      src={mediaUrl(video.src)}
      poster={video.poster ? mediaUrl(video.poster) : undefined}
      playsInline
      preload="metadata"
      muted={silent}
      aria-label={video.description || '相册视频'}
      onLoadedMetadata={event => commands.reportProgress(0, event.currentTarget.duration)}
      onCanPlay={() => commands.reportStatus(session.intent === 'playing' ? 'playing' : 'paused')}
      onTimeUpdate={event => {
        const total = event.currentTarget.duration;
        commands.reportProgress(total > 0 ? event.currentTarget.currentTime / total : 0, total);
      }}
      onPlay={() => commands.reportStatus('playing')}
      onPause={event => { if (!event.currentTarget.ended) commands.reportStatus('paused'); }}
      onWaiting={() => commands.reportStatus('loading')}
      onEnded={commands.reportEnded}
      onError={commands.reportError}
    >
      {video.captions && <track kind="captions" src={mediaUrl(video.captions)} srcLang="zh" label="中文说明" default />}
    </video>
    {caption && <p className={styles.caption}>{caption}</p>}
    <div className={styles.videoMeta}>
      {!video.poster && <span className={styles.flag}>无封面视频</span>}
      {session.status === 'loading' && <span role="status">正在加载视频…</span>}
      {session.status === 'ended' && <span role="status">播放已结束，请手动切换下一项</span>}
    </div>
    <div className={styles.timeline} data-viewer-controls>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(session.progress * 100)}
        aria-label="视频播放进度"
        onChange={event => scrub(Number(event.currentTarget.value) / 100)}
      />
      <div className={styles.timelineTools}>
        <button type="button" aria-label={session.intent === 'playing' ? '暂停视频' : '播放视频'} onClick={commands.toggleIntent}>
          {session.intent === 'playing' ? <Pause /> : <Play />}
        </button>
        <span className={styles.clock}>{clock(session.progress * session.duration)} / {clock(session.duration)}</span>
        <button type="button" aria-label={silent ? '取消静音' : '静音'} aria-pressed={silent} onClick={() => setSilent(value => !value)}>
          {silent ? <VolumeX /> : <Volume2 />}
        </button>
      </div>
    </div>
  </section>;
}

export function MediaViewer({ session, commands }: { session: Session; commands: ViewerCommands }) {
  const shell = useRef<HTMLDialogElement>(null);
  const fullscreenHost = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const scrollRun = useRef(0);
  const scrollBlockedUntil = useRef(0);
  const live = useRef(false);
  const [fullscreenNote, setFullscreenNote] = useState('');

  const media = session.media[session.index] ?? null;
  const video = isVideo(media) ? media : null;
  const photo = media?.type === 'photo' ? media : null;
  const caption = media?.caption ?? media?.description;
  const atStart = session.index === 0;
  const atEnd = session.index === session.media.length - 1;

  useEffect(() => {
    const upcoming = session.media[session.index + 1];
    if (upcoming?.type !== 'photo') return;
    const image = new Image();
    image.src = mediaUrl(upcoming.src);
    return () => { image.src = ''; };
  }, [session]);

  useEffect(() => {
    live.current = true;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = shell.current;
    const host = fullscreenHost.current;
    const previousOverflow = document.body.style.overflow;
    node?.showModal();
    // 打开时不聚焦按钮，避免鼠标打开也出现焦点环；Tab 进入控件时才显示焦点。
    node?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      live.current = false;
      if (document.fullscreenElement === host) void document.exitFullscreen().catch(() => {});
      node?.close();
      document.body.style.overflow = previousOverflow;
      if (opener.current?.isConnected) opener.current.focus();
      else document.querySelector<HTMLElement>('main')?.focus();
    };
  }, []);

  useEffect(() => {
    const guard = (event: FocusEvent) => {
      if (!live.current || !shell.current) return;
      if (event.target instanceof Node && shell.current.contains(event.target)) return;
      shell.current.focus();
    };
    document.addEventListener('focusin', guard);
    return () => document.removeEventListener('focusin', guard);
  }, []);

  useEffect(() => { scrollRun.current = 0; }, [session.index]);

  const toggleFullscreen = useCallback(() => {
    const host = fullscreenHost.current;
    if (!host) return;
    const request = document.fullscreenElement === host ? document.exitFullscreen() : host.requestFullscreen();
    void request.catch(() => setFullscreenNote('全屏暂不可用，仍可在此查看'));
  }, []);

  /** 重试按钮卸载后把焦点交回画布，避免键盘与读屏失去落点。 */
  const focusCanvas = useCallback(() => {
    requestAnimationFrame(() => canvas.current?.focus());
  }, []);

  /** 文档级快捷键：状态变化导致焦点丢失时仍然可用，并显式维护 Tab 焦点环。 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const node = shell.current;
      if (!node) return;
      if (event.key === 'Tab') {
        // 只把真正渲染出来的控件算进焦点环：移动端隐藏的导航按钮不参与。
        const focusables = Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'))
          .filter(item => item.getClientRects().length > 0);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = active instanceof Node && node.contains(active);
        if (event.shiftKey && (!inside || active === first)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (!inside || active === last)) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); commands.close(); return; }
      if (event.target instanceof HTMLInputElement && event.target.type === 'range') return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); commands.step(-1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); commands.step(1); return; }
      if ((event.key === ' ' || event.key === 'Spacebar') && video) { event.preventDefault(); commands.toggleIntent(); return; }
      if (event.key === 'f' || event.key === 'F') toggleFullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [commands, toggleFullscreen, video]);

  /** 单指横向滑动切换；从控件区开始的触摸与纵向滑动都不参与。 */
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) { swipe.current = null; return; }
    if (event.target instanceof Element && event.target.closest('button,input,a,[data-viewer-controls]')) { swipe.current = null; return; }
    swipe.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.5) commands.step(dx < 0 ? 1 : -1);
  };

  /** 桌面滚轮切换：进度条区域保留给视频拖动，不参与切换。 */
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('[data-viewer-controls]')) return;
    const now = Date.now();
    if (now < scrollBlockedUntil.current) return;
    scrollRun.current += event.deltaY;
    if (Math.abs(scrollRun.current) < SCROLL_STEP) return;
    const direction = scrollRun.current > 0 ? 1 : -1;
    scrollRun.current = 0;
    scrollBlockedUntil.current = now + SCROLL_GAP;
    commands.step(direction);
  };

  return <dialog
    ref={shell}
    className={styles.viewer}
    aria-label="影像查看器"
    tabIndex={-1}
    data-media-position={session.index + 1}
    data-media-count={session.media.length}
    onCancel={event => { event.preventDefault(); commands.close(); }}
  >
    <div ref={fullscreenHost} className={video ? styles.frame + ' ' + styles.frameVideo : styles.frame}>
      <div className={styles.topBar}>
        {/* 位置不再可见展示；这里只为读屏播报当前进度。 */}
        <p className={styles.srOnly} role="status">第 {session.index + 1} 项，共 {session.media.length} 项</p>
        <button ref={closeRef} type="button" className={styles.close} onClick={commands.close} aria-label="关闭查看器"><X /></button>
      </div>
      <div
        ref={canvas}
        className={styles.canvas}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { swipe.current = null; }}
        onWheel={onWheel}
      >
        <button type="button" className={styles.step + ' ' + styles.back} onClick={() => commands.step(-1)} disabled={atStart} aria-label="上一项"><ChevronLeft /></button>
        {photo
          ? <PhotoPane key={photo.id} photo={photo} caption={caption} onReload={focusCanvas} />
          : video
            ? <VideoPane key={video.id} video={video} caption={caption} session={session} commands={commands} onReload={focusCanvas} />
            : <div className={styles.noticeCard} role="status"><p className={styles.noticeTitle}>这里暂时没有影像</p><p className={styles.noticeText}>关闭查看器即可回到相册继续浏览。</p></div>}
        <button type="button" className={styles.step + ' ' + styles.forward} onClick={() => commands.step(1)} disabled={atEnd} aria-label="下一项"><ChevronRight /></button>
      </div>
      <div className={styles.footerLine}>
        {video && <button type="button" className={styles.fullscreen} onClick={toggleFullscreen} aria-label="全屏查看"><Maximize /></button>}
        {fullscreenNote && <p className={styles.statusLine} role="status">{fullscreenNote}</p>}
      </div>
    </div>
  </dialog>;
}
