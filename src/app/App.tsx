import { useCallback, useEffect, useState } from 'react';
import { AlbumPage, HomePage } from '../albums';
import { content } from '../content';
import type { Album, Photo } from '../content';
import { MediaViewer } from '../media-viewer';
import { openSession, stepSession } from '../playback';
import type { Session } from '../playback';
import '../themes';
import { parseRoute } from './router';
import styles from './App.module.css';
import './global.css';

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [session, setSession] = useState<Session>(null);
  useEffect(() => {
    const changeRoute = () => { setSession(null); setRoute(parseRoute(window.location.hash)); window.scrollTo(0,0); };
    window.addEventListener('hashchange',changeRoute);
    return () => window.removeEventListener('hashchange',changeRoute);
  }, []);
  const album = route.kind === 'album' ? content.albums.find(a => a.id === route.id) : undefined;
  useEffect(() => { document.title = `${album ? `${album.title} · ` : ''}${content.site.title} · 成长相册`; }, [album]);
  const open = useCallback((album: Album,id: string) => setSession(openSession(album.media.filter((m): m is Photo => m.type==='photo'), id)),[]);
  const step = useCallback((delta: number) => setSession(current => stepSession(current,delta)),[]);
  const close = useCallback(() => setSession(null),[]);
  return <div className={styles.shell}>
    <a className={styles.skip} href="#main" onClick={event=>{ event.preventDefault(); document.getElementById('main')?.focus(); }}>跳到主要内容</a>
    <header className={styles.header}>
      <a className={styles.brand} href="#/" aria-label={`${content.site.title}，返回首页`}><span className={styles.brandIcon} aria-hidden="true">☀</span><span>{content.site.title}<small>成长相册 · OUR LITTLE DAYS</small></span></a>
      <nav aria-label="主导航"><a href="#/" aria-current={route.kind==='home'?'page':undefined}>我们的相册</a><span className={styles.headerNote}>一起长大，一起看世界 <span aria-hidden="true">↗</span></span></nav>
    </header>
    <main id="main" tabIndex={-1} className={styles.main}>
      {route.kind==='home'?<HomePage data={content} onOpen={open} />:album?<AlbumPage key={album.id} album={album} onOpen={open} />:<section className={styles.notFound}><span>这一页好像走丢了</span><h1>没有找到这个相册</h1><p>链接可能已更改，回到首页继续看看吧。</p><a href="#/">返回全部相册 →</a></section>}
    </main>
    <footer className={styles.footer}><span className={styles.footerBrand}>{content.site.title}<small>愿每个平凡的日子，都有迹可循。</small></span><span className={styles.demo}>演示相册 · 照片来自 <a href="https://www.pexels.com/" target="_blank" rel="noreferrer">Pexels ↗</a><br />演示日期与故事不代表真实家庭记录</span></footer>
    {session && <MediaViewer session={session} onStep={step} onClose={close} />}
  </div>;
}
