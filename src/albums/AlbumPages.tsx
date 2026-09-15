import type { Album, Photo, SiteContent } from '../content';
import { assetUrl } from '../content';
import { PhotoImage } from '../shared';
import styles from './AlbumPages.module.css';

type OpenPhoto = (album: Album, id: string) => void;
const dateText = (date?: string) => date ? date.replaceAll('-', '.') : '待续';
function AlbumCard({ album }: { album: Album }) {
  const cover = album.cover || album.media.map(media => media.thumbnail || (media.type === 'video' ? media.poster : undefined)).find(Boolean) || album.media.find((media): media is Photo => media.type === 'photo')?.src;
  return <a className={styles.albumCard} href={`#/albums/${album.id}`} aria-label={`查看相册：${album.title}`}>
    <div className={styles.cover}>
      {cover ? <PhotoImage src={assetUrl(cover)} alt={album.title} /> : <div className={styles.emptyCover}><span aria-hidden="true">＋</span><p>留给下一段故事</p></div>}
      <span className={styles.count}>{album.media.length ? `${album.media.length} 个瞬间` : '等待新故事'}</span>
    </div>
    <div className={styles.cardInfo}><span className={styles.date}>{dateText(album.date)}</span><h3>{album.title}<span aria-hidden="true">↗</span></h3><p>{album.description}</p></div>
  </a>;
}
export function HomePage({ data, onOpen }: { data: SiteContent; onOpen: OpenPhoto }) {
  const photos = data.albums.flatMap(album => album.media.filter((m): m is Photo => m.type === 'photo').map(photo => ({ album, photo })));
  const featured = photos.slice(0, 3);
  const recent = [...photos].sort((a, b) => (b.photo.date || '').localeCompare(a.photo.date || '')).slice(0, 4);
  return <>
    <section className={styles.intro} aria-labelledby="home-title">
      <div className={styles.introCopy}><span className={styles.eyebrow}><span className={styles.sun} aria-hidden="true">☀</span> 我们的小小成长记录</span><h1 id="home-title">把日子过成<br />值得收藏的<span>回忆。</span></h1><p>{data.site.subtitle}<br />每个不起眼的瞬间，都是长大的模样。</p><a className={styles.primary} href="#albums" onClick={event => {event.preventDefault(); document.getElementById('albums')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });}}>翻开我们的相册 <span aria-hidden="true">↗</span></a><div className={styles.introMeta}><span>{data.albums.length} 本相册</span><span>{photos.length} 个照片瞬间</span><span>慢慢长大，好好记录</span></div></div>
      {featured.length > 0 && <div className={styles.memoryStrip} aria-label="精选照片">
        {featured.map(({ album, photo }, i) => <button key={`${album.id}-${photo.id}`} className={`${styles.memory} ${styles[`memory${i}`]}`} onClick={() => onOpen(album, photo.id)} aria-label={`查看照片：${photo.description || photo.id}`}>
          <PhotoImage src={assetUrl(photo.thumbnail || photo.src)} alt={photo.alt || photo.description || '精选照片'} eager />
          <span className={styles.memoryCaption}>{photo.description || '小小的瞬间'}<small>{dateText(photo.date)}</small></span>
        </button>)}
        <span className={styles.memoryNote}>一些小事，一整个夏天。</span>
      </div>}
    </section>
    <section className={styles.albumsSection} id="albums" aria-labelledby="albums-title">
      <div className={styles.sectionHeader}><div><span className={styles.eyebrow}>OUR ALBUMS</span><h2 id="albums-title">一页一页，都是我们</h2></div><span className={styles.sectionNote}>按时间收藏，每一段都珍贵</span></div>
      {data.albums.length ? <div className={styles.albumGrid}>{data.albums.map(album => <AlbumCard key={album.id} album={album} />)}</div> : <div className={styles.empty}><h3>相册还在准备中</h3><p>新的故事会在这里出现。</p></div>}
    </section>
    {recent.length > 0 && <section className={styles.recent} aria-labelledby="recent-title"><div className={styles.sectionHeader}><div><span className={styles.eyebrow}>LITTLE MOMENTS</span><h2 id="recent-title">最近收藏的小美好</h2></div><span className={styles.sectionNote}>点开照片，再看一眼那一天</span></div><div className={styles.recentGrid}>{recent.map(({album,photo}) => <button key={`${album.id}-${photo.id}`} onClick={() => onOpen(album, photo.id)} aria-label={`查看照片：${photo.description || photo.id}`}><div className={styles.recentPhoto}><PhotoImage src={assetUrl(photo.thumbnail || photo.src)} alt={photo.alt || photo.description || '生活照片'} /></div><span>{photo.description}<small>{dateText(photo.date)}</small></span></button>)}</div></section>}
  </>;
}
export function AlbumPage({ album, onOpen }: { album: Album; onOpen: OpenPhoto }) {
  return <section className={styles.detail} aria-labelledby="album-title">
    <a className={styles.back} href="#/" aria-label="返回全部相册">← 返回全部相册</a>
    <header className={styles.detailHeader}><span className={styles.eyebrow}>{dateText(album.date)} · {album.media.length} 个瞬间</span><h1 id="album-title">{album.title}</h1><p>{album.description}</p></header>
    {album.media.length ? <div className={styles.photoGrid}>{album.media.map(media => media.type === 'photo' ? <button key={media.id} className={styles.photoCard} onClick={() => onOpen(album, media.id)} aria-label={`查看照片：${media.description || media.id}`}><div className={styles.photoThumb}><PhotoImage src={assetUrl(media.thumbnail || media.src)} alt={media.alt || media.description || '相册照片'} width={media.width} height={media.height} /></div><span>{media.description || '生活里的一个瞬间'}<small>{dateText(media.date)}</small></span></button> : <div className={styles.photoCard} key={media.id}><div className={styles.photoThumb}>{(media.poster || media.thumbnail) && <PhotoImage src={assetUrl(media.poster || media.thumbnail!)} alt={media.description || '视频封面'} />}</div><p>视频 · 当前版本尚不支持播放</p></div>)}</div> : <div className={styles.empty}><span aria-hidden="true">☀</span><h2>下一段故事，还在路上</h2><p>这个相册暂时没有照片，先去看看其他回忆吧。</p><a className={styles.primary} href="#/">返回全部相册 <span aria-hidden="true">↗</span></a></div>}
  </section>;
}
