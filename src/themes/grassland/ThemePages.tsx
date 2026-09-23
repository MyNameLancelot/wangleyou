import { useMemo, useState } from 'react';
import { MasonryPhotoAlbum } from 'react-photo-album';
import 'react-photo-album/masonry.css';
import type { Album, Media, Photo, SiteContent, Video } from '../../content';
import { mediaUrl } from '../../content';
import { PhotoImage } from './PhotoImage';
import { reducedMotion } from './browser';
import styles from './ThemePages.module.css';

export type OpenMedia = (album: Album, id: string) => void;
type Filter = 'all' | 'photo' | 'video';
type TileVariant = 'wide' | 'tall' | 'masonry';
type ImageSource = Pick<Photo, 'src' | 'srcSet'>;

const dateText = (date?: string) => (date ? date.replaceAll('-', '.') : '待续');
const isVideo = (media: Media): media is Video => media.type === 'video';
const durationText = (seconds?: number) => (seconds && seconds > 0 ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '');
const thumbnailOf = (media: Media) => (isVideo(media) ? media.poster : undefined) || (media.type === 'photo' ? media.src : undefined);
const imageSourceOf = (media: Media): ImageSource | undefined => media.type === 'photo' ? media : media.poster ? { src: media.poster } : undefined;
const responsiveSrcSet = (source: ImageSource) => source.srcSet?.map(candidate => `${mediaUrl(candidate.src)} ${candidate.width}w`).join(', ');
const browseCoverSizes = '(max-width: 600px) calc((100vw - 72px) / 2), (max-width: 900px) calc((100vw - 80px) / 2), 300px';
/** 照片没有单独文案时，用相册名与序号兜底，保证每个缩略图都有可读的可访问名称。 */
const mediaLabel = (album: Album, media: Media) => {
  const index = album.media.findIndex(item => item.id === media.id) + 1;
  const name = media.description || `${album.title} 第 ${index} ${isVideo(media) ? '段' : '张'}`;
  return isVideo(media) ? `播放视频：${name}` : `查看照片：${name}`;
};

/** 图片与视频共用的缩略图：说明条压在卡片底部，视频带类型标识。 */
function MediaTile({ media, onOpen, album, variant = 'wide', eager }: { media: Media; album: Album; onOpen: OpenMedia; variant?: TileVariant; eager?: boolean }) {
  const source = thumbnailOf(media);
  return <button type="button" className={[styles.mediaTile, variant === 'tall' ? styles.mediaTileTall : '', variant === 'masonry' ? styles.masonryTile : ''].filter(Boolean).join(' ')} onClick={() => onOpen(album, media.id)} aria-label={mediaLabel(album, media)}>
    <span className={styles.mediaThumb}>
      {source ? <PhotoImage src={mediaUrl(source)} alt={media.alt || media.description || '相册影像'} eager={eager} /> : <span className={styles.emptyCover}><span aria-hidden="true">＋</span><p>等待新的影像</p></span>}
      {isVideo(media) && <span className={styles.videoBadge}><span aria-hidden="true">▶</span>{durationText(media.duration) && <small>{durationText(media.duration)}</small>}</span>}
      {media.description && <span className={styles.mediaBar}>{media.description}</span>}
    </span>
  </button>;
}

/** 留影页按相册聚合：同一年内先看 YYYY-MM 的月份，再看 sequenceNN（00、01 …）。 */
const albumOrdinal = (album: Album) => Number(`${album.id.slice(5, 7)}${album.id.slice(-2)}`) || 0;
const albumYear = (album: Album) => album.id.slice(0, 4) || album.date?.slice(0, 4) || '未标注日期';

/** 留影页直接采用构建期确定的媒体顺序：topNN 已在前，其余按自然序排列。 */
const browseAlbumStack = (album: Album): ImageSource[] => {
  const seen = new Set<string>();
  return album.media.map(imageSourceOf).filter((source): source is ImageSource => Boolean(source)).filter(source => {
    if (seen.has(source.src)) return false;
    seen.add(source.src);
    return true;
  }).slice(0, 3);
};

