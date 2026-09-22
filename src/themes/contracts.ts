import type { ReactElement } from 'react';
import type { Album, HomeMemoryPhoto, SiteContent } from '../content';
import type { Session, PlaybackStatus } from '../playback';
import type { BackgroundMusic, MusicStatus } from '../playback';
import type { Route } from '../shared';

/** 主题 UI 只接收业务命令，不拥有 Session。 */
export interface ThemeViewerCommands {
  step(delta: number): void;
  close(): void;
  toggleIntent(): void;
  reportProgress(progress: number, duration: number): void;
  reportStatus(status: PlaybackStatus): void;
  reportEnded(): void;
  reportError(): void;
  reportBlocked(): void;
}

/** 允许主题应用使用的无 UI 装配契约。 */
export interface ThemeAppProps {
  route: Route;
  content: SiteContent;
  homeMemory: HomeMemoryPhoto[];
  session: Session | null;
  commands: ThemeViewerCommands;
  music: BackgroundMusic;
  musicCommands: ThemeMusicCommands;
  onOpen(album: Album, id: string): void;
  onSwitchTheme(): void;
  online: boolean;
  contentErrorMessage: string | null;
}

/** 背景音乐命令：主题只负责渲染各自的控制图标。 */
export interface ThemeMusicCommands {
  toggle(): void;
  setVolume(volume: number): void;
  reportStatus(status: MusicStatus): void;
  reportBlocked(): void;
  reportVisibility(visible: boolean): void;
  resume(): void;
}

export type ThemeApp = (props: ThemeAppProps) => ReactElement;
