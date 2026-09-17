import { useState } from 'react';
import styles from './PhotoImage.module.css';

type Props = { src: string; alt: string; className?: string; width?: number; height?: number; eager?: boolean };

/** 首次加载显示骨架，失败显示可读文案而不是空白；两态都不是仅靠颜色区分。 */
function ImageState({ src, alt, className, width, height, eager }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return <span className={`${styles.frame} ${className || ''}`} aria-busy={status === 'loading'}>
    {status === 'loading' && <span className={styles.skeleton} data-testid="media-skeleton" aria-hidden="true" />}
    {status === 'error'
      ? <span className={styles.error} role="status"><span aria-hidden="true">⚠</span> 影像暂时无法加载</span>
      : <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setStatus('ready')} onError={() => setStatus('error')} style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }} />}
  </span>;
}

export function PhotoImage(props: Props) { return <ImageState key={props.src} {...props} />; }