/** 相册卡片沿用影像卡样式，说明条写相册名与相册说明。 */
function AlbumTile({ album }: { album: Album }) {
  const stack = browseAlbumStack(album);
  const front = stack[0];
  const behind = stack.slice(1);
  return <a className={styles.mediaTile} href={`#/albums/${album.id}`} aria-label={`查看相册：${album.title}`}>
    <span className={`${styles.mediaThumb} ${styles.browseAlbumThumb}`} data-browse-album-stack data-stack={stack.length}>
      {front
        ? <>
          {behind.map((source, index) => <span key={source.src} data-browse-cover={index === 0 ? 'middle' : 'back'} className={`${styles.browseAlbumLayer} ${index === 0 ? styles.browseAlbumLayerMiddle : styles.browseAlbumLayerBack}`}><PhotoImage src={mediaUrl(source.src)} srcSet={responsiveSrcSet(source)} sizes={browseCoverSizes} alt="" /></span>)}
          <span data-browse-cover="front" className={`${styles.browseAlbumLayer} ${styles.browseAlbumLayerFront}`}><PhotoImage src={mediaUrl(front.src)} srcSet={responsiveSrcSet(front)} sizes={browseCoverSizes} alt={album.title} /><span className={styles.mediaBar}><span className={styles.mediaAlbum}>{album.title}</span><span className={styles.mediaText}>{album.description || '这一段日子还在整理'}</span></span></span>
        </>
        : <><span className={styles.emptyCover}><span aria-hidden="true">＋</span><p>留给下一段故事</p></span><span className={styles.mediaBar}><span className={styles.mediaAlbum}>{album.title}</span><span className={styles.mediaText}>{album.description || '这一段日子还在整理'}</span></span></>}
    </span>
  </a>;
}

/** 相册封面最多三张：排序后的第一张完整显示，其余两张向右上错位只露出边缘。 */
const albumStack = (album: Album): string[] => [...new Set([album.cover, ...album.media.map(thumbnailOf)].filter((src): src is string => Boolean(src)))].slice(0, 3);

function AlbumCard({ album }: { album: Album }) {
  const stack = albumStack(album);
  const front = stack[0];
  const behind = stack.slice(1);
  return <a className={styles.albumCard} href={`#/albums/${album.id}`} aria-label={`查看相册：${album.title}`}>
    <div className={styles.cover} data-stack={stack.length}>
      {front
        ? <>
          {behind.map((src, index) => <span key={src} className={`${styles.coverLayer} ${index === 0 ? styles.coverLayerMid : styles.coverLayerBack}`}><PhotoImage src={mediaUrl(src)} alt="" /></span>)}
          <span className={`${styles.coverLayer} ${styles.coverLayerFront}`}><PhotoImage src={mediaUrl(front)} alt="" /></span>
        </>
        : <div className={styles.emptyCover}><span aria-hidden="true">＋</span><p>留给下一段故事</p></div>}
      <span className={styles.count}>{album.media.length ? `${album.media.length} 个瞬间` : '等待新故事'}</span>
    </div>
    <div className={styles.cardInfo}><span className={styles.date}>{dateText(album.date)}</span><h3>{album.title}<span aria-hidden="true">↗</span></h3>{album.description && <p>{album.description}</p>}</div>
  </a>;
}


