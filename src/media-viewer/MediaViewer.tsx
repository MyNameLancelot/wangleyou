import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../content';
import type { Photo } from '../content';
import type { Session } from '../playback';
import styles from './MediaViewer.module.css';

function FullPhoto({ photo }: { photo: Photo }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  return <div className={styles.photoArea} aria-busy={status === 'loading'}>
    {status === 'loading' && <p className={styles.status} role="status">正在打开这一刻…</p>}
    {status === 'error' ? <div className={styles.status} role="status"><p>这张照片暂时无法加载</p><button className={styles.retry} onClick={event => { event.currentTarget.closest('dialog')?.querySelector<HTMLButtonElement>('button[aria-label="关闭照片查看器"]')?.focus(); setAttempt(n => n + 1); setStatus('loading'); }}>重新加载</button><p className={styles.hint}>也可以切换照片或关闭查看器</p></div> : <img key={attempt} className={styles.fullPhoto} src={assetUrl(photo.src)} alt={photo.alt || photo.description || '相册照片'} onLoad={() => setStatus('ready')} onError={() => setStatus('error')} style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }} />}
  </div>;
}
export function MediaViewer({ session, onStep, onClose }: { session: NonNullable<Session>; onStep: (delta: number) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fullscreenTarget = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const touchStart = useRef<{x:number;y:number} | null>(null);
  const [fullscreenNotice, setFullscreenNotice] = useState('');
  const photo = session.photos[session.index];
  useEffect(() => {
    mounted.current = true;
    const element = dialog.current!;
    const fullscreenElement = fullscreenTarget.current;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element.showModal();
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      mounted.current = false;
      if (document.fullscreenElement === fullscreenElement) void document.exitFullscreen().catch(() => {});
      element.close();
      document.body.style.overflow = overflow;
      if (focused?.isConnected) focused.focus();
      else document.querySelector<HTMLElement>('main')?.focus();
    };
  }, []);
  useEffect(() => {
    const next = session.photos[session.index + 1];
    if (!next) return;
    const image = new Image(); image.src = assetUrl(next.src);
    return () => { image.src = ''; };
  }, [session]);
  useEffect(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !dialog.current?.contains(active) || (active instanceof HTMLButtonElement && active.disabled)) closeButton.current?.focus();
  }, [session.index]);
  return <dialog ref={dialog} className={styles.dialog} aria-label="照片查看器" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
    if (event.key === 'Tab') {
      const buttons = Array.from(dialog.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); onStep(event.key === 'ArrowRight' ? 1 : -1); }
  }}>
    <div ref={fullscreenTarget} className={styles.viewport}>
    <header className={styles.header}><span className={styles.label}>收藏的这一刻</span><span className={styles.counter} aria-live="polite">{session.index + 1} / {session.photos.length}</span><div className={styles.actions}>{document.fullscreenEnabled && <button aria-label="全屏查看" onClick={() => {
      const target = fullscreenTarget.current;
      if (!target) return;
      const request = document.fullscreenElement === target ? document.exitFullscreen() : target.requestFullscreen();
      void request.then(() => {
        if (!mounted.current && document.fullscreenElement === target) return document.exitFullscreen();
      }).catch(() => {
        if (mounted.current) setFullscreenNotice('全屏暂不可用，仍可在此查看照片');
      });
    }}>⛶</button>}<button ref={closeButton} onClick={onClose} aria-label="关闭照片查看器">×</button></div></header>
    <div className={styles.stage} onTouchStart={event => { if(event.touches.length === 1) touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; else touchStart.current=null; }} onTouchCancel={() => {touchStart.current=null;}} onTouchEnd={event => {
      const start=touchStart.current; touchStart.current=null;
      if(!start || event.changedTouches.length !== 1) return;
      const dx=event.changedTouches[0].clientX-start.x, dy=event.changedTouches[0].clientY-start.y;
      if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.5) onStep(dx<0?1:-1);
    }}>
      <button className={`${styles.arrow} ${styles.previous}`} onClick={() => onStep(-1)} disabled={session.index === 0} aria-label="上一张">←</button>
      <FullPhoto key={`${photo.id}-${photo.src}`} photo={photo} />
      <button className={`${styles.arrow} ${styles.next}`} onClick={() => onStep(1)} disabled={session.index === session.photos.length - 1} aria-label="下一张">→</button>
    </div>
    <footer className={styles.footer}><h2>{photo.description || '生活里的一个瞬间'}</h2><p>{photo.date?.replaceAll('-', '.')}</p><span className={styles.hint}>左右切换 · Esc 关闭</span>{fullscreenNotice && <p role="status">{fullscreenNotice}</p>}</footer>
    </div>
  </dialog>;
}
