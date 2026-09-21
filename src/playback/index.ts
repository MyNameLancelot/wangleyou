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
export {
  BACKGROUND_MUSIC_VOLUME,
  BACKGROUND_MUSIC_STORAGE_KEY,
  clearBackgroundMusicResume,
  createBackgroundMusic,
  isBackgroundMusicPlaying,
  markBackgroundMusicBlocked,
  readBackgroundMusicPreference,
  setBackgroundMusicVisibility,
  setBackgroundMusicStatus,
  setBackgroundMusicVolume,
  shouldPlayBackgroundMusic,
  toggleBackgroundMusic,
  writeBackgroundMusicPreference,
} from './background-music';
export type { BackgroundMusic, BackgroundMusicPreference, MusicIntent, MusicStatus } from './background-music';