export function BrowsePage({ data, heroImage = null }: { data: SiteContent; heroImage?: string | null }) {
  const [filter, setFilter] = useState<Filter>('all');
  const albums = useMemo(() => [...data.albums].sort((a, b) => albumOrdinal(a) - albumOrdinal(b)).filter(album => filter === 'all'
    || (filter === 'photo' ? album.media.some(media => !isVideo(media)) : album.media.some(isVideo))), [data, filter]);
  const years = [...new Set(albums.map(albumYear))].sort((a, b) => b.localeCompare(a));
  const albumsOf = (year: string) => albums.filter(album => albumYear(album) === year);
  const goToYear = (year: string) => document.getElementById(`year-${year}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  return <section className={styles.browse} aria-labelledby="browse-title">
    <div className={styles.browseHero}>
      <div className={styles.browseHeroMedia} style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined} aria-hidden="true" />
      <div className={styles.browseHeroCopy}>
        <a className={styles.browseBack} href="#/"><span aria-hidden="true">←</span> 返回首页</a>
        <h1 id="browse-title">留影</h1>
        <p>沿着时间，慢慢翻看。</p>
      </div>
      <div className={styles.filterPill} role="group" aria-label="按类型筛选">
        {([['all', '全部'], ['photo', '照片'], ['video', '视频']] as const).map(([key, label]) => <button key={key} type="button" className={styles.filterTab} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
    </div>
    <div className={styles.browseBody}>
      <aside className={styles.rail} aria-labelledby="rail-title">
        <div className={styles.railCard}>
          <h2 id="rail-title">光阴刻度</h2>
          <ul className={styles.railList}>{years.map(year => <li key={year}><button type="button" className={styles.railYear} onClick={() => goToYear(year)}>{year}</button></li>)}</ul>
        </div>
      </aside>
      <div className={styles.browseMain}>
        <nav className={styles.yearNav} aria-label="年份定位">
          <span className={styles.yearNavLabel}>年份</span>
          <div className={styles.yearNavScroller}>
            {years.map(year => <button key={year} type="button" className={styles.yearChip} onClick={() => goToYear(year)}>{year}</button>)}
          </div>
        </nav>
        {albums.length === 0
          ? <div className={styles.empty}><span aria-hidden="true">☀</span><h2>这里还没有影像</h2><p>换一个筛选条件，或回到首页看看相册。</p><a className={styles.primary} href="#/">返回首页 <span aria-hidden="true">↗</span></a></div>
          : years.map(year => <section key={year} id={`year-${year}`} className={styles.yearGroup} aria-labelledby={`year-title-${year}`}>
            <h2 className={styles.yearTitle} id={`year-title-${year}`}>{/^\d{4}$/.test(year) ? `${year} 年` : year}</h2>
            <div className={styles.browseGrid}>{albumsOf(year).map(album => <AlbumTile key={album.id} album={album} />)}</div>
          </section>)}
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

export function AlbumPage({ album, onOpen }: { album: Album; onOpen: OpenMedia }) {
  const first = album.media[0];
  const heroSource = first ? thumbnailOf(first) : undefined;
  const opening = album.opening || album.description;
  const photos = album.media.filter((media): media is Photo => media.type === 'photo' && Boolean(media.width && media.height)).map(media => ({ id: media.id, src: mediaUrl(media.src), width: media.width!, height: media.height!, srcSet: media.srcSet?.map(item => ({ ...item, src: mediaUrl(item.src) })), alt: media.alt || media.description || '相册影像', label: mediaLabel(album, media) }));
  return <section className={styles.detail} aria-labelledby="album-title">
    <header className={styles.detailHero} style={heroSource ? { backgroundImage: 'linear-gradient(110deg, rgb(41 65 35 / 76%), rgb(74 102 48 / 24%)), url("' + mediaUrl(heroSource) + '")', backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}><a className={styles.detailBack} href="#/browse">← 返回留影</a><div className={styles.detailHeroCopy}><h1 id="album-title">{album.title}</h1>{album.description && <p>{album.description}</p>}{opening && <blockquote>{opening}</blockquote>}</div></header>
    {/* 列数、间距与 sizes 全部沿用 react-photo-album 默认档位：容器 ≥1200px 为 5 列/20px，600–1199px 为 4 列/15px，300–599px 为 3 列/10px，<300px 为 2 列/5px。padding 提供相框留白，并计入库的列宽计算。 */}
    {album.media.length ? <section className={styles.detailGallery} aria-label="相册影像" data-testid="album-media-grid">{photos.length ? <MasonryPhotoAlbum photos={photos} padding={8} onClick={({ photo }) => onOpen(album, photo.id)} componentsProps={{ container: { className: styles.masonryGrid } }} /> : <div className={styles.masonryGrid}>{album.media.map((media, i) => <MediaTile key={media.id} album={album} media={media} onOpen={onOpen} variant="masonry" eager={i < 3} />)}</div>}</section> : <div className={styles.empty}><span aria-hidden="true">☀</span><h2>这本相册正在整理</h2><p>新的影像会在这里出现。</p><a className={styles.primary} href="#/browse">返回留影</a></div>}
  </section>;
}
