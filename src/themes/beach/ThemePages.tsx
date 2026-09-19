import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Album, Media, SiteContent, Video } from '../../content';
import { assetUrl } from '../../content';
import { PhotoImage } from './PhotoImage';
import { BeachGlass } from './BeachGlass';
import {
  canChangeHomeSection,
  createHomeMemory,
  createHomeMemoryIntervalController,
  getHomeKeyIntent,
  getHomeTouchIntent,
  getHomeWheelIntent,
  nextHomeSection,
  shouldRunHomeMemoryInterval,
  stepHomeMemory,
  type HomeSection,
} from '../../albums';
import styles from './ThemePages.module.css';

export type OpenMedia = (album: Album, id: string) => void;
type Filter = 'all' | 'photo' | 'video';
type TileVariant = 'wide' | 'tall';

const dateText = (date?: string) => (date ? date.replaceAll('-', '.') : '待续');
const yearOf = (date?: string) => (date && /^\d{4}/.test(date) ? date.slice(0, 4) : '未标注日期');
const isVideo = (media: Media): media is Video => media.type === 'video';
const durationText = (seconds?: number) => (seconds && seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '');
const thumbnailOf = (media: Media) => media.thumbnail || (isVideo(media) ? media.poster : undefined) || (media.type === 'photo' ? media.src : undefined);
const mediaLabel = (media: Media) => (isVideo(media) ? `播放视频：${media.description || media.id}` : `查看照片：${media.description || media.id}`);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const HOME_TRANSITION_LOCK_MS = 600;

const isInteractiveTarget = (target: EventTarget | null) => target instanceof Element
  && Boolean(target.closest('a, button, input, select, textarea, summary, [role="button"], [role="link"], [contenteditable="true"]'));

/** 图片与视频共用的缩略图：说明条压在卡片底部，视频带类型标识，演示内容统一标注。 */
function MediaTile({ media, onOpen, album, variant = 'wide', eager }: { media: Media; album: Album; onOpen: OpenMedia; variant?: TileVariant; eager?: boolean }) {
  const source = thumbnailOf(media);
  return <button type="button" className={`${styles.mediaTile} ${variant === 'tall' ? styles.mediaTileTall : ''}`} onClick={() => onOpen(album, media.id)} aria-label={mediaLabel(media)}>
    <span className={styles.mediaThumb}>
      {source ? <PhotoImage src={assetUrl(source)} alt={media.alt || media.description || '相册影像'} eager={eager} /> : <span className={styles.emptyCover}><span aria-hidden="true">＋</span><p>等待新的影像</p></span>}
      <span className={styles.demoTag}>演示素材</span>
      {isVideo(media) && <span className={styles.videoBadge}><span aria-hidden="true">▶</span>{durationText(media.duration) && <small>{durationText(media.duration)}</small>}</span>}
      <span className={styles.mediaBar}>{media.description || '生活里的一个瞬间'}</span>
    </span>
  </button>;
}

function AlbumCard({ album }: { album: Album }) {
  const cover = album.cover || album.media.map(thumbnailOf).find(Boolean);
  return <a className={styles.albumCard} href={`#/albums/${album.id}`} aria-label={`查看相册：${album.title}`}>
    <div className={styles.cover}>
      {cover ? <PhotoImage src={assetUrl(cover)} alt={album.title} /> : <div className={styles.emptyCover}><span aria-hidden="true">＋</span><p>留给下一段故事</p></div>}
      <span className={styles.count}>{album.media.length ? `${album.media.length} 个瞬间` : '等待新故事'}</span>
    </div>
    <div className={styles.cardInfo}><span className={styles.date}>{dateText(album.date)}</span><h3>{album.title}<span aria-hidden="true">↗</span></h3><p>{album.description}</p></div>
  </a>;
}

