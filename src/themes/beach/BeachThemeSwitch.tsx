import { RefreshCw } from 'lucide-react';
import { LiquidGlass } from 'react-liquid-glass-svg';
import styles from './BeachThemeSwitch.module.css';

export function BeachThemeSwitch({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className={styles.dock} data-testid="theme-switch">
      <button className={styles.button} type="button" onClick={onSwitch} aria-label="切换主题，当前是海边主题">
        <LiquidGlass
          as="span"
          className={styles.surface}
          backdropBlur={10}
          tintColor="rgba(226, 249, 252, 0.30)"
          displacementScale={68}
          style={{boxShadow: 'none'}}
          data-theme-switch-surface
        >
          <RefreshCw className={styles.icon} strokeWidth={2.1} aria-hidden="true" data-theme-switch-icon="cycle" />
          <span className={styles.label}>主题切换</span>
        </LiquidGlass>
      </button>
    </div>
  );
}
