import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, applyTheme, isThemeName, nextTheme, readTheme } from './index';

function createStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    value: (key: string) => map.get(key) ?? null,
  };
}

function createRoot() {
  const attributes = new Map<string, string>();
  return { setAttribute: (name: string, value: string) => void attributes.set(name, value), get: (name: string) => attributes.get(name) ?? null };
}

describe('主题运行时', () => {
  it('缺省与非法值都回退到站点默认的海边主题', () => {
    expect(DEFAULT_THEME).toBe('beach');
    expect(readTheme(createStorage())).toBe('beach');
    expect(readTheme(createStorage({ [THEME_STORAGE_KEY]: 'sunset' }))).toBe('beach');
    expect(isThemeName('sunset')).toBe(false);
  });

  it('读取已保存的三套主题模式', () => {
    for (const theme of THEMES) {
      expect(readTheme(createStorage({ [THEME_STORAGE_KEY]: theme }))).toBe(theme);
    }
  });

  it('应用主题时写入 data-theme 并持久化偏好', () => {
    const root = createRoot();
    const storage = createStorage();
    expect(applyTheme('beach', root, storage)).toBe('beach');
    expect(root.get('data-theme')).toBe('beach');
    expect(storage.value(THEME_STORAGE_KEY)).toBe('beach');
  });

  it('非法主题名回退默认主题而不是写入脏值', () => {
    const root = createRoot();
    const storage = createStorage();
    expect(applyTheme('desert', root, storage)).toBe('beach');
    expect(root.get('data-theme')).toBe('beach');
    expect(storage.value(THEME_STORAGE_KEY)).toBe('beach');
  });

  it('存储抛错时仍应用主题', () => {
    const root = createRoot();
    const broken = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    };
    expect(readTheme(broken)).toBe('beach');
    expect(applyTheme('grassland', root, broken)).toBe('grassland');
    expect(root.get('data-theme')).toBe('grassland');
  });

  it('按顺序循环切换三套主题', () => {
    expect(THEMES).toEqual(['beach', 'grassland']);
    expect(nextTheme('beach')).toBe('grassland');
    expect(nextTheme('grassland')).toBe('beach');
    expect(nextTheme('unknown')).toBe('grassland');
  });
});
