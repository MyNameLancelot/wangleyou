import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { HomeMemoryPhoto } from '../../content';
import { mediaUrl } from '../../content';
import {
  createHomeMemory,
  createHomeMemoryIntervalController,
  getHomeMemorySwipeIntent,
  setHomeMemoryPlaying,
  shouldRunHomeMemoryInterval,
  stepHomeMemory,
} from '../../albums';
import { PhotoImage } from './PhotoImage';
import { EndingContent, PhotoTransition } from './PhotoTransition';
import { homePhotoSizes, responsiveSrcSet } from './images';
import styles from './ThemeHome.module.css';

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 首页只持有主回忆的展示状态；查看器会话和背景音乐仍由 App/playback 持有。 */
export function HomePage({ memory, viewerOpen = false }: { memory: HomeMemoryPhoto[]; viewerOpen?: boolean }) {
  const [state, setState] = useState(() => createHomeMemory(memory));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [interactionOverride, setInteractionOverride] = useState(false);
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden');
  const [resumeRequired, setResumeRequired] = useState(() => document.visibilityState === 'hidden' && memory.length > 0);
  const [flip, setFlip] = useState<{ src: string | null; direction: -1 | 1 } | null>(null);
  const stateRef = useRef(state);
  const flipLockedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof createHomeMemoryIntervalController<number>> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const photoContentRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => {
    flipLockedRef.current = false;
    setFlip(null);
    setState(createHomeMemory(memory));
  }, [memory]);

  const step = useCallback((direction: -1 | 1) => {
    const current = stateRef.current;
    if (current.items.length === 0 || flipLockedRef.current) return;
    const next = stepHomeMemory(current, direction, false);
    if (next.index === current.index) return;
    intervalRef.current?.sync(false);
    const image = photoContentRef.current?.querySelector('img');
    const selected = image?.naturalWidth ? image.currentSrc : null;
    stateRef.current = next;
    setState(next);
    if (!reducedMotion() && (selected || current.index === current.items.length)) {
      flipLockedRef.current = true;
      setFlip({ src: selected, direction });
    } else {
      setFlip(null);
    }
  }, []);

  useEffect(() => {
    const controller = createHomeMemoryIntervalController<number>({
      setInterval: (callback, delay) => window.setInterval(callback, delay),
      clearInterval: handle => window.clearInterval(handle),
    }, () => step(1));
    intervalRef.current = controller;
    return () => {
      controller.dispose();
      intervalRef.current = null;
      flipLockedRef.current = false;
    };
  }, [step]);

  useEffect(() => {
    const onVisibility = () => {
      const nextVisible = document.visibilityState !== 'hidden';
      if (!nextVisible && stateRef.current.playing) setResumeRequired(true);
      setVisible(nextVisible);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    intervalRef.current?.sync(shouldRunHomeMemoryInterval({
      section: 'memory',
      playing: state.playing && !flip && (!(hovered || focused) || interactionOverride),
      itemCount: state.items.length + 1 - state.index,
      documentVisible: visible,
      foregroundResumeRequired: resumeRequired,
      viewerOpen,
    }));
  }, [state.playing, state.items.length, state.index, flip, hovered, focused, interactionOverride, visible, resumeRequired, viewerOpen]);

  const toggle = () => {
    if (performance.now() < suppressClickUntilRef.current || flipLockedRef.current) return;
    if (state.index === state.items.length) return;
    const playing = resumeRequired ? true : !state.playing;
    setResumeRequired(false);
    setInteractionOverride(playing && (hovered || focused));
    setState(previous => setHomeMemoryPlaying(previous, playing));
  };
  const swipe = (start: { x: number; y: number } | null, end: { x: number; y: number }) => {
    if (!start) return;
    const direction = getHomeMemorySwipeIntent(start, end);
    if (!direction) return;
    suppressClickUntilRef.current = performance.now() + 400;
    step(direction);
  };
  const onTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.changedTouches[0];
    if (touch) swipe(touchStartRef.current, { x: touch.clientX, y: touch.clientY });
    touchStartRef.current = null;
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' && event.button === 0) pointerStartRef.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch') swipe(pointerStartRef.current, { x: event.clientX, y: event.clientY });
    pointerStartRef.current = null;
  };

  const current = state.items[state.index];
  const ending = state.items.length > 0 && state.index === state.items.length;
  const rightPageCount = state.items.length + 1 - state.index;
  const playing = state.playing && !resumeRequired;
  const transition = flip && <PhotoTransition src={flip.src} direction={flip.direction} targetRef={photoContentRef} onComplete={() => {
    setFlip(null);
    flipLockedRef.current = false;
  }} />;
  return <section className={styles.home} aria-labelledby="home-title" data-testid="book-home">
    <div className={styles.book}>
      <div className={styles.stitches} aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <i key={index} />)}</div>
      <div className={styles.heading}>
        <div><h1 id="home-title" aria-label="把日子，一页页翻开"><span>把日子，</span><span>一页页翻开</span></h1><p>那些珍贵的时光，慢慢再看一遍</p></div>
        <a href="#/browse" className={styles.browse}>浏览全部影像 <span aria-hidden="true">↗</span></a>
      </div>
      {current || ending ? <div className={styles.memory} onMouseEnter={() => { setHovered(true); setInteractionOverride(false); }} onMouseLeave={() => { setHovered(false); setInteractionOverride(false); }} onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); setInteractionOverride(false); } }}>
        <div className={styles.stack} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touchStartRef.current = null; }} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { pointerStartRef.current = null; }}>
          {Array.from({ length: rightPageCount - 1 }, (_, index) => {
            const depth = rightPageCount - 1 - index;
            return <div key={depth} className={`${styles.sheet} ${styles.sheetUnder}`} style={{ '--depth': depth } as CSSProperties} aria-hidden="true" data-book-page="under" />;
          })}
          {current ? <button type="button" className={`${styles.sheet} ${styles.sheetFront}`} onClick={toggle} aria-label={`${playing ? '暂停' : '继续'}主回忆自动播放：${current.description || current.id}`} data-testid="home-memory-photo" data-book-page="front">
            <span className={styles.photoViewport}>
              <span ref={photoContentRef} className={styles.photoContent}><PhotoImage className={styles.photo} src={mediaUrl(current.src)} srcSet={responsiveSrcSet(current)} sizes={homePhotoSizes} alt={current.alt || current.description || '主回忆照片'} eager draggable={false} /></span>
            </span>
          </button> : <div className={`${styles.sheet} ${styles.sheetFront}`} data-testid="home-memory-ending" data-book-page="front"><span className={styles.photoViewport}><span ref={photoContentRef} className={`${styles.photoContent} ${styles.ending}`}><EndingContent /></span></span></div>}
          {transition}
        </div>
        <div className={styles.controls}>
          <button type="button" onClick={() => step(-1)} disabled={state.index === 0} aria-label="上一张照片"><ChevronLeft aria-hidden="true" />上一页</button>
          <button type="button" onClick={toggle} disabled={ending} aria-label={ending ? '主回忆播放已结束' : playing ? '暂停主回忆自动播放' : '继续主回忆自动播放'}>{playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{ending ? '已读完' : playing ? '暂停' : '播放'}</button>
          <button type="button" onClick={() => step(1)} disabled={ending} aria-label="下一张照片">下一页<ChevronRight aria-hidden="true" /></button>
        </div>
      </div> : <div className={styles.empty}><h2>回忆还在准备中</h2><p>添加主回忆照片后，就能从这里翻阅</p></div>}
      <a href="#/browse" className={styles.browseMobile}>浏览全部影像 <span aria-hidden="true">↗</span></a>
    </div>
  </section>;
}
