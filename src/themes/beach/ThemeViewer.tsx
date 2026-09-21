import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { mediaUrl } from '../../content';
import type { Photo } from '../../content';
import { isVideo } from '../../playback';
import type { PlaybackStatus, Session } from '../../playback';
import styles from './ThemeViewer.module.css';

/** 查看器只转发命令，不维护第二套业务状态。 */
export interface ViewerCommands {
  step(delta: number): void;
  close(): void;
  toggleIntent(): void;
  toggleContinuous(): void;
  reportProgress(progress: number, duration: number): void;
  reportStatus(status: PlaybackStatus): void;
  reportEnded(): void;
  reportError(): void;
  /** 浏览器拒绝自动播放时降级为暂停，不当作播放失败。 */
  reportBlocked(): void;
  toggleTheme(): void;
}

const timeText = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

function FullPhoto({ photo, onRetry }: { photo: Photo; onRetry?: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  return <div className={styles.mediaArea} aria-busy={status === 'loading'}>
    {status === 'loading' && <p className={styles.caption} role="status">正在打开这一刻…</p>}
    {status === 'error' ? <div className={styles.statePanel} role="status">
      <p>这张照片暂时无法加载</p>
      <p className={styles.hint}>可以重试，也可以切换到下一项或关闭查看器</p>
      <button type="button" className={styles.retry} onClick={() => { onRetry?.(); setAttempt(n => n + 1); setStatus('loading'); }}>重新加载</button>
    </div> : <img key={attempt} className={styles.media} src={mediaUrl(photo.src)} alt={photo.alt || photo.description || '相册照片'} onLoad={() => setStatus('ready')} onError={() => setStatus('error')} style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }} />}
  </div>;
}

