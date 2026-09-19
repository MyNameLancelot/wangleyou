import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { content, contentErrorMessage } from '../content';
import type { Album } from '../content';
import {
  handleEnded,
  markPlaybackError,
  openSession,
  readLastPlayed,
  setContinuous,
  setIntent,
  setProgress,
  setStatus,
  stepSession,
  writeLastPlayed,
} from '../playback';
import type { Session } from '../playback';
import { applyTheme, nextTheme, readTheme } from '../themes';
import type { ThemeName, ThemeViewerCommands } from '../themes';
import '../themes';
import { parseRoute } from './router';
import { BeachApp, GrasslandApp } from '../themes';
import type { ThemeApp } from '../themes';
import './global.css';

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [session, setSession] = useState<Session | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() => readTheme());
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [, setLastPlayed] = useState(() => readLastPlayed());
  const sessionRef = useRef<Session | null>(null);

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
    if (!next) return;
    const media = next.media[next.index];
    const owner = content.albums.find(item => item.media.some(entry => entry.id === media?.id));
    if (!owner || !media) return;
    const value = { albumId: owner.id, mediaId: media.id, index: next.index };
    writeLastPlayed(value);
    setLastPlayed(value);
  }, []);

  const open = useCallback((target: Album, id: string) => {
    applySession(openSession(target.media, id));
  }, [applySession]);

  const switchTheme = useCallback(() => setTheme(current => applyTheme(nextTheme(current))), []);

  const commands = useMemo<ThemeViewerCommands>(() => ({
    step: delta => applySession(stepSession(sessionRef.current, delta)),
    close: () => applySession(null),
    toggleIntent: () => {
      const current = sessionRef.current;
      if (current) applySession(setIntent(current, current.intent === 'playing' ? 'paused' : 'playing'));
    },
    toggleContinuous: () => {
      const current = sessionRef.current;
      if (current) applySession(setContinuous(current, !current.continuous));
    },
    reportProgress: (progress, duration) => applySession(setProgress(sessionRef.current, progress, duration)),
    reportStatus: status => applySession(setStatus(sessionRef.current, status)),
    reportEnded: () => applySession(handleEnded(sessionRef.current)),
    reportError: () => applySession(markPlaybackError(sessionRef.current)),
    reportBlocked: () => {
      const current = sessionRef.current;
      if (current) applySession(setStatus(setIntent(current, 'paused'), 'paused'));
    },
  }), [applySession]);

  const ThemePage: ThemeApp = theme === 'beach' ? BeachApp : GrasslandApp;

  return <ThemePage route={route} content={content} session={session} commands={commands} onOpen={open} onSwitchTheme={switchTheme} theme={theme} online={online} contentErrorMessage={contentErrorMessage} />;
}