/** 首页 hero：整幅主题插画 + 左侧内容卡，卡片承载标题与操作。 */
function HomeHero({ heroImage, copy, resumeLabel, onResume, onStartMemory }: {
  heroImage: string | null;
  copy: { eyebrow: string; title: string; subtitle: string };
  resumeLabel?: string;
  onResume?: () => void;
  onStartMemory: () => void;
}) {
  return <div className={styles.hero}>
    <div className={styles.heroMedia} style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined} aria-hidden="true" />
    <BeachGlass><div className={styles.heroCard}>
      <span className={styles.heroEyebrow}>{copy.eyebrow}</span>
      <h1 id="home-title">{copy.title}</h1>
      <p>{copy.subtitle}</p>
      <div className={styles.heroActions}>
        <button type="button" className={styles.primary} onClick={onStartMemory}>开启回忆 <span aria-hidden="true">↓</span></button>
        <a className={styles.secondary} href="#/browse">浏览全部影像 <span aria-hidden="true">→</span></a>
        {onResume && resumeLabel && <button type="button" className={styles.secondary} onClick={onResume}>继续播放 <span aria-hidden="true">▶</span></button>}
      </div>
    </div></BeachGlass>
  </div>;
}

export function HomePage({ data, onOpen, resume, onResume, heroImage = null, copy, viewerOpen = false }: {
  data: SiteContent;
  onOpen: OpenMedia;
  resume?: { album: Album; media: Media } | null;
  onResume?: () => void;
  heroImage?: string | null;
  copy: { eyebrow: string; title: string; subtitle: string };
  viewerOpen?: boolean;
}) {
  const [section, setSection] = useState<HomeSection>('hero');
  const [homeMemory, setHomeMemory] = useState(() => createHomeMemory(data.albums));
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const homeRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const memoryRef = useRef<HTMLElement>(null);
  const wheelDeltaRef = useRef(0);
  const transitionLockRef = useRef(false);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const touchStartRef = useRef<{ x: number; y: number; target: EventTarget | null } | null>(null);
  const memoryIntervalRef = useRef<ReturnType<typeof createHomeMemoryIntervalController<number>> | undefined>(undefined);

  useEffect(() => {
    setHomeMemory(createHomeMemory(data.albums));
  }, [data.albums]);

  useEffect(() => () => {
    if (transitionTimerRef.current !== undefined) window.clearTimeout(transitionTimerRef.current);
  }, []);

  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

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
    if (!canChangeHomeSection(section, nextSection, transitionLockRef.current)) return;

    transitionLockRef.current = true;
    wheelDeltaRef.current = 0;
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
      if (!home || viewerOpen || (event.target instanceof Node && event.target !== document.body && !home.contains(event.target))) return;

      event.preventDefault();
      const intent = getHomeWheelIntent(wheelDeltaRef.current, event.deltaY);
      wheelDeltaRef.current = intent.accumulatedDeltaY;
      if (intent.direction) moveSection(intent.direction);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [moveSection, viewerOpen]);

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
    playing: homeMemory.playing,
    itemCount: homeMemory.items.length,
    documentVisible,
    viewerOpen,
  });

  useEffect(() => {
    memoryIntervalRef.current?.sync(shouldRunMemoryInterval);
  }, [shouldRunMemoryInterval]);

  const currentMemory = homeMemory.items[homeMemory.index];
  const previousMemory = () => setHomeMemory(current => stepHomeMemory(current, -1));
  const nextMemory = () => setHomeMemory(current => stepHomeMemory(current, 1));
  const toggleMemory = () => setHomeMemory(current => ({ ...current, playing: !current.playing }));

  return <div ref={homeRef} className={styles.home} tabIndex={-1}>
    <section ref={heroRef} className={styles.homeSection} data-home-section="hero" aria-labelledby="home-title">
      <HomeHero
        heroImage={heroImage}
        copy={copy}
        resumeLabel={resume?.media.description || resume?.album.title}
        onResume={resume && onResume ? onResume : undefined}
        onStartMemory={() => scrollToSection('memory')}
      />
    </section>
    <section ref={memoryRef} className={styles.homeSection} data-home-section="memory" aria-labelledby="home-memory-title">
      <div className={styles.homeMemory}>
        <div className={styles.sectionHeader}>
          <div><span className={styles.eyebrow}>HOME MEMORY</span><h2 id="home-memory-title">主回忆</h2></div>
          {currentMemory && <p className={styles.homeMemoryCount} aria-live="polite">第 {homeMemory.index + 1} / {homeMemory.items.length} 张</p>}
        </div>
        {currentMemory
          ? <div className={styles.homeMemoryPlayer}>
            <button type="button" className={styles.homeMemoryPhoto} onClick={() => onOpen(currentMemory.album, currentMemory.media.id)} aria-label={`查看当前照片：${currentMemory.media.description || currentMemory.media.id}`}>
              <PhotoImage src={assetUrl(currentMemory.media.thumbnail || currentMemory.media.src)} alt={currentMemory.media.alt || currentMemory.album.title || currentMemory.media.description || '主回忆照片'} eager />
            </button>
            <div className={styles.homeMemoryControls} aria-label="主回忆操作">
              <button type="button" className={styles.secondary} onClick={previousMemory} aria-label="上一张照片">上一张</button>
              <button type="button" className={styles.secondary} onClick={toggleMemory} aria-label={homeMemory.playing ? '暂停主回忆' : '继续播放主回忆'}>{homeMemory.playing ? '暂停' : '继续播放'}</button>
              <button type="button" className={styles.secondary} onClick={nextMemory} aria-label="下一张照片">下一张</button>
              <button type="button" className={styles.primary} onClick={() => onOpen(currentMemory.album, currentMemory.media.id)}>查看当前照片</button>
              <a className={styles.sectionLink} href={`#/albums/${currentMemory.album.id}`}>查看相册：{currentMemory.album.title}</a>
            </div>
            <progress className={styles.homeMemoryProgress} value={homeMemory.index + 1} max={homeMemory.items.length}>第 {homeMemory.index + 1} / {homeMemory.items.length} 张</progress>
          </div>
          : <div className={styles.empty}><h3>主回忆还在准备中</h3><p>添加照片后，这里会自动挑选最新的回忆。</p><a className={styles.primary} href="#/albums">查看相册</a></div>}
      </div>
    </section>
  </div>;
}

