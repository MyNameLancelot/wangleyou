import { useState } from 'react';
import styles from './PhotoImage.module.css';

type Props = { src: string; alt: string; className?: string; width?: number; height?: number; eager?: boolean };
function ImageState({ src, alt, className, width, height, eager }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return <span className={`${styles.frame} ${className || ''}`}>
    {status === 'error' ? <span className={styles.error} role="status">照片暂时无法加载</span> : <img src={src} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />}
  </span>;
}
export function PhotoImage(props: Props) { return <ImageState key={props.src} {...props} />; }
