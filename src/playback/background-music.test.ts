import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_MUSIC_STORAGE_KEY,
  createBackgroundMusic,
  clearBackgroundMusicResume,
  isBackgroundMusicPlaying,
  markBackgroundMusicBlocked,
  readBackgroundMusicPreference,
  setBackgroundMusicStatus,
  setBackgroundMusicVisibility,
  setBackgroundMusicVolume,
  shouldPlayBackgroundMusic,
  toggleBackgroundMusic,
  writeBackgroundMusicPreference,
} from './background-music';

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

describe('背景音乐状态', () => {
  it('默认希望播放但实际状态是尚未播放', () => {
    const music = createBackgroundMusic();
    expect(music).toEqual({ intent: 'playing', status: 'paused', volume: 0.5, resumeRequired: false });
    expect(isBackgroundMusicPlaying(music)).toBe(false);
  });

  it('切换意图时暂停会立即反映为暂停状态', () => {
    const playing = setBackgroundMusicStatus(createBackgroundMusic(), 'playing');
    const paused = toggleBackgroundMusic(playing);
    expect(paused).toEqual({ intent: 'paused', status: 'paused', volume: 0.5, resumeRequired: false });
    expect(toggleBackgroundMusic(paused).intent).toBe('playing');
  });

  it('自动播放被拒绝时保留播放意图并标记 blocked', () => {
    expect(markBackgroundMusicBlocked(createBackgroundMusic())).toEqual({
      intent: 'playing',
      status: 'blocked',
      volume: 0.5,
      resumeRequired: false,
    });
  });

  it('页面隐藏记录程序性暂停，回前台等待用户显式恢复', () => {
    const playing = setBackgroundMusicStatus(createBackgroundMusic(), 'playing');
    const hidden = setBackgroundMusicVisibility(playing, false);
    expect(hidden).toEqual({ intent: 'playing', status: 'paused', volume: 0.5, resumeRequired: true });
    expect(shouldPlayBackgroundMusic(hidden, { documentVisible: true, blockedByVideo: false })).toBe(false);
    expect(clearBackgroundMusicResume(hidden)).toEqual({
      intent: 'playing',
      status: 'paused',
      volume: 0.5,
      resumeRequired: false,
    });
    expect(setBackgroundMusicVisibility(hidden, true)).toBe(hidden);
  });

  it('暂停态和显式切换不受前台待恢复影响', () => {
    const pausedByIntent = toggleBackgroundMusic(setBackgroundMusicStatus(createBackgroundMusic(), 'playing'));
    const fresh = createBackgroundMusic();
    expect(setBackgroundMusicVisibility(pausedByIntent, false)).toBe(pausedByIntent);
    expect(clearBackgroundMusicResume(pausedByIntent)).toBe(pausedByIntent);
    expect(clearBackgroundMusicResume(fresh)).toBe(fresh);
  });

  it('只有意图播放、页面可见且视频未占用时才应播放', () => {
    const music = createBackgroundMusic();
    expect(shouldPlayBackgroundMusic(music, { documentVisible: true, blockedByVideo: false })).toBe(true);
    expect(shouldPlayBackgroundMusic(music, { documentVisible: false, blockedByVideo: false })).toBe(false);
    expect(shouldPlayBackgroundMusic(music, { documentVisible: true, blockedByVideo: true })).toBe(false);
    expect(shouldPlayBackgroundMusic(toggleBackgroundMusic(music), { documentVisible: true, blockedByVideo: false })).toBe(false);
  });

  it('音量写入会归一化越界与非法值', () => {
    const music = createBackgroundMusic();
    expect(setBackgroundMusicVolume(music, 0.8).volume).toBe(0.8);
    expect(setBackgroundMusicVolume(music, 2).volume).toBe(1);
    expect(setBackgroundMusicVolume(music, -1).volume).toBe(0);
    expect(setBackgroundMusicVolume(music, Number.NaN)).toBe(music);
    expect(setBackgroundMusicVolume(setBackgroundMusicVolume(music, 0.8), 0.8).volume).toBe(0.8);
  });
});

describe('背景音乐本地偏好', () => {
  it('createBackgroundMusic 支持注入初始音量并归一化', () => {
    expect(createBackgroundMusic('paused', 0.3).volume).toBe(0.3);
    expect(createBackgroundMusic('playing', 9).volume).toBe(1);
  });

  it('storage 为 null、无值或内容非法时回退默认偏好', () => {
    expect(readBackgroundMusicPreference(null)).toEqual({ intent: 'playing', volume: 0.5 });
    expect(readBackgroundMusicPreference(memoryStorage())).toEqual({ intent: 'playing', volume: 0.5 });
    expect(readBackgroundMusicPreference(memoryStorage({ [BACKGROUND_MUSIC_STORAGE_KEY]: 'not-json{' })))
      .toEqual({ intent: 'playing', volume: 0.5 });
    expect(readBackgroundMusicPreference(memoryStorage({ [BACKGROUND_MUSIC_STORAGE_KEY]: JSON.stringify({ intent: 'loud' }) })))
      .toEqual({ intent: 'playing', volume: 0.5 });
    expect(readBackgroundMusicPreference(memoryStorage({ [BACKGROUND_MUSIC_STORAGE_KEY]: JSON.stringify({ intent: 'paused', volume: 9 }) })))
      .toEqual({ intent: 'paused', volume: 1 });
  });

  it('读取合法缓存并归一化音量', () => {
    const storage = memoryStorage({ [BACKGROUND_MUSIC_STORAGE_KEY]: JSON.stringify({ intent: 'paused', volume: 0.2 }) });
    expect(readBackgroundMusicPreference(storage)).toEqual({ intent: 'paused', volume: 0.2 });
  });

  it('写入偏好；storage 为 null 或写入抛错时静默降级', () => {
    const storage = memoryStorage();
    writeBackgroundMusicPreference(storage, { intent: 'paused', volume: 0.7 });
    expect(storage.map.get(BACKGROUND_MUSIC_STORAGE_KEY)).toBe(JSON.stringify({ intent: 'paused', volume: 0.7 }));
    expect(() => writeBackgroundMusicPreference(null, { intent: 'playing', volume: 0.7 })).not.toThrow();
    const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    expect(() => writeBackgroundMusicPreference(broken, { intent: 'playing', volume: 0.7 })).not.toThrow();
  });
});