export function BrowsePage({ data, onOpen, heroImage = null }: { data: SiteContent; onOpen: OpenMedia; heroImage?: string | null }) {
  const [filter, setFilter] = useState<Filter>('all');
  const items = useMemo(() => data.albums.flatMap(album => album.media.map(media => ({ album, media }))), [data]);
  const counts: Record<Filter, number> = {
    all: items.length,
    photo: items.filter(item => item.media.type === 'photo').length,
    video: items.filter(item => isVideo(item.media)).length,
  };
  const visible = items.filter(item => filter === 'all' || item.media.type === filter);
  const years = [...new Set(visible.map(item => yearOf(item.media.date)))].sort((a, b) => b.localeCompare(a));
  const goToYear = (year: string) => document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  return <section className={styles.browse} aria-labelledby="browse-title">
    <div className={styles.browseHero}>
      <div className={styles.browseHeroMedia} style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined} aria-hidden="true" />
      <div className={styles.browseHeroCopy}>
        <h1 id="browse-title">全部影像</h1>
        <p>沿着时间，慢慢翻看。</p>
      </div>
      <div className={styles.filterPill} role="group" aria-label="按类型筛选">
        {([['all', '全部'], ['photo', '照片'], ['video', '视频']] as const).map(([key, label]) => <button key={key} type="button" className={styles.filterTab} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} {counts[key]}</button>)}
      </div>
    </div>
    <div className={styles.browseBody}>
      <aside className={styles.rail} aria-label="按时间定位">
        <div className={styles.railCard}>
          <h2>按时间定位</h2>
          <ul className={styles.railList}>{years.map(year => <li key={year}><button type="button" className={styles.railYear} onClick={() => goToYear(year)}>{year} · {visible.filter(item => yearOf(item.media.date) === year).length} 项</button></li>)}</ul>
          <h3>相册</h3>
          <ul className={styles.railList}>{data.albums.map(album => <li key={album.id}><a className={styles.railAlbum} href={`#/albums/${album.id}`}>{album.title}</a></li>)}</ul>
        </div>
      </aside>
      <div className={styles.browseMain}>
        <nav className={styles.yearNav} aria-label="年份定位">
          <span className={styles.yearNavLabel}>年份</span>
          {years.map(year => <button key={year} type="button" className={styles.yearChip} onClick={() => goToYear(year)}>{year}</button>)}
        </nav>
        {visible.length === 0
          ? <div className={styles.empty}><span aria-hidden="true">☀</span><h2>这里还没有影像</h2><p>换一个筛选条件，或回到首页看看相册。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>
          : years.map(year => <section key={year} id={`year-${year}`} className={styles.yearGroup} aria-labelledby={`year-title-${year}`}>
            <div className={styles.yearHeader}><h2 id={`year-title-${year}`}>{year} 年</h2><span className={styles.sectionNote}>最新优先</span></div>
            <div className={styles.browseGrid}>{visible.filter(item => yearOf(item.media.date) === year).map(({ album, media }, i) => <MediaTile key={`${album.id}-${media.id}`} album={album} media={media} onOpen={onOpen} eager={i < 3} />)}</div>
          </section>)}
        <p className={styles.browseHint}>键盘可用方向键在网格中移动焦点；滚动时年份导航保持可见。</p>
      </div>
    </div>
  </section>;
}

