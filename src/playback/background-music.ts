/**
 * 背景音乐的无 UI 状态。
 * `intent` 是用户意图，`status` 是实际播放状态：自动播放被浏览器拒绝时两者会分离，
 * 与视频播放一样，不能让拒绝改写用户意图之外的表现。
 */
export type MusicIntent = 'playing' | 'paused';
export type MusicStatus = 'playing' | 'paused' | 'blocked';

export type BackgroundMusic = {
  intent: MusicIntent;
  status: MusicStatus;
  /** 播放音量，0–1，由主题音量控件写入，audio 元素只做投影。 */
  volume: number;
  /** 页面隐藏造成的程序性暂停；回到前台后等待用户显式恢复。 */
  resumeRequired: boolean;
};

export const BACKGROUND_MUSIC_VOLUME = 0.5;

/** 默认希望播放：允许自动播放的环境直接响起，被拒绝时由 DOM 层回报 blocked。 */
export function createBackgroundMusic(intent: MusicIntent = 'playing', volume: number = BACKGROUND_MUSIC_VOLUME): BackgroundMusic {
  return setBackgroundMusicVolume({ intent, status: 'paused', volume: BACKGROUND_MUSIC_VOLUME, resumeRequired: false }, volume);
}

/** 音量写入口：越界与非法值都被归一化，界面与 audio 元素共用同一个值。 */
export function setBackgroundMusicVolume(state: BackgroundMusic, volume: number): BackgroundMusic {
  if (!Number.isFinite(volume)) return state;
  const nextVolume = Math.min(1, Math.max(0, volume));
  return nextVolume === state.volume ? state : { ...state, volume: nextVolume };
}

export function toggleBackgroundMusic(state: BackgroundMusic): BackgroundMusic {
  const intent: MusicIntent = state.intent === 'playing' ? 'paused' : 'playing';
  return { ...state, intent, status: intent === 'paused' ? 'paused' : state.status, resumeRequired: false };
}

/** 页面隐藏时只表达程序性暂停；回前台由 resumeRequired 阻止自动恢复。 */
export function setBackgroundMusicVisibility(state: BackgroundMusic, visible: boolean): BackgroundMusic {
  if (visible || state.intent !== 'playing') return state;
  return { ...state, status: 'paused', resumeRequired: true };
}

/** 用户主动恢复程序性暂停；实际播放仍由主题的 shouldPlay 副作用驱动。 */
export function clearBackgroundMusicResume(state: BackgroundMusic): BackgroundMusic {
  if (!state.resumeRequired) return state;
  return { ...state, status: 'paused', resumeRequired: false };
}

export function setBackgroundMusicStatus(state: BackgroundMusic, status: MusicStatus): BackgroundMusic {
  return { ...state, status };
}

/** 自动播放被拒绝：保留播放意图并标记 blocked，界面仍按未播放呈现；
 * 意图一旦回退会让 shouldPlay 副作用把状态覆盖回 paused，首手势恢复就无从触发。 */
export function markBackgroundMusicBlocked(state: BackgroundMusic): BackgroundMusic {
  return { ...state, status: 'blocked' };
}

export function shouldPlayBackgroundMusic(
  state: BackgroundMusic,
  options: { documentVisible: boolean; blockedByVideo: boolean },
): boolean {
  return state.intent === 'playing'
    && !state.resumeRequired
    && options.documentVisible
    && !options.blockedByVideo;
}

export function isBackgroundMusicPlaying(state: BackgroundMusic): boolean {
  return state.status === 'playing';
}

/** 用户显式偏好（意图 + 音量）的本地缓存键与读写契约；storage 注入以便测试与不可用环境降级。 */
export const BACKGROUND_MUSIC_STORAGE_KEY = 'wangleyou:background-music';

export type BackgroundMusicPreference = { intent: MusicIntent; volume: number };

export function readBackgroundMusicPreference(storage: Pick<Storage, 'getItem'> | null): BackgroundMusicPreference {
  const fallback: BackgroundMusicPreference = { intent: 'playing', volume: BACKGROUND_MUSIC_VOLUME };
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(BACKGROUND_MUSIC_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const { intent, volume } = parsed as { intent?: unknown; volume?: unknown };
    const nextIntent = intent === 'paused' || intent === 'playing' ? intent : fallback.intent;
    const nextVolume = setBackgroundMusicVolume(
      { intent: fallback.intent, status: 'paused', volume: fallback.volume, resumeRequired: false },
      typeof volume === 'number' ? volume : Number.NaN,
    ).volume;
    return { intent: nextIntent, volume: nextVolume };
  } catch {
    return fallback;
  }
}

export function writeBackgroundMusicPreference(storage: Pick<Storage, 'setItem'> | null, preference: BackgroundMusicPreference): void {
  if (!storage) return;
  try {
    storage.setItem(BACKGROUND_MUSIC_STORAGE_KEY, JSON.stringify({ intent: preference.intent, volume: preference.volume }));
  } catch {
    // 存储不可用（隐私模式等）时静默降级，不影响播放行为。
  }
}
