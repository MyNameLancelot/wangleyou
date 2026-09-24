import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { content, contentErrorMessage, homeMemory } from '../content';
import type { Album } from '../content';
import {
  clearBackgroundMusicResume,
  createBackgroundMusic,
  handleEnded,
  markBackgroundMusicBlocked,
  markPlaybackError,
  openSession,
  readBackgroundMusicPreference,
  setBackgroundMusicStatus,
  setBackgroundMusicVolume,
  setIntent,
  setProgress,
  setStatus,
  setBackgroundMusicVisibility,
  stepSessionTo,
  toggleBackgroundMusic,
  writeBackgroundMusicPreference,
} from '../playback';
import type { BackgroundMusic, BackgroundMusicPreference, Session } from '../playback';
import { applyTheme, nextTheme, readTheme } from '../themes';
import type { ThemeMusicCommands, ThemeName } from '../themes';
import type { MediaViewerCommands } from '../media-viewer';
import '../themes';
import { parseRoute } from './router';
import { BeachApp, GrasslandApp } from '../themes';
import type { ThemeApp } from '../themes';
import './global.css';

// 某些浏览器策略会在访问属性时抛错，而不只是 getItem/setItem 抛错。
function musicStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => readTheme());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  // 播放意图与音量本地缓存：显式切换才写存储，刷新后恢复用户偏好（浏览器拦截时首次交互恢复）。
  const [music, setMusic] = useState<BackgroundMusic>(() => {
    const preference = readBackgroundMusicPreference(musicStorage());
    return createBackgroundMusic(preference.intent, preference.volume);
  });
  const sessionRef = useRef<Session | null>(null);
  const musicRef = useRef(music);
  const pendingMusicPreferenceRef = useRef<BackgroundMusicPreference | null>(null);

  useEffect(() => {
    musicRef.current = music;
  }, [music]);

  useEffect(() => {
    const preference = pendingMusicPreferenceRef.current;
    if (!preference) return;
    pendingMusicPreferenceRef.current = null;
    writeBackgroundMusicPreference(musicStorage(), preference);
  }, [music]);

  useEffect(() => {
    const changeRoute = () => {
      sessionRef.current = null;
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

  /** 会话由 App 唯一持有；这里同时维护 ref，避免在状态更新函数里产生副作用。 */
  const applySession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const open = useCallback((target: Album, id: string) => {
    applySession(openSession(target.media, id));
  }, [applySession]);

  const switchTheme = useCallback(() => setTheme(current => applyTheme(nextTheme(current))), []);

  const commands = useMemo<MediaViewerCommands>(() => ({
    stepTo: index => applySession(stepSessionTo(sessionRef.current, index)),
    close: () => applySession(null),
    reportProgress: (progress, duration) => applySession(setProgress(sessionRef.current, progress, duration)),
    reportStatus: status => applySession(setStatus(sessionRef.current, status)),
    reportEnded: () => applySession(handleEnded(sessionRef.current)),
    reportError: () => applySession(markPlaybackError(sessionRef.current)),
    reportBlocked: (media, index) => {
      const current = sessionRef.current;
      if (current?.media === media && current.index === index) applySession(setStatus(setIntent(current, 'paused'), 'paused'));
    },
  }), [applySession]);

  const musicCommands = useMemo<ThemeMusicCommands>(() => ({
    toggle: () => {
      const next = toggleBackgroundMusic(musicRef.current);
      musicRef.current = next;
      pendingMusicPreferenceRef.current = { intent: next.intent, volume: next.volume };
      setMusic(next);
    },
    setVolume: volume => {
      const next = setBackgroundMusicVolume(musicRef.current, volume);
      if (next === musicRef.current) return;
      musicRef.current = next;
      pendingMusicPreferenceRef.current = { intent: next.intent, volume: next.volume };
      setMusic(next);
    },
    reportStatus: status => setMusic(current => setBackgroundMusicStatus(current, status)),
    reportBlocked: () => setMusic(markBackgroundMusicBlocked),
    reportVisibility: visible => setMusic(current => setBackgroundMusicVisibility(current, visible)),
    resume: () => setMusic(clearBackgroundMusicResume),
  }), []);

  const ThemePage: ThemeApp = theme === 'beach' ? BeachApp : GrasslandApp;

  return <ThemePage route={route} content={content} homeMemory={homeMemory} session={session} commands={commands} music={music} musicCommands={musicCommands} onOpen={open} onSwitchTheme={switchTheme} online={online} contentErrorMessage={contentErrorMessage} />;
}