export function AlbumsPage({ data }: { data: SiteContent }) {
  return <section className={styles.browse} aria-labelledby="albums-index-title">
    <header className={styles.pageHeader}>
      <h1 id="albums-index-title">相册</h1>
      <p>按时间收藏的每一段日子，点开就能继续翻看。</p>
    </header>
    {data.albums.length
      ? <div className={`${styles.albumGrid} ${styles.albumGridSpaced}`}>{data.albums.map(album => <AlbumCard key={album.id} album={album} />)}</div>
      : <div className={styles.empty}><h2>相册还在准备中</h2><p>新的故事会在这里出现。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>}
  </section>;
}

export function AlbumPage({ album, albums, onOpen }: { album: Album; albums: Album[]; onOpen: OpenMedia }) {
  const index = albums.findIndex(item => item.id === album.id);
  const next = index >= 0 && index < albums.length - 1 ? albums[index + 1] : undefined;
  const first = album.media[0];
  const dates = album.media.map(item => item.date).filter((value): value is string => Boolean(value)).sort();
  const range = dates.length > 1 && dates[0] !== dates[dates.length - 1] ? `${dateText(dates[0])} — ${dateText(dates[dates.length - 1])}` : dateText(dates[0] ?? album.date);
  return <section className={styles.detail} aria-labelledby="album-title">
    <nav className={styles.breadcrumb} aria-label="面包屑"><a href="#/">首页</a><span aria-hidden="true">/</span><a href="#/browse">全部影像</a><span aria-hidden="true">/</span><span aria-current="page">{album.title}</span></nav>
    <header className={styles.detailHeader}>
      <div>
        <h1 id="album-title">{album.title}</h1>
        <p className={styles.detailMeta}>{range} · {album.media.length} 项影像 · 演示相册</p>
        {album.description && <p className={styles.detailDescription}>{album.description}</p>}
      </div>
      {first && <button type="button" className={styles.primary} onClick={() => onOpen(album, first.id)}><span aria-hidden="true">▶</span> 从这里播放</button>}
    </header>
    {album.media.length
      ? <div className={styles.photoGrid} data-testid="album-media-grid">{album.media.map((media, i) => <MediaTile key={media.id} album={album} media={media} onOpen={onOpen} variant="tall" eager={i < 3} />)}</div>
      : <div className={styles.empty}><span aria-hidden="true">☀</span><h2>下一段故事，还在路上</h2><p>这个相册暂时没有影像，先去看看其他回忆吧。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>}
    {next && next.media.length > 0 && <section className={styles.upNext} aria-labelledby="upnext-title">
      <div className={styles.sectionHeader}>
        <h2 id="upnext-title">接下来的影像</h2>
        <a className={styles.sectionLink} href={`#/albums/${next.id}`} aria-label={`下一本相册：${next.title}`}>下一本相册 <span aria-hidden="true">→</span></a>
      </div>
      <div className={styles.upNextGrid}>{next.media.slice(0, 4).map(media => <MediaTile key={`${next.id}-${media.id}`} album={next} media={media} onOpen={onOpen} />)}</div>
    </section>}
  </section>;
}
