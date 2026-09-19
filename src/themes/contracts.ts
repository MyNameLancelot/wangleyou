import type { ReactElement } from 'react';
import type { Album, SiteContent } from '../content';
import type { Session, PlaybackStatus } from '../playback';
import type { Route } from '../app';
import type { ThemeName } from './index';

/** 主题 UI 只接收业务命令，不拥有 Session。 */
export interface ThemeViewerCommands {
  step(delta: number): void;
  close(): void;
  toggleIntent(): void;
  toggleContinuous(): void;
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
  session: Session | null;
  commands: ThemeViewerCommands;
  onOpen(album: Album, id: string): void;
  onSwitchTheme(): void;
  theme: ThemeName;
  online: boolean;
  contentErrorMessage: string | null;
}

export type ThemeApp = (props: ThemeAppProps) => ReactElement;
