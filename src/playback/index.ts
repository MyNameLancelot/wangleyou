export {
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
} from './session';
export type { PlaybackIntent, PlaybackStatus, Session } from './session';
export { clearLastPlayed, LAST_PLAYED_KEY, readLastPlayed, resolveLastPlayed, safeStorage, writeLastPlayed } from './last-played';
export type { LastPlayed } from './last-played';
