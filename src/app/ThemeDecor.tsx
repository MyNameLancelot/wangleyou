import styles from './ThemeDecor.module.css';

/**
 * 主题装饰 Slot：纯 CSS 图形，不使用外部素材。
 * 只表达主题背景语言，永远 aria-hidden、不接收指针事件，也不参与布局。
 */
export function ThemeDecor() {
  return <div className={styles.decor} data-testid="theme-decor" aria-hidden="true">
    <span className={`${styles.shape} ${styles.wave}`} />
    <span className={`${styles.shape} ${styles.hill}`} />
    <span className={`${styles.shape} ${styles.dotA}`} />
    <span className={`${styles.shape} ${styles.dotB}`} />
  </div>;
}
