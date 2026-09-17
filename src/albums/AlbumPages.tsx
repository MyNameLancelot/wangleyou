import { useMemo, useState } from 'react';
import type { Album, Media, SiteContent, Video } from '../content';
import { assetUrl } from '../content';
import { PhotoImage } from '../shared';
import styles from './AlbumPages.module.css';

export type OpenMedia = (album: Album, id: string) => void;
type Filter = 'all' | 'photo' | 'video';

const dateText = (date?: string) => (date ? date.replaceAll('-', '.') : '待续');
const yearOf = (date?: string) => (date && /^\d{4}/.test(date) ? date.slice(0, 4) : '未标注日期');
const isVideo = (media: Media): media is Video => media.type === 'video';
const durationText = (seconds?: number) => (seconds && seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '');
const thumbnailOf = (media: Media) => media.thumbnail || (isVideo(media) ? media.poster : undefined) || (media.type === 'photo' ? media.src : undefined);
const mediaLabel = (media: Media) => (isVideo(media) ? `播放视频：${media.description || media.id}` : `查看照片：${media.description || media.id}`);
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 图片与视频共用的缩略图：视频带类型标识与时长，演示内容统一标注。 */
function MediaTile({ media, onOpen, album, eager }: { media: Media; album: Album; onOpen: OpenMedia; eager?: boolean }) {
  const source = thumbnailOf(media);
  return <button type="button" className={styles.mediaTile} onClick={() => onOpen(album, media.id)} aria-label={mediaLabel(media)}>
    <span className={styles.mediaThumb}>
      {source ? <PhotoImage src={assetUrl(source)} alt={media.alt || media.description || '相册影像'} eager={eager} /> : <span className={styles.emptyCover}><span aria-hidden="true">＋</span><p>等待新的影像</p></span>}
      <span className={styles.demoTag}>演示素材</span>
      {isVideo(media) && <span className={styles.videoBadge}><span aria-hidden="true">▶</span> 视频{durationText(media.duration) && <small>{durationText(media.duration)}</small>}</span>}
    </span>
    <span className={styles.mediaCaption}>{media.description || '生活里的一个瞬间'}<small>{dateText(media.date)}</small></span>
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

export function HomePage({ data, onOpen, resume, onResume }: { data: SiteContent; onOpen: OpenMedia; resume?: { album: Album; media: Media } | null; onResume?: () => void }) {
  const items = useMemo(() => data.albums.flatMap(album => album.media.map(media => ({ album, media }))), [data]);
  const featured = items.slice(0, 3);
  const recent = useMemo(() => [...items].sort((a, b) => (b.media.date || '').localeCompare(a.media.date || '')).slice(0, 4), [items]);
  const videoCount = items.filter(item => isVideo(item.media)).length;
  return <>
    <section className={styles.intro} aria-labelledby="home-title">
      <div className={styles.introCopy}>
        <span className={styles.eyebrow}><span className={styles.sun} aria-hidden="true">☀</span> 我们的小小成长记录</span>
        <h1 id="home-title">把日子过成<br />值得收藏的<span>回忆。</span></h1>
        <p>{data.site.subtitle}<br />每个不起眼的瞬间，都是长大的模样。</p>
        <div className={styles.introActions}>
          <a className={styles.primary} href="#/browse">翻开全部影像 <span aria-hidden="true">↗</span></a>
          {resume && onResume && <button type="button" className={styles.secondary} onClick={onResume}>继续浏览：{resume.media.description || resume.album.title}</button>}
        </div>
        <div className={styles.introMeta}><span>{data.albums.length} 本相册</span><span>{items.length} 个影像</span><span>{videoCount ? `${videoCount} 段视频` : '照片与视频'}</span></div>
      </div>
      {featured.length > 0 && <div className={styles.memoryStrip} aria-label="精选回忆">
        {featured.map(({ album, media }, i) => <button type="button" key={`${album.id}-${media.id}`} className={`${styles.memory} ${styles[`memory${i}`]}`} onClick={() => onOpen(album, media.id)} aria-label={mediaLabel(media)}>
          {thumbnailOf(media) ? <PhotoImage src={assetUrl(thumbnailOf(media)!)} alt={media.alt || media.description || '精选回忆'} eager /> : <span className={styles.emptyCover}><p>精选回忆</p></span>}
          <span className={styles.memoryCaption}>{media.description || '小小的瞬间'}<small>{dateText(media.date)}</small></span>
        </button>)}
        <span className={styles.memoryNote}>一些小事，一整个夏天。</span>
      </div>}
    </section>
    <section className={styles.albumsSection} id="albums" aria-labelledby="albums-title">
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>OUR ALBUMS</span><h2 id="albums-title">一页一页，都是我们</h2></div><a className={styles.sectionLink} href="#/browse">浏览全部影像 →</a></div>
      {data.albums.length ? <div className={styles.albumGrid}>{data.albums.map(album => <AlbumCard key={album.id} album={album} />)}</div> : <div className={styles.empty}><h3>相册还在准备中</h3><p>新的故事会在这里出现。</p></div>}
    </section>
    {recent.length > 0 && <section className={styles.recent} aria-labelledby="recent-title">
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>LITTLE MOMENTS</span><h2 id="recent-title">最近收藏的小美好</h2></div><span className={styles.sectionNote}>点开影像，再看一眼那一天</span></div>
      <div className={styles.recentGrid}>{recent.map(({ album, media }) => <MediaTile key={`${album.id}-${media.id}`} album={album} media={media} onOpen={onOpen} />)}</div>
    </section>}
  </>;
}

export function BrowsePage({ data, onOpen }: { data: SiteContent; onOpen: OpenMedia }) {
  const [filter, setFilter] = useState<Filter>('all');
  const items = useMemo(() => data.albums.flatMap(album => album.media.map(media => ({ album, media }))), [data]);
  const counts: Record<Filter, number> = {
    all: items.length,
    photo: items.filter(item => item.media.type === 'photo').length,
    video: items.filter(item => isVideo(item.media)).length,
  };
  const visible = items.filter(item => filter === 'all' || item.media.type === filter);
  const years = [...new Set(visible.map(item => yearOf(item.media.date)))].sort((a, b) => b.localeCompare(a));
  const goToYear = (year: string) => {
    document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  return <section className={styles.browse} aria-labelledby="browse-title">
    <header className={styles.browseHeader}>
      <span className={styles.eyebrow}>ALL MOMENTS</span>
      <h1 id="browse-title">全部影像</h1>
      <p>沿着时间，慢慢翻看。视频与照片按时间排在一起。</p>
    </header>
    <div className={styles.filterBar} role="group" aria-label="按类型筛选">
      {([['all', '全部'], ['photo', '照片'], ['video', '视频']] as const).map(([key, label]) => <button key={key} type="button" className={styles.filterChip} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} {counts[key]}</button>)}
    </div>
    {years.length > 1 && <nav className={styles.yearNav} aria-label="年份定位">
      <span className={styles.yearNavLabel}>年份</span>
      {years.map(year => <button key={year} type="button" className={styles.yearChip} onClick={() => goToYear(year)}>{year}</button>)}
    </nav>}
    {visible.length === 0 ? <div className={styles.empty}><span aria-hidden="true">☀</span><h2>这里还没有影像</h2><p>换一个筛选条件，或回到首页看看相册。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>
      : years.map(year => <section key={year} id={`year-${year}`} className={styles.yearGroup} aria-labelledby={`year-title-${year}`}>
        <div className={styles.yearHeader}><h2 id={`year-title-${year}`}>{year}</h2><span className={styles.sectionNote}>{visible.filter(item => yearOf(item.media.date) === year).length} 项</span></div>
        <div className={styles.browseGrid}>{visible.filter(item => yearOf(item.media.date) === year).map(({ album, media }) => <MediaTile key={`${album.id}-${media.id}`} album={album} media={media} onOpen={onOpen} />)}</div>
      </section>)}
  </section>;
}

export function AlbumsPage({ data }: { data: SiteContent }) {
  return <section className={styles.browse} aria-labelledby="albums-index-title">
    <header className={styles.browseHeader}>
      <span className={styles.eyebrow}>OUR ALBUMS</span>
      <h1 id="albums-index-title">相册</h1>
      <p>按时间收藏的每一段日子，点开就能继续翻看。</p>
    </header>
    {data.albums.length
      ? <div className={styles.albumGrid} style={{ marginTop: 'var(--space-xl)' }}>{data.albums.map(album => <AlbumCard key={album.id} album={album} />)}</div>
      : <div className={styles.empty}><h2>相册还在准备中</h2><p>新的故事会在这里出现。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>}
  </section>;
}

export function AlbumPage({ album, albums, onOpen }: { album: Album; albums: Album[]; onOpen: OpenMedia }) {
  const index = albums.findIndex(item => item.id === album.id);
  const previous = index > 0 ? albums[index - 1] : undefined;
  const next = index >= 0 && index < albums.length - 1 ? albums[index + 1] : undefined;
  const first = album.media[0];
  const dates = album.media.map(item => item.date).filter((value): value is string => Boolean(value)).sort();
  const range = dates.length > 1 && dates[0] !== dates[dates.length - 1] ? `${dateText(dates[0])} — ${dateText(dates[dates.length - 1])}` : dateText(dates[0] ?? album.date);
  return <section className={styles.detail} aria-labelledby="album-title">
    <nav className={styles.breadcrumb} aria-label="面包屑"><a href="#/">首页</a><span aria-hidden="true">/</span><a href="#/browse">全部影像</a><span aria-hidden="true">/</span><span aria-current="page">{album.title}</span></nav>
    <header className={styles.detailHeader}>
      <span className={styles.eyebrow}>{range} · {album.media.length} 个瞬间</span>
      <h1 id="album-title">{album.title}</h1>
      {album.description && <p>{album.description}</p>}
      {first && <button type="button" className={styles.primary} onClick={() => onOpen(album, first.id)}><span aria-hidden="true">▶</span> 从这里播放</button>}
    </header>
    {album.media.length ? <div className={styles.photoGrid}>{album.media.map((media, i) => <MediaTile key={media.id} album={album} media={media} onOpen={onOpen} eager={i < 3} />)}</div>
      : <div className={styles.empty}><span aria-hidden="true">☀</span><h2>下一段故事，还在路上</h2><p>这个相册暂时没有影像，先去看看其他回忆吧。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>}
    {(previous || next) && <nav className={styles.adjacent} aria-label="相邻相册">
      {previous ? <a href={`#/albums/${previous.id}`}><small>上一本相册</small>{previous.title}</a> : <span />}
      {next ? <a className={styles.adjacentNext} href={`#/albums/${next.id}`}><small>下一本相册</small>{next.title}</a> : <span />}
    </nav>}
  </section>;
}
