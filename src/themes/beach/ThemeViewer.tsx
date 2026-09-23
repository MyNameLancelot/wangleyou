import { useCallback, useEffect, useRef, useState } from 'react';
import type { TouchEvent, WheelEvent } from 'react';
import { ChevronLeft, ChevronRight, Expand, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { mediaUrl } from '../../content';
import type { Photo, Video } from '../../content';
import { isVideo } from '../../playback';
import type { PlaybackStatus, Session } from '../../playback';
import styles from './ThemeViewer.module.css';

/** 查看器只转发命令，不维护第二套播放业务状态。 */
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

/** 桌面滚轮：累计到阈值才切一项，并在一段时间内忽略后续滚动，避免一次滚动跨过多张。 */
const WHEEL_THRESHOLD = 40;
const WHEEL_COOLDOWN = 420;

const timeText = (value: number) => !Number.isFinite(value) || value <= 0
  ? '--:--'
  : Math.floor(value / 60) + ':' + String(Math.floor(value) % 60).padStart(2, '0');

function PhotoStage({ photo, caption, onReload }: { photo: Photo; caption?: string; onReload: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  if (status === 'error') {
    // 状态面板属于影像展示的一部分：点击提示文字或重试按钮都不应关闭查看器。
    return <div className={styles.statePanel} role="status" data-viewer-controls>
      <strong>这张照片暂时无法加载</strong>
      <span>可以重新加载，或手动切换上一张、下一张。</span>
      <button type="button" onClick={() => { setAttempt(value => value + 1); setStatus('loading'); onReload(); }}>重新加载</button>
    </div>;
  }
  return <div className={styles.photoStage} aria-busy={status === 'loading'}>
    {/* 寄语已经显示在画面下方，alt 只补画面信息，避免读屏重复同一句话。 */}
    <img
      key={attempt}
      className={styles.photo}
      data-ready={status === 'ready'}
      src={mediaUrl(photo.src)}
      alt={photo.alt || photo.description || '相册照片'}
      draggable={false}
      onLoad={() => setStatus('ready')}
      onError={() => setStatus('error')}
    />
    {status === 'loading' && <p className={styles.loading} role="status" data-viewer-controls>正在打开这一刻…</p>}
    {caption && <p className={styles.description} data-viewer-controls>{caption}</p>}
  </div>;
}

function VideoStage({ video, caption, session, commands, onReload }: { video: Video; caption?: string; session: Session; commands: ViewerCommands; onReload: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || session.status === 'error') return;
    if (session.intent === 'playing' && element.paused) void element.play().catch(commands.reportBlocked);
    if (session.intent === 'paused' && !element.paused) element.pause();
  }, [attempt, commands, session.intent, session.status, video.id]);

  if (session.status === 'error') {
    return <div className={styles.statePanel} role="status" data-viewer-controls>
      <strong>这段视频暂时无法播放</strong>
      <span>可以重新加载，或手动切换上一项、下一项。</span>
      <button type="button" onClick={() => { setAttempt(value => value + 1); commands.reportStatus('loading'); onReload(); }}>重新加载</button>
    </div>;
  }

  const seek = (ratio: number) => {
    const element = videoRef.current;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    element.currentTime = ratio * element.duration;
    commands.reportProgress(ratio, element.duration);
  };

  return <div className={styles.videoStage}>
    <video
      key={video.id + '-' + attempt}
      ref={videoRef}
      className={styles.video}
      src={mediaUrl(video.src)}
      poster={video.poster ? mediaUrl(video.poster) : undefined}
      playsInline
      preload="metadata"
      muted={muted}
      aria-label={video.description || '相册视频'}
      onLoadedMetadata={event => commands.reportProgress(0, event.currentTarget.duration)}
      onCanPlay={() => commands.reportStatus(session.intent === 'playing' ? 'playing' : 'paused')}
      onTimeUpdate={event => {
        const duration = event.currentTarget.duration;
        commands.reportProgress(duration > 0 ? event.currentTarget.currentTime / duration : 0, duration);
      }}
      onPlay={() => commands.reportStatus('playing')}
      onPause={event => { if (!event.currentTarget.ended) commands.reportStatus('paused'); }}
      onWaiting={() => commands.reportStatus('loading')}
      onEnded={commands.reportEnded}
      onError={commands.reportError}
    >
      {video.captions && <track kind="captions" src={mediaUrl(video.captions)} srcLang="zh" label="中文说明" default />}
    </video>
    {!video.poster && <p className={styles.noPoster} data-viewer-controls>这段视频没有封面，点击播放即可查看。</p>}
    {session.status === 'loading' && <p className={styles.loading} role="status" data-viewer-controls>正在加载视频…</p>}
    {session.status === 'ended' && <p className={styles.ended} role="status" data-viewer-controls>已播放结束，可用上一项、下一项继续查看。</p>}
    {caption && <p className={styles.description} data-viewer-controls>{caption}</p>}
    <div className={styles.videoControls} data-viewer-controls>
      <input
        className={styles.progress}
        type="range"
        min={0}
        max={100}
        value={Math.round(session.progress * 100)}
        aria-label="视频播放进度"
        onChange={event => seek(Number(event.currentTarget.value) / 100)}
      />
      <div className={styles.videoTools}>
        <button type="button" aria-label={session.intent === 'playing' ? '暂停视频' : '播放视频'} onClick={commands.toggleIntent}>
          {session.intent === 'playing' ? <Pause /> : <Play />}
        </button>
        <span>{timeText(session.progress * session.duration)} / {timeText(session.duration)}</span>
        <button type="button" aria-label={muted ? '取消静音' : '静音'} aria-pressed={muted} onClick={() => setMuted(value => !value)}>
          {muted ? <VolumeX /> : <Volume2 />}
        </button>
      </div>
    </div>
  </div>;
}