export function MediaViewer({ session, commands, themeLabel }: { session: Session; commands: ViewerCommands; themeLabel: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fullscreenTarget = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const mounted = useRef(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  const [notice, setNotice] = useState('');
  const [videoAttempt, setVideoAttempt] = useState(0);

  const media = session.media[session.index] ?? null;
  const video = isVideo(media) ? media : null;
  const photo = media?.type === 'photo' ? media : null;
  const isLast = session.index >= session.media.length - 1;
  const isFirst = session.index === 0;

  /** 控制栏：无操作 3 秒后隐藏，但仅在播放中隐藏；控件获得焦点时永不隐藏。 */
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (!video || session.intent !== 'playing') return;
    hideTimer.current = window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && controlsRef.current?.contains(active)) return;
      setControlsVisible(false);
    }, 3000);
  }, [session.intent, video]);

  useEffect(() => {
    mounted.current = true;
    const element = dialog.current;
    const fullscreenElement = fullscreenTarget.current;
    const focusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      if (document.fullscreenElement === fullscreenElement) void document.exitFullscreen().catch(() => {});
      element?.close();
      document.body.style.overflow = overflow;
      if (focusTarget?.isConnected) focusTarget.focus();
      else document.querySelector<HTMLElement>('main')?.focus();
    };
  }, []);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    };
  }, [showControls, session.index]);

  /** 播放意图驱动真实播放：真实暂停或失败不改写意图。 */
  useEffect(() => {
    const element = videoRef.current;
    if (!element || !video || session.status === 'error') return;
    if (session.intent === 'playing' && element.paused) void element.play().catch(() => commands.reportBlocked());
    if (session.intent === 'paused' && !element.paused) element.pause();
  }, [commands, session.intent, session.status, video, videoAttempt]);

  useEffect(() => {
    const next = session.media[session.index + 1];
    if (!next) return;
    if (next.type !== 'photo') return;
    const image = new Image();
    image.src = mediaUrl(next.src);
    return () => { image.src = ''; };
  }, [session]);

  useEffect(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !dialog.current?.contains(active) || (active instanceof HTMLButtonElement && active.disabled)) closeButton.current?.focus();
  }, [session.index]);

  /** 模态焦点兜底：任何原因把焦点丢到对话框外时拉回来，保证键盘快捷键始终可用。 */
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const element = dialog.current;
      if (!element || !mounted.current) return;
      if (event.target instanceof Node && element.contains(event.target)) return;
      closeButton.current?.focus();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const target = fullscreenTarget.current;
    if (!target) return;
    const request = document.fullscreenElement === target ? document.exitFullscreen() : target.requestFullscreen();
    void request.then(() => {
      if (!mounted.current && document.fullscreenElement === target) return document.exitFullscreen();
    }).catch(() => {
      if (mounted.current) setNotice('全屏暂不可用，仍可在此查看');
    });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Tab') {
      const focusables = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') ?? []);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      return;
    }
    showControls();
    if (event.key === 'ArrowRight') { event.preventDefault(); commands.step(1); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); commands.step(-1); return; }
    if (event.key === ' ' || event.key === 'Spacebar') { event.preventDefault(); if (video) commands.toggleIntent(); return; }
    if (event.key === 'm' || event.key === 'M') { setMuted(value => !value); return; }
    if (event.key === 'f' || event.key === 'F') { toggleFullscreen(); return; }
  };

  return <dialog
    ref={dialog}
    className={styles.dialog}
    aria-label="影像查看器"
    onCancel={event => { event.preventDefault(); commands.close(); }}
    onKeyDown={onKeyDown}
    onPointerMove={showControls}
    onTouchStart={showControls}
  >
    <div ref={fullscreenTarget} className={styles.viewport}>
      <header className={styles.header}>
        <button ref={closeButton} type="button" className={styles.iconButton} onClick={commands.close} aria-label="关闭查看器">✕</button>
        <span className={styles.counter} aria-live="polite">{session.index + 1} / {session.media.length}</span>
        <button type="button" className={styles.themeButton} onClick={commands.toggleTheme} aria-label={`切换主题，当前是${themeLabel}`}>◐ <span>{themeLabel}</span></button>
      </header>

      <div className={styles.stage}
        onTouchStart={event => { showControls(); touchStart.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
        onTouchCancel={() => { touchStart.current = null; }}
        onTouchEnd={event => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || event.changedTouches.length !== 1) return;
          const dx = event.changedTouches[0].clientX - start.x;
          const dy = event.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) commands.step(dx < 0 ? 1 : -1);
        }}
      >
        <button type="button" className={`${styles.arrow} ${styles.previous}`} onClick={() => commands.step(-1)} disabled={isFirst} aria-label="上一项">‹</button>
        {video && session.status === 'error'
          ? <div className={styles.statePanel} role="status">
            <p>这段视频暂时无法播放</p>
            <p className={styles.hint}>可以重试，或直接跳到下一项</p>
            <span className={styles.stateActions}>
              <button type="button" className={styles.retry} onClick={() => { setVideoAttempt(n => n + 1); commands.reportStatus('loading'); }}>重新加载</button>
              <button type="button" className={styles.retry} onClick={() => commands.step(1)} disabled={isLast}>下一项</button>
            </span>
          </div>
          : video
            ? <video
              key={`${video.id}-${videoAttempt}`}
              ref={videoRef}
              className={styles.media}
              src={mediaUrl(video.src)}
              poster={video.poster ? mediaUrl(video.poster) : undefined}
              playsInline
              muted={muted}
              preload="metadata"
              aria-label={video.description || '相册视频'}
              onLoadedMetadata={event => commands.reportProgress(0, event.currentTarget.duration)}
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
            : photo && <FullPhoto key={`${photo.id}-${photo.src}`} photo={photo} onRetry={() => closeButton.current?.focus()} />
        }
        <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => commands.step(1)} disabled={isLast} aria-label="下一项">›</button>
      </div>

      <div
        ref={controlsRef}
        className={`${styles.controls} ${controlsVisible ? '' : styles.controlsHidden}`}
        data-visible={controlsVisible}
        aria-hidden={!controlsVisible}
        inert={!controlsVisible}
        onFocus={showControls}
      >
        <div className={styles.controlsRow}>
          {video && <>
            <button type="button" className={styles.iconButton} onClick={commands.toggleIntent} aria-label={session.intent === 'playing' ? '暂停' : '播放'}>{session.intent === 'playing' ? '❙❙' : '▶'}</button>
            <span className={styles.time}>{timeText(session.progress * session.duration)} / {timeText(session.duration)}</span>
            <input
              className={styles.progress}
              type="range"
              min={0}
              max={100}
              value={Math.round(session.progress * 100)}
              aria-label="播放进度"
              onChange={event => {
                const ratio = Number(event.currentTarget.value) / 100;
                const element = videoRef.current;
                if (element && element.duration > 0) element.currentTime = ratio * element.duration;
                commands.reportProgress(ratio, element?.duration ?? session.duration);
              }}
            />
            <button type="button" className={styles.iconButton} onClick={() => setMuted(value => !value)} aria-label={muted ? '取消静音' : '静音'} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
            <button type="button" className={styles.textButton} onClick={commands.toggleContinuous} aria-pressed={session.continuous}>连续播放 {session.continuous ? '开' : '关'}</button>
          </>}
          {!video && <span className={styles.caption}>{photo?.description || '生活里的一个瞬间'}{photo?.date ? ` · ${photo.date.replaceAll('-', '.')}` : ''}</span>}
          <button type="button" className={styles.iconButton} onClick={toggleFullscreen} aria-label="全屏查看">⛶</button>
        </div>
        <p className={styles.hint}>←/→ 切换 · {video ? 'Space 播放暂停 · M 静音 · ' : ''}F 全屏 · Esc 退出</p>
        {notice && <p className={styles.hint} role="status">{notice}</p>}
      </div>
    </div>
  </dialog>;
}
