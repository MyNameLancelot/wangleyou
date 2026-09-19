export type { ThemeApp, ThemeAppProps, ThemeViewerCommands } from './contracts';
export { BeachApp } from './beach';
export { GrasslandApp } from './grassland';

/** 产品只交付两套主题；数组顺序就是切换顺序。 */
export const THEMES = ['beach', 'grassland'] as const;
export type ThemeName = (typeof THEMES)[number];

/** 海边沙滩是站点默认外观。 */
export const DEFAULT_THEME: ThemeName = 'beach';

export const THEME_STORAGE_KEY = 'wangleyou.theme';

export const THEME_LABELS: Record<ThemeName, string> = {
  beach: '海边主题',
  grassland: '草原主题',
};

export const THEME_SHORT_LABELS: Record<ThemeName, string> = {
  beach: '海边',
  grassland: '草原',
};

/** 主题背景层插画（见 public/media/SOURCES.md）。 */
export const THEME_HERO_ASSETS: Record<ThemeName, string | null> = {
  beach: 'media/theme/beach-home-hero-2k.webp',
  grassland: 'media/theme/grassland-hero.webp',
};

/**
 * 主题文案 Slot：只承载主题语气，不承载相册数据。
 * 相册标题、数量、日期仍全部来自 content 配置。
 */
export const THEME_COPY: Record<ThemeName, { eyebrow: string; title: string; subtitle: string; footNote: string }> = {
  beach: {
    eyebrow: 'LeYou • Growing Moments',
    title: '把有海风的日子，留在这里。',
    subtitle: '照片、视频与那些值得重看的片刻。',
    footNote: '潮线只作陪衬 · 回忆始终是主角',
  },
  grassland: {
    eyebrow: '沿着地平线看回忆',
    title: '把辽阔的日子，慢慢收好。',
    subtitle: '阳光、远山与那些舍不得快进的片刻。',
    footNote: '远山只作陪衬 · 回忆始终是主角',
  },
};

type ThemeRoot = { setAttribute(name: string, value: string): void };
type ThemeStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** 浏览器禁用存储或处于隐私模式时静默降级为无持久化。 */
function safeStorage(): ThemeStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readTheme(storage: ThemeStorage | null = safeStorage()): ThemeName {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isThemeName(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** 应用主题：写 data-theme 并记住偏好；非法值回退默认主题。返回值是实际生效的主题。 */
export function applyTheme(
  name: unknown,
  root: ThemeRoot | null = typeof document === 'undefined' ? null : document.documentElement,
  storage: ThemeStorage | null = safeStorage(),
): ThemeName {
  const theme = isThemeName(name) ? name : DEFAULT_THEME;
  root?.setAttribute('data-theme', theme);
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* 存储不可用时仍应用主题 */
  }
  return theme;
}

/** 按 THEMES 顺序循环切换，非法输入从默认主题开始。 */
export function nextTheme(current: unknown): ThemeName {
  const index = THEMES.indexOf(isThemeName(current) ? current : DEFAULT_THEME);
  return THEMES[(index + 1) % THEMES.length];
}

/** 启动时应用已保存偏好；主题切换不改变路由、媒体与播放上下文。 */
export function initTheme(): ThemeName {
  return applyTheme(readTheme());
}
