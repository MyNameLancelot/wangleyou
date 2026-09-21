import { Music } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { assetUrl } from '../../content';
import {
  isBackgroundMusicPlaying,
  shouldPlayBackgroundMusic,
} from '../../playback';
import type { BackgroundMusic } from '../../playback';
import type { ThemeMusicCommands } from '../contracts';
import styles from './GrasslandMusicToggle.module.css';

/** 长按音乐按钮展开音量：触屏端没有 hover 时的入口。 */
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP_PX = 8;

/**
 * 草原主题首页两屏的背景音乐入口。
 * 两个按钮共享本组件创建的唯一音频元素，播放意图与状态来自 playback 契约。
 */
export function GrasslandMusicToggle({ music, commands, blockedByVideo }: {
  music: BackgroundMusic;
  commands: ThemeMusicCommands;
  blockedByVideo: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playRequestRef = useRef(0);
  const controlRefs = useRef<Record<'hero' | 'memory', HTMLDivElement | null>>({ hero: null, memory: null });
  const pressTimerRef = useRef<number | undefined>(undefined);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const [pinnedScreen, setPinnedScreen] = useState<'hero' | 'memory' | null>(null);
  const [documentVisible, setDocumentVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');

  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState !== 'hidden';
      setDocumentVisible(visible);
      commands.reportVisibility(visible);
    };
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, [commands]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // StrictMode 会重放 effect：清理后的同一 DOM 必须重新获得资源地址。
    audio.src = assetUrl('media/themes/grassland/music.mp3');
    return () => {
      playRequestRef.current += 1;
      audio.pause();
      audio.removeAttribute('src');
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = music.volume;
  }, [music.volume]);

  // 刷新后自动播放被浏览器拒绝（blocked 保留播放意图）：任意首次交互（音乐控件内部手势除外）
  // 用同一手势直接重试播放；控件自身点击由 onButtonClick 处理，避免恢复与切换双重处理。
  const audioPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const request = ++playRequestRef.current;
    audio.play().then(() => {
      if (request === playRequestRef.current) commands.reportStatus('playing');
    }).catch(() => {
      if (request === playRequestRef.current) commands.reportBlocked();
    });
  }, [commands]);
  const blocked = music.status === 'blocked';
  useEffect(() => {
    if (!blocked) return;
    const onGesture = (event: Event) => {
      if (music.resumeRequired) return;
      const target = event.target;
      if (target instanceof Node && Object.values(controlRefs.current).some(node => node?.contains(target))) return;
      audioPlay();
    };
    document.addEventListener('pointerdown', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
    return () => {
      document.removeEventListener('pointerdown', onGesture, true);
      document.removeEventListener('keydown', onGesture, true);
    };
  }, [blocked, audioPlay, music.resumeRequired]);

  useEffect(() => () => {
    if (pressTimerRef.current !== undefined) window.clearTimeout(pressTimerRef.current);
  }, []);

  // 点击面板外或按 Esc 收起长按展开的音量面板
  useEffect(() => {
    if (!pinnedScreen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && controlRefs.current[pinnedScreen]?.contains(target)) return;
      setPinnedScreen(null);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPinnedScreen(null); };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinnedScreen]);

  const clearPressTimer = () => {
    if (pressTimerRef.current === undefined) return;
    window.clearTimeout(pressTimerRef.current);
    pressTimerRef.current = undefined;
  };
  const playing = isBackgroundMusicPlaying(music);
  const onButtonPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, screen: 'hero' | 'memory') => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // 只有播放状态才提供长按展开音量；暂停时长按仍按普通点击处理
    if (!playing) return;
    suppressClickRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = undefined;
      suppressClickRef.current = true;
      setPinnedScreen(screen);
    }, LONG_PRESS_MS);
  };
  const onButtonPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = pressStartRef.current;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) <= LONG_PRESS_SLOP_PX) return;
    clearPressTimer();
    pressStartRef.current = null;
  };
  const endPress = () => {
    clearPressTimer();
    pressStartRef.current = null;
  };
  const onButtonClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    // 回前台后的暂停是程序性暂停：按钮点击是显式恢复，不翻转用户意图。
    if (music.resumeRequired) {
      commands.resume();
      return;
    }
    // blocked 时按钮点击本身就是恢复手势：直接重试播放，不翻转意图
    if (music.status === 'blocked') {
      audioPlay();
      return;
    }
    commands.toggle();
  };

  const shouldPlay = shouldPlayBackgroundMusic(music, { documentVisible, blockedByVideo });
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!shouldPlay) {
      playRequestRef.current += 1;
      audio.pause();
      commands.reportStatus('paused');
      return;
    }
    audioPlay();
  }, [shouldPlay, audioPlay, commands]);

  const renderButton = (screen: 'hero' | 'memory') => <div
    ref={node => { controlRefs.current[screen] = node; }}
    className={`${styles.control} ${screen === 'memory' ? styles.memoryControl : ''}`}
    data-testid={screen === 'hero' ? 'music-toggle' : undefined}
    data-music-screen={screen}
    data-playing={playing}
    data-volume-pinned={pinnedScreen === screen}
  >
    <button
      type="button"
      className={styles.button}
      onClick={onButtonClick}
      onPointerDown={event => onButtonPointerDown(event, screen)}
      onPointerMove={onButtonPointerMove}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onContextMenu={event => event.preventDefault()}
      aria-pressed={playing}
      aria-label={playing ? '暂停背景音乐' : '播放背景音乐'}
    >
      <span className={styles.surface} data-music-surface>
        <span className={styles.glyph} aria-hidden="true" data-music-glyph>
          <Music className={styles.icon} data-music-icon />
          {!playing && <span className={styles.mutedMark} data-music-muted-mark />}
        </span>
      </span>
    </button>
    <div className={styles.volume} data-testid={screen === 'hero' ? 'music-volume' : undefined} data-music-volume={screen} aria-hidden={!playing}>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={music.volume}
        onChange={event => commands.setVolume(Number(event.currentTarget.value))}
        aria-label="背景音乐音量"
        aria-valuetext={`${Math.round(music.volume * 100)}%`}
        tabIndex={playing ? undefined : -1}
        data-music-volume-slider
      />
    </div>
  </div>;

  return <div className={styles.dock} data-testid="music-controls" data-playing={playing} data-music-status={music.status}>
    <audio
      ref={audioRef}
      className={styles.audio}
      src={assetUrl('media/themes/grassland/music.mp3')}
      loop
      preload="none"
      data-testid="background-music"
    />
    {renderButton('hero')}
    {renderButton('memory')}
  </div>;
}
