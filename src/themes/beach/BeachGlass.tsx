import type { ReactNode } from 'react';
import { LiquidGlass } from 'react-liquid-glass-svg';
import styles from './BeachGlass.module.css';

type BeachGlassProps = { children: ReactNode } & Record<`data-${string}`, string | boolean>;

/** 海边主题专用玻璃表面：库负责折射，主题只定义布局、投影与降级；不使用库的白色高光边。 */
export function BeachGlass({ children, ...dataAttrs }: BeachGlassProps) {
  return <LiquidGlass
    className={styles.surface}
    backdropBlur={8}
    tintColor="rgba(237, 252, 255, 0.24)"
    displacementScale={115}
    style={{boxShadow: '0 28px 64px rgb(0 55 75 / 22%), 0 8px 20px rgb(0 55 75 / 12%)'}}
    {...dataAttrs}
  >{children}</LiquidGlass>;
}
