import { mediaUrl } from '../../content';
import { AlbumPage, AlbumsPage, BrowsePage } from './ThemePages';
import { HomePage } from './ThemeHome';
import { MediaViewer } from '../../media-viewer';
import type { ThemeApp } from '../contracts';
import styles from './BookApp.module.css';
import './BookTokens.css';

export const BookApp: ThemeApp = props => {
  const albumId = props.route.kind === 'album' ? props.route.id : null;
  const album = albumId ? props.content.albums.find(item => item.id === albumId) : undefined;
  const main = props.contentErrorMessage ? <section role="alert"><h1>内容配置暂时无法读取</h1><p>{props.contentErrorMessage}</p></section> : props.route.kind === 'home' ? <HomePage memory={props.homeMemory} viewerOpen={Boolean(props.session)} /> : props.route.kind === 'browse' ? <BrowsePage data={props.content} heroImage={mediaUrl('media/themes/book/album-hero.png')} /> : props.route.kind === 'albums' ? <AlbumsPage data={props.content} /> : album ? <AlbumPage album={album} onOpen={props.onOpen} /> : <section><h1>没有找到这个相册</h1><a href="#/">回到首页</a></section>;
  return <div className={styles.shell}><a className={styles.skip} href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>跳到主要内容</a>{!props.online && <p role="status">当前处于离线状态，媒体可能无法显示</p>}<main id="main" tabIndex={-1}>{main}</main>{props.session && <MediaViewer session={props.session} commands={props.commands} />}</div>;
};