export function MediaViewer({ session, commands }: { session: Session; commands: ViewerCommands }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fullscreenTarget = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const wheelTravel = useRef(0);
  const wheelLockedUntil = useRef(0);
  const mounted = useRef(false);
  const [notice, setNotice] = useState('');

  const media = session.media[session.index] ?? null;
  const video = isVideo(media) ? media : null;
  const photo = media?.type === 'photo' ? media : null;
  const caption = media?.caption ?? media?.description;
  const first = session.index === 0;
  const last = session.index === session.media.length - 1;

  /**
   * 相邻照片预加载：只依赖下一张照片的地址。
   * 视频播放时 timeupdate 会不断产生新 session，依赖整个 session 会反复重建 Image() 使预加载失效。
   */
  const upcoming = session.media[session.index + 1];
  const upcomingPhotoSrc = upcoming?.type === 'photo' ? upcoming.src : null;
  useEffect(() => {
    if (!upcomingPhotoSrc) return;
    const image = new Image();
    image.src = mediaUrl(upcomingPhotoSrc);
    return () => { image.src = ''; };
  }, [upcomingPhotoSrc]);

  /** 打开时锁定页面滚动并记录焦点来源；关闭、路由变化或卸载时全部归还。 */
  useEffect(() => {
    mounted.current = true;
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    const fullscreenElement = fullscreenTarget.current;
    const overflow = document.body.style.overflow;
    element?.showModal();
    // 打开时不聚焦按钮，避免鼠标打开也出现焦点环；Tab 进入控件时才显示焦点。
    element?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      if (document.fullscreenElement === fullscreenElement) void document.exitFullscreen().catch(() => {});
      element?.close();
      document.body.style.overflow = overflow;
      if (trigger.current?.isConnected) trigger.current.focus();
      else document.querySelector<HTMLElement>('main')?.focus();
    };
  }, []);

  /** 原生 dialog 的 cancel 默认会关闭对话框；关闭只由 Esc 快捷键或关闭按钮命令发起。 */
  useEffect(() => {
    const element = dialog.current;
    const preventNativeCancel = (event: Event) => event.preventDefault();
    element?.addEventListener('cancel', preventNativeCancel);
    return () => element?.removeEventListener('cancel', preventNativeCancel);
  }, []);

  /** 模态焦点兜底：焦点被挪出对话框时拉回关闭按钮，保证键盘操作始终可用。 */
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (!mounted.current || !dialog.current) return;
      if (event.target instanceof Node && dialog.current.contains(event.target)) return;
      dialog.current.focus();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    wheelTravel.current = 0;
  }, [session.index]);

  const fullscreen = useCallback(() => {
    const target = fullscreenTarget.current;
    if (!target) return;
    const action = document.fullscreenElement === target ? document.exitFullscreen() : target.requestFullscreen();
    void action.catch(() => setNotice('全屏暂不可用，仍可在此查看'));
  }, []);

  /** 重试后按钮会被卸载，把焦点交回舞台，键盘和读屏都不会失去位置。 */
  const restoreStageFocus = useCallback(() => {
    requestAnimationFrame(() => stage.current?.focus());
  }, []);

  /**
   * 查看器打开期间用文档级监听：焦点因状态变化丢失时快捷键仍然可用，
   * 并显式维护 Tab 焦点环。进度条的左右键留给视频拖动本身。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const element = dialog.current;
      if (!element) return;
      if (event.key === 'Tab') {
        // 只把真正渲染出来的控件算进焦点环：移动端隐藏的导航按钮不参与。
        const focusables = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]'))
          .filter(node => node.getClientRects().length > 0);
        // 照片模式下手机/平板没有任何可聚焦控件：把 Tab 留在查看器上，避免焦点跑到模态框后面。
        if (focusables.length === 0) { event.preventDefault(); element.focus(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = active instanceof Node && element.contains(active);
        if (event.shiftKey && (!inside || active === first)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (!inside || active === last)) { event.preventDefault(); first.focus(); }
        return;
      }
      if (event.key === 'Escape') { event.preventDefault(); commands.close(); return; }
      if (event.target instanceof HTMLInputElement && event.target.type === 'range') return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); commands.step(-1); return; }
      if (event.key === 'ArrowRight') { event.preventDefault(); commands.step(1); return; }
      if ((event.key === ' ' || event.key === 'Spacebar') && video) { event.preventDefault(); commands.toggleIntent(); return; }
      if (event.key === 'f' || event.key === 'F') fullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [commands, fullscreen, video]);

  /** 移动端横向滑动切换；从控件或视频工具区开始的触摸不参与，纵向滑动留给页面。 */
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) { touchStart.current = null; return; }
    if (event.target instanceof Element && event.target.closest('button,input,a,[data-viewer-controls]')) { touchStart.current = null; return; }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) >= 56 && Math.abs(dx) > Math.abs(dy) * 1.5) commands.step(dx < 0 ? 1 : -1);
  };

  /** 桌面滚轮切换：视频控件区域不参与，避免拖动进度时被切换打断。 */
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('[data-viewer-controls]')) return;
    const now = Date.now();
    if (now < wheelLockedUntil.current) return;
    wheelTravel.current += event.deltaY;
    if (Math.abs(wheelTravel.current) < WHEEL_THRESHOLD) return;
    const delta = wheelTravel.current > 0 ? 1 : -1;
    wheelTravel.current = 0;
    wheelLockedUntil.current = now + WHEEL_COOLDOWN;
    commands.step(delta);
  };

  return <dialog
    ref={dialog}
    className={styles.dialog}
    aria-label="影像查看器"
    tabIndex={-1}
    data-media-position={session.index + 1}
    data-media-count={session.media.length}
    onClick={event => {
      if (event.target instanceof Element && event.target.closest('img,video,button,input,a,[data-viewer-controls]')) return;
      commands.close();
    }}
  >
    <div ref={fullscreenTarget} className={video ? styles.viewport + ' ' + styles.videoViewport : styles.viewport}>
      <header className={styles.header}>
        {/* 位置不再可见展示；这里只为读屏播报当前进度。 */}
        <p className={styles.srOnly} role="status">第 {session.index + 1} 项，共 {session.media.length} 项</p>
        {/* 照片为静默舞台：不渲染关闭按钮，退出只依赖背景点击与 Esc；视频与空状态仍保留显式关闭入口。 */}
        {!photo && <button ref={closeButton} type="button" className={styles.closeButton} onClick={commands.close} aria-label="关闭查看器"><X /></button>}
      </header>
      <div
        ref={stage}
        className={styles.stage}
        tabIndex={-1}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { touchStart.current = null; }}
        onWheel={onWheel}
      >
        <button type="button" className={styles.nav + ' ' + styles.previous} onClick={() => commands.step(-1)} disabled={first} aria-label="上一项"><ChevronLeft /></button>
        {photo
          ? <PhotoStage key={photo.id} photo={photo} caption={caption} onReload={restoreStageFocus} />
          : video
            ? <VideoStage key={video.id} video={video} caption={caption} session={session} commands={commands} onReload={restoreStageFocus} />
            : <div className={styles.statePanel} role="status"><strong>这里暂时没有影像</strong><span>可以关闭查看器，回到相册继续浏览。</span></div>}
        <button type="button" className={styles.nav + ' ' + styles.next} onClick={() => commands.step(1)} disabled={last} aria-label="下一项"><ChevronRight /></button>
      </div>
      {video && <button type="button" className={styles.fullscreenButton} onClick={fullscreen} aria-label="全屏查看"><Expand /></button>}
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </div>
  </dialog>;
}
