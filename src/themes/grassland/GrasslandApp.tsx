import { assetUrl } from '../../content';
import { AlbumPage, AlbumsPage, BrowsePage, HomePage } from './ThemePages';
import { GrasslandMusicToggle } from './GrasslandMusicToggle';
import { GrasslandThemeSwitch } from './GrasslandThemeSwitch';
import { currentMedia, isVideo } from '../../playback';
import { MediaViewer } from './ThemeViewer';
import type { ThemeApp } from '../contracts';
import styles from './GrasslandApp.module.css';
import './GrasslandTokens.css';

export const GrasslandApp: ThemeApp = props => {
  const albumId = props.route.kind === 'album' ? props.route.id : null;
  const album = albumId ? props.content.albums.find(item => item.id === albumId) : undefined;
  const videoOpen = props.session ? isVideo(currentMedia(props.session)) : false;
  const main = props.contentErrorMessage ? <section role="alert"><h1>内容配置暂时无法读取</h1><p>{props.contentErrorMessage}</p></section> : props.route.kind === 'home' ? <HomePage data={props.content} copy={{ eyebrow: '沿着地平线看回忆', title: '把辽阔的日子，慢慢收好。', subtitle: '阳光、远山与那些舍不得快进的片刻。' }} heroImage={assetUrl('media/themes/grassland/home-hero.webp')} viewerOpen={Boolean(props.session)} /> : props.route.kind === 'browse' ? <BrowsePage data={props.content} onOpen={props.onOpen} heroImage={assetUrl('media/themes/grassland/home-hero.webp')} /> : props.route.kind === 'albums' ? <AlbumsPage data={props.content} /> : album ? <AlbumPage album={album} albums={props.content.albums} onOpen={props.onOpen} /> : <section><h1>没有找到这个相册</h1><a href="#/">回到首页</a></section>;
  const home = props.route.kind === 'home';
  return <div className={styles.shell}><div className={styles.decor} data-testid="theme-decor" aria-hidden="true" /><a className={styles.skip} href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>跳到主要内容</a>{!props.online && <p role="status">当前处于离线状态，媒体可能无法显示。</p>}<main id="main" tabIndex={-1}>{main}</main>{home && <div className={styles.musicControl}><GrasslandMusicToggle music={props.music} commands={props.musicCommands} blockedByVideo={videoOpen} /></div>}<div className={`${styles.themeControl} ${home ? styles.themeControlHome : styles.themeControlPage}`}><GrasslandThemeSwitch onSwitch={props.onSwitchTheme} /></div>{props.session && <MediaViewer session={props.session} commands={{ ...props.commands, toggleTheme: props.onSwitchTheme }} themeLabel="草原主题" />}</div>;
};
