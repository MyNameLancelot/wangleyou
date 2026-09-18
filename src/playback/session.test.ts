import { describe, expect, it } from 'vitest';

import type { Album, Media } from '../content';
import {
  currentMedia,
  handleEnded,
  isVideo,
  markPlaybackError,
  openSession,
  setContinuous,
  setIntent,
  setProgress,
  setStatus,
  stepSession,
} from './index';

const photos: Media[] = [
  { id: 'p1', type: 'photo', src: 'media/one.jpg' },
  { id: 'p2', type: 'photo', src: 'media/two.jpg' },
];

const mixed: Media[] = [
  { id: 'v1', type: 'video', src: 'media/clip.mp4', poster: 'media/thumbs/one.webp' },
  { id: 'p1', type: 'photo', src: 'media/one.jpg' },
  { id: 'v2', type: 'video', src: 'media/clip-2.mp4' },
];

describe('播放会话', () => {
  it('未知媒体或空队列返回 null', () => {
    expect(openSession(photos, 'missing')).toBeNull();
    expect(openSession([], 'p1')).toBeNull();
  });

  it('照片进入时意图与状态都是暂停，视频进入时为播放意图', () => {
    expect(openSession(photos, 'p1')).toMatchObject({ index: 0, intent: 'paused', status: 'paused', progress: 0 });
    expect(openSession(mixed, 'v1')).toMatchObject({ index: 0, intent: 'playing', status: 'loading' });
  });

  it('队列同时包含照片与视频，按索引推进且越界保持原会话', () => {
    const session = openSession(mixed, 'p1');
    expect(session).not.toBeNull();
    const atEnd = stepSession(session, 1);
    expect(atEnd).toMatchObject({ index: 2 });
    const atStart = stepSession(session, -1);
    expect(atStart).toMatchObject({ index: 0 });
    expect(stepSession(atStart, -1)).toBe(atStart);
    expect(stepSession(atEnd, 1)).toBe(atEnd);
    expect(stepSession(session, 5)).toBe(session);
    expect(stepSession(session, 1.5)).toBe(session);
    expect(currentMedia(session)?.id).toBe('p1');
  });

  it('切换媒体时重置进度与时长并应用新媒体的初始播放语义', () => {
    const withProgress = setProgress(openSession(mixed, 'v1'), 0.5, 30);
    const next = stepSession(withProgress, 1);
    expect(next).toMatchObject({ index: 1, progress: 0, duration: 0, intent: 'paused', status: 'paused' });
  });

  it('意图与实际状态分离：真实暂停不改写用户意图', () => {
    const playing = setIntent(openSession(mixed, 'v1'), 'playing');
    const buffering = setStatus(playing, 'loading');
    expect(buffering).toMatchObject({ intent: 'playing', status: 'loading' });
    const paused = setIntent(buffering, 'paused');
    expect(paused).toMatchObject({ intent: 'paused', status: 'loading' });
  });

  it('连续播放开启时视频结束后前进并继续播放', () => {
    const session = openSession(mixed, 'v1');
    const ended = handleEnded(session);
    expect(ended).toMatchObject({ index: 1, intent: 'paused', status: 'paused' });
  });

  it('连续播放关闭或已到队尾时停在当前项并标记结束', () => {
    const single: Media[] = [{ id: 'v1', type: 'video', src: 'media/clip.mp4' }];
    const only = openSession(single, 'v1');
    expect(handleEnded(only)).toMatchObject({ index: 0, intent: 'paused', status: 'ended', progress: 1 });

    const closed = setContinuous(openSession(mixed, 'v1'), false);
    expect(handleEnded(closed)).toMatchObject({ index: 0, status: 'ended' });
  });

  it('进度被限制在 0–1 且非法时长归零', () => {
    const session = openSession(mixed, 'v1');
    expect(setProgress(session, 1.4, 30)).toMatchObject({ progress: 1, duration: 30 });
    expect(setProgress(session, -1, -5)).toMatchObject({ progress: 0, duration: 0 });
    expect(setProgress(session, Number.NaN, 30)).toMatchObject({ progress: 0, duration: 30 });
  });

  it('播放失败保留当前项供界面重试或跳到下一项', () => {
    expect(markPlaybackError(openSession(mixed, 'v1'))).toMatchObject({ index: 0, status: 'error', intent: 'paused' });
  });

  it('类型守卫与相册内容配合：媒体类型来自内容配置', () => {
    const album: Album = { id: 'a', title: '相册', media: mixed };
    const session = openSession(album.media, 'v2');
    expect(isVideo(currentMedia(session))).toBe(true);
    expect(isVideo(album.media[1])).toBe(false);
    expect(isVideo(null)).toBe(false);
  });
});
