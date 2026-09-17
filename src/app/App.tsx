import { useCallback, useEffect, useState } from 'react';
import { AlbumPage, AlbumsPage, BrowsePage, HomePage } from '../albums';
import { content, contentErrorMessage } from '../content';
import type { Album } from '../content';
import { MediaViewer } from '../media-viewer';
import { openSession, readLastPlayed, resolveLastPlayed, stepSession, writeLastPlayed } from '../playback';
import type { LastPlayed, Session } from '../playback';
import { THEME_LABELS, THEME_SHORT_LABELS, applyTheme, nextTheme, readTheme } from '../themes';
import type { ThemeName } from '../themes';
import '../themes';
import { parseRoute } from './router';
import styles from './App.module.css';
import './global.css';

const NAV = [
  { href: '#/', label: '首页', kind: 'home' as const },
  { href: '#/browse', label: '全部影像', kind: 'browse' as const },
  { href: '#/albums', label: '相册', kind: 'albums' as const },
];

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => readTheme());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [lastPlayed, setLastPlayed] = useState<LastPlayed | null>(() => readLastPlayed());

  useEffect(() => {
    const changeRoute = () => {
      setSession(null);
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('hashchange', changeRoute);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('hashchange', changeRoute);
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const album = route.kind === 'album' ? content.albums.find(item => item.id === route.id) : undefined;
  useEffect(() => {
    const prefix = session ? '影像查看 · ' : album ? `${album.title} · ` : '';
    document.title = `${prefix}${content.site.title} · 成长相册`;
  }, [album, session]);

  const remember = useCallback((next: Session) => {
    const media = next.media[next.index];
    const owner = content.albums.find(item => item.media.some(entry => entry.id === media?.id));
    if (!owner || !media) return;
    const value: LastPlayed = { albumId: owner.id, mediaId: media.id, index: next.index };
    writeLastPlayed(value);
    setLastPlayed(value);
  }, []);

  const open = useCallback((target: Album, id: string) => {
    const next = openSession(target.media, id);
    setSession(next);
    if (next) remember(next);
  }, [remember]);

  const step = useCallback((delta: number) => {
    setSession(current => {
      const next = stepSession(current, delta);
      if (next && next !== current) remember(next);
      return next;
    });
  }, [remember]);

  const close = useCallback(() => setSession(null), []);
  const switchTheme = useCallback(() => setTheme(current => applyTheme(nextTheme(current))), []);

  const resume = resolveLastPlayed(content.albums, lastPlayed);
  const firstMedia = content.albums.map(item => ({ album: item, media: item.media[0] })).find(entry => Boolean(entry.media));

  const main = (() => {
    if (contentErrorMessage) {
      return <section className={styles.statePage} role="alert">
        <span className={styles.stateIcon} aria-hidden="true">⚠</span>
        <h1>内容配置暂时无法读取</h1>
        <p>{contentErrorMessage}</p>
        <p className={styles.stateHint}>相册配置需要维护在仓库的 <code>src/content/albums.json</code>，修正后重新构建即可恢复。</p>
      </section>;
    }
    if (route.kind === 'home') return <HomePage data={content} onOpen={open} resume={resume} onResume={resume ? () => open(resume.album, resume.media.id) : undefined} />;
    if (route.kind === 'browse') return <BrowsePage data={content} onOpen={open} />;
    if (route.kind === 'albums') return <AlbumsPage data={content} />;
    if (route.kind === 'album' && album) return <AlbumPage key={album.id} album={album} albums={content.albums} onOpen={open} />;
    return <section className={styles.statePage}>
      <span className={styles.stateIcon} aria-hidden="true">☀</span>
      <h1>这一页好像走丢了</h1>
      <p>没有找到这个相册，链接可能已更改。</p>
      <p className={styles.stateActions}>
        <a className={styles.primaryAction} href="#/">回到首页</a>
        {firstMedia && <button type="button" className={styles.secondaryAction} onClick={() => open(firstMedia.album, firstMedia.media.id)}>随便看看</button>}
      </p>
    </section>;
  })();

  return <div className={styles.shell}>
    <a className={styles.skip} href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>跳到主要内容</a>
    {!online && <p className={styles.offline} role="status">当前处于离线状态，已加载的内容仍可查看，媒体可能无法显示。</p>}
    <header className={styles.header}>
      <a className={styles.brand} href="#/" aria-label={`${content.site.title}，返回首页`}><span className={styles.brandIcon} aria-hidden="true">◐</span><span>{content.site.title}<small>成长相册 · OUR LITTLE DAYS</small></span></a>
      <nav className={styles.nav} aria-label="主导航">
        {NAV.map(item => <a key={item.href} href={item.href} aria-current={route.kind === item.kind || (item.kind === 'albums' && route.kind === 'album') ? 'page' : undefined}>{item.label}</a>)}
      </nav>
      <button type="button" className={styles.themeSwitch} onClick={switchTheme} aria-label={`切换主题，当前是${THEME_LABELS[theme]}`}>
        <span aria-hidden="true">◐</span>
        <span className={styles.themeLabel}>{THEME_SHORT_LABELS[theme]}</span>
      </button>
    </header>
    <main id="main" tabIndex={-1} className={styles.main}>{main}</main>
    <footer className={styles.footer}>
      <span className={styles.footerBrand}>{content.site.title}<small>愿每个平凡的日子，都有迹可循。</small></span>
      <span className={styles.demo}>演示相册 · 照片与视频来自公开演示素材（Pexels / MDN CC0）<br />演示日期与故事不代表真实家庭记录</span>
    </footer>
    {session && <MediaViewer session={session} onStep={step} onClose={close} />}
  </div>;
}
