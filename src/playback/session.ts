import type { Media, Video } from '../content';

/** 用户意图：用户想要播放还是暂停。与真实播放状态分离，不因自动暂停或加载失败而改写。 */
export type PlaybackIntent = 'paused' | 'playing';

/** 实际状态：由播放器回报，viewer 只负责转发命令。 */
export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export interface Session {
  /** 播放队列：照片与视频共用同一条队列。 */
  media: Media[];
  index: number;
  intent: PlaybackIntent;
  status: PlaybackStatus;
  /** 当前媒体的播放进度，0–1；照片恒为 0。 */
  progress: number;
  /** 当前媒体时长（秒）；未知为 0。 */
  duration: number;
}

export function isVideo(media: Media | null | undefined): media is Video {
  return media?.type === 'video';
}

export function currentMedia(session: Session | null): Media | null {
  return session ? session.media[session.index] ?? null : null;
}

/** 照片没有播放语义：进入照片时意图与实际状态都回到暂停。 */
function initialPlayback(media: Media): Pick<Session, 'intent' | 'status'> {
  return isVideo(media) ? { intent: 'playing', status: 'loading' } : { intent: 'paused', status: 'paused' };
}

export function openSession(media: Media[], id: string): Session | null {
  const index = media.findIndex(item => item.id === id);
  if (index === -1) return null;
  return {
    media: [...media],
    index,
    ...initialPlayback(media[index]),
    progress: 0,
    duration: 0,
  };
}

/** 越界与非法 delta 保持原会话，不循环。 */
export function stepSession(session: Session | null, delta: number): Session | null {
  if (!session || !Number.isInteger(delta)) return session;
  const index = session.index + delta;
  if (index < 0 || index >= session.media.length) return session;
  return { ...session, index, ...initialPlayback(session.media[index]), progress: 0, duration: 0 };
}

/**
 * 查看器（lightbox）内部翻页后回写索引：会话始终是索引的唯一事实来源，
 * 越界、非整数或原地不动都保持原会话。
 */
export function stepSessionTo(session: Session | null, index: number): Session | null {
  if (!session || !Number.isInteger(index)) return session;
  if (index === session.index || index < 0 || index >= session.media.length) return session;
  return { ...session, index, ...initialPlayback(session.media[index]), progress: 0, duration: 0 };
}

export function setIntent(session: Session | null, intent: PlaybackIntent): Session | null {
  return session && session.intent !== intent ? { ...session, intent } : session;
}

export function setStatus(session: Session | null, status: PlaybackStatus): Session | null {
  return session && session.status !== status ? { ...session, status } : session;
}

export function setProgress(session: Session | null, progress: number, duration: number): Session | null {
  if (!session) return session;
  const bounded = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return bounded === session.progress && safeDuration === session.duration ? session : { ...session, progress: bounded, duration: safeDuration };
}

/**
 * 视频自然结束永远停在当前项；队列移动必须来自用户显式命令。
 */
export function handleEnded(session: Session | null): Session | null {
  if (!session) return session;
  return { ...session, intent: 'paused', status: 'ended', progress: 1 };
}

/** 视频无法播放：保留当前项，给出错误状态供界面提供重试或下一项。 */
export function markPlaybackError(session: Session | null): Session | null {
  return session ? { ...session, status: 'error', intent: 'paused' } : session;
}
