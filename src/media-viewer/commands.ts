import type { Media } from '../content';
import type { PlaybackIntent, PlaybackStatus } from '../playback';

/** 查看器命令：主题与 App 只负责装配，不拥有查看器状态。 */
export interface MediaViewerCommands {
  /** 查看器内部翻页后回写会话索引；会话仍是索引的唯一事实来源。 */
  stepTo(index: number): void;
  close(): void;
  reportProgress(progress: number, duration: number): void;
  reportStatus(status: PlaybackStatus): void;
  reportIntent(intent: PlaybackIntent): void;
  reportVisibility(visible: boolean): void;
  reportEnded(): void;
  reportError(): void;
  reportBlocked(media: Media[], index: number): void;
}
