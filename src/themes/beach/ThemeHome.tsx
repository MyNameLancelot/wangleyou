import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { HomeMemoryPhoto } from '../../content';
import { mediaUrl } from '../../content';
import { PhotoImage } from './PhotoImage';
import { BeachGlass } from './BeachGlass';
import {
  canChangeHomeSection,
  createHomeMemory,
  createHomeMemoryIntervalController,
  getHomeKeyIntent,
  getHomeMemorySwipeIntent,
  getHomeTouchIntent,
  getHomeWheelIntent,
  createHomeMemoryWheelState,
  nextHomeSection,
  reduceHomeMemoryWheel,
  setHomeMemoryPlaying,
  shouldRunHomeMemoryInterval,
  stepHomeMemory,
  type HomeSection,
} from '../../albums';
import { reducedMotion } from './browser';
import styles from './ThemePages.module.css';

const HOME_TRANSITION_LOCK_MS = 600;

const isInteractiveTarget = (target: EventTarget | null) => target instanceof Element
  && Boolean(target.closest('a, button, input, select, textarea, summary, [role="button"], [role="link"], [contenteditable="true"]'));

/** 首页 hero：整幅主题插画 + 左侧内容卡，卡片承载标题与操作。 */
function HomeHero({ heroImage, copy, onStartMemory }: {
  heroImage: string | null;
  copy: { eyebrow: string; title: string; subtitle: string };
  onStartMemory: () => void;
}) {
  return <div className={styles.hero}>
    <div className={styles.heroMedia} style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined} aria-hidden="true" />
    <BeachGlass data-hero-glass><div className={styles.heroCard}>
      <span className={styles.heroEyebrow}>{copy.eyebrow}</span>
      <h1 id="home-title">{copy.title}</h1>
      <p>{copy.subtitle}</p>
      <div className={styles.heroActions}>
        <button type="button" className={styles.primary} onClick={onStartMemory}>开启回忆 <span aria-hidden="true">↓</span></button>
        <a className={styles.secondary} href="#/browse">浏览全部影像 <span aria-hidden="true">→</span></a>
      </div>
    </div></BeachGlass>
  </div>;
}

export function HomePage({ memory, heroImage = null, memoryBackgroundImage, copy, viewerOpen = false }: {
  memory: HomeMemoryPhoto[];
  heroImage?: string | null;
  /** 主题私有第二屏背景，不属于相册内容。 */
  memoryBackgroundImage?: string | null;
  copy: { eyebrow: string; title: string; subtitle: string };
  viewerOpen?: boolean;
}) {
  const [section, setSection] = useState<HomeSection>('hero');
  const [homeMemory, setHomeMemory] = useState(() => createHomeMemory(memory));
  const [memoryHovered, setMemoryHovered] = useState(false);
  const [memoryFocused, setMemoryFocused] = useState(false);
  const [memoryResumeRequired, setMemoryResumeRequired] = useState(false);
  const [memoryInteractionOverride, setMemoryInteractionOverride] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const homeRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const memoryRef = useRef<HTMLElement>(null);
  const wheelDeltaRef = useRef(0);
  const memoryWheelRef = useRef(createHomeMemoryWheelState());
  const transitionLockRef = useRef(false);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const touchStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const memoryTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const memorySwipeClickGuardUntilRef = useRef(0);
  const memoryDragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const memoryIntervalRef = useRef<ReturnType<typeof createHomeMemoryIntervalController<number>> | undefined>(undefined);

  useEffect(() => {
    setHomeMemory(createHomeMemory(memory));
  }, [memory]);

  useEffect(() => () => {
    if (transitionTimerRef.current !== undefined) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const changeMemory = useCallback((direction: -1 | 1) => {
    // 先同步清理旧 interval 再更新状态：restart() 不能等到 React 批处理结束后才执行，
    // 否则旧周期可能在手动换图后的同一帧内立刻再推进一张。
    memoryIntervalRef.current?.restart();
    setHomeMemory(current => stepHomeMemory(current, direction));
  }, []);

  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setDocumentVisible(visible);
      if (!visible && homeMemory.playing) setMemoryResumeRequired(true);
    };
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [homeMemory.playing]);

  useEffect(() => {
    const controller = createHomeMemoryIntervalController({
      setInterval: (callback, delay) => window.setInterval(callback, delay),
      clearInterval: handle => window.clearInterval(handle),
    }, () => setHomeMemory(current => current.playing ? stepHomeMemory(current, 1) : current));
    memoryIntervalRef.current = controller;
    return () => {
      controller.dispose();
      memoryIntervalRef.current = undefined;
    };
  }, []);

  const scrollToSection = useCallback((nextSection: HomeSection) => {
    if (!canChangeHomeSection(section, nextSection, transitionLockRef.current)) {
      // 边界同向滚动或切换锁期间不保留旧累积值，避免解锁后一次小输入立即切屏。
      wheelDeltaRef.current = 0;
      memoryWheelRef.current = createHomeMemoryWheelState();
      return;
    }

    transitionLockRef.current = true;
    wheelDeltaRef.current = 0;
    memoryWheelRef.current = createHomeMemoryWheelState();
    setSection(nextSection);
    (nextSection === 'hero' ? heroRef.current : memoryRef.current)?.scrollIntoView({
      behavior: reducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
    if (transitionTimerRef.current !== undefined) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      transitionLockRef.current = false;
      transitionTimerRef.current = undefined;
    }, HOME_TRANSITION_LOCK_MS);
  }, [section]);

  const moveSection = useCallback((delta: -1 | 1) => {
    scrollToSection(nextHomeSection(section, delta));
  }, [scrollToSection, section]);

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const home = homeRef.current;
      const target = event.target;
      const inScope = target === document.body
        || (target instanceof Node && home?.contains(target))
        || (target instanceof Element && target.closest('[data-music-screen]') !== null);
      if (!home || viewerOpen || !inScope) return;

      event.preventDefault();
      // 触控板横向滚动在第二屏内换图，纵向滚动仍然切换两屏
      if (section === 'memory' && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        const { state: wheelState, direction } = reduceHomeMemoryWheel(memoryWheelRef.current, { deltaX: event.deltaX, at: event.timeStamp });
        memoryWheelRef.current = wheelState;
        if (direction) changeMemory(direction);
        return;
      }
      const intent = getHomeWheelIntent(wheelDeltaRef.current, event.deltaY);
      wheelDeltaRef.current = intent.accumulatedDeltaY;
      if (intent.direction) moveSection(intent.direction);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [changeMemory, moveSection, section, viewerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const home = homeRef.current;
      if (!home || (event.target instanceof Node && event.target !== document.body && !home.contains(event.target))) return;
      const direction = getHomeKeyIntent(event.key, {
        viewerOpen,
        defaultPrevented: event.defaultPrevented,
        interactiveTarget: isInteractiveTarget(event.target),
      });
      if (!direction) return;
      event.preventDefault();
      moveSection(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveSection, viewerOpen]);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || viewerOpen || !homeRef.current?.contains(event.target as Node)) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, target: event.target };
    };
    const onTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch || viewerOpen || !homeRef.current?.contains(start.target as Node)) return;
      const direction = getHomeTouchIntent(start, { x: touch.clientX, y: touch.clientY });
      if (direction) moveSection(direction);
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [moveSection, viewerOpen]);

  const shouldRunMemoryInterval = shouldRunHomeMemoryInterval({
    section,
    playing: homeMemory.playing && !((memoryHovered || memoryFocused) && !memoryInteractionOverride),
    itemCount: homeMemory.items.length,
    documentVisible,
    foregroundResumeRequired: memoryResumeRequired,
    viewerOpen,
  });

  useEffect(() => {
    memoryIntervalRef.current?.sync(shouldRunMemoryInterval);
  }, [shouldRunMemoryInterval]);

  const currentMemory = homeMemory.items[homeMemory.index];
  const previousMemory = () => changeMemory(-1);
  const nextMemory = () => changeMemory(1);
  const resumeMemory = () => {
    // 播放按钮随后会卸载；先移交焦点，让 blur 清除区域焦点暂停。
    setMemoryResumeRequired(false);
    setMemoryInteractionOverride(memoryHovered || memoryFocused);
    homeRef.current?.focus({ preventScroll: true });
    setHomeMemory(current => setHomeMemoryPlaying(current, true));
  };
  const toggleMemoryPlayback = () => {
    if (performance.now() < memorySwipeClickGuardUntilRef.current) return;
    const nextPlaying = !homeMemory.playing;
    setMemoryResumeRequired(false);
    setMemoryInteractionOverride(nextPlaying && (memoryHovered || memoryFocused));
    setHomeMemory(current => setHomeMemoryPlaying(current, nextPlaying));
  };
  const onMemoryTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    memoryTouchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onMemoryTouchEnd = (event: ReactTouchEvent<HTMLElement>) => {
    const start = memoryTouchStartRef.current;
    memoryTouchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || viewerOpen) return;
    const direction = getHomeMemorySwipeIntent(start, { x: touch.clientX, y: touch.clientY });
    if (!direction) return;
    memorySwipeClickGuardUntilRef.current = performance.now() + 400;
    changeMemory(direction);
  };
  /**
   * 桌面端按住鼠标左右拖动等同触屏滑动；触屏交给上面的 touch 处理器。
   * 只有位移达到换图阈值才接管指针，因此普通点击（含触摸板点按时的轻微移动）仍按点击处理。
   */
  const onMemoryPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch' || viewerOpen) return;
    memoryDragRef.current = { x: event.clientX, y: event.clientY, dragging: false };
  };
  const onMemoryPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = memoryDragRef.current;
    if (!drag || drag.dragging || event.pointerType === 'touch') return;
    const direction = getHomeMemorySwipeIntent(drag, { x: event.clientX, y: event.clientY });
    if (!direction) return;
    drag.dragging = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    changeMemory(direction);
  };
  const onMemoryPointerUp = () => { memoryDragRef.current = null; };

  return <div ref={homeRef} className={styles.home} tabIndex={-1}>
    {/* 跨屏淡入层：在交界带内让第二屏背景渐显，消除两张沙地图之间的色调与纹理硬接缝。 */}
    {memoryBackgroundImage && <div className={styles.homeSeam} data-home-seam aria-hidden="true" style={{ backgroundImage: `url(${memoryBackgroundImage})` }} />}
    <section ref={heroRef} className={styles.homeSection} data-home-section="hero" aria-labelledby="home-title">
      <HomeHero
        heroImage={heroImage}
        copy={copy}
        onStartMemory={() => scrollToSection('memory')}
      />
    </section>
    <section
      ref={memoryRef}
      className={styles.homeSection}
      data-home-section="memory"
      aria-label="主回忆"
      style={memoryBackgroundImage ? { backgroundImage: `url(${memoryBackgroundImage})` } : undefined}
      onTouchStart={onMemoryTouchStart}
      onTouchEnd={onMemoryTouchEnd}
      onPointerDown={onMemoryPointerDown}
      onPointerMove={onMemoryPointerMove}
      onPointerUp={onMemoryPointerUp}
      onPointerCancel={() => { memoryDragRef.current = null; }}
    >
      <div className={styles.homeMemory}>
        {currentMemory
          ? <div
            className={styles.homeMemoryPlayer}
            onMouseEnter={() => {
              setMemoryHovered(true);
              setMemoryInteractionOverride(false);
            }}
            onMouseLeave={() => {
              setMemoryHovered(false);
              setMemoryInteractionOverride(false);
            }}
            onFocus={() => setMemoryFocused(true)}
            onBlur={event => {
              if (event.currentTarget.contains(event.relatedTarget)) return;
              setMemoryFocused(false);
              // resumeMemory 会把焦点移到 homeRef，这是显式恢复的一部分，不能清空悬停覆盖。
              if (event.relatedTarget === homeRef.current) return;
              setMemoryInteractionOverride(false);
            }}
          >
            <div className={styles.memoryFrame}>
              <div className={styles.memoryGlassBox}>
                <button type="button" className={`${styles.memoryArrow} ${styles.memoryArrowPrev}`} onClick={previousMemory} aria-label="上一张照片">
                  <ChevronLeft aria-hidden="true" />
                </button>
                <BeachGlass data-memory-mat><div className={styles.memoryMat}>
                  <button type="button" className={styles.homeMemoryPhoto} onClick={toggleMemoryPlayback} aria-label={`${homeMemory.playing ? '暂停主回忆自动播放' : '继续主回忆自动播放'}：${currentMemory.description || currentMemory.id}`}>
                    <PhotoImage className={styles.memoryImage} src={mediaUrl(currentMemory.src)} alt={currentMemory.alt || currentMemory.description || '主回忆照片'} eager draggable={false} />
                  </button>
                </div></BeachGlass>
                <button type="button" className={`${styles.memoryArrow} ${styles.memoryArrowNext}`} onClick={nextMemory} aria-label="下一张照片">
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
              <div className={styles.memoryPlaySlot}>
                {!homeMemory.playing && <button type="button" className={styles.memoryPlay} onClick={resumeMemory} aria-label="继续播放主回忆"><Play aria-hidden="true" /></button>}
              </div>
              <progress className={styles.homeMemoryProgress} value={homeMemory.index + 1} max={homeMemory.items.length} aria-label="主回忆进度" />
            </div>
          </div>
          : <div className={styles.empty}><h3>主回忆还在准备中</h3><p>添加照片后，这里会自动挑选最新的回忆。</p><a className={styles.primary} href="#/albums">查看相册</a></div>}
      </div>
    </section>
  </div>;
}
