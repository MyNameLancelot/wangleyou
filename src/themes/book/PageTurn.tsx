import { useEffect, useId, useRef, useState } from 'react';
import styles from './ThemeHome.module.css';

const DURATION = 900;
const WIDTH = 900;
const HEIGHT = 600;

/** 单页范围内的卷页；正反翻共用同一几何，动画帧在卸载时取消。 */
export function PageTurn({ src, direction, onComplete }: {
  src: string | null;
  direction: -1 | 1;
  onComplete(): void;
}) {
  const [progress, setProgress] = useState(direction === 1 ? 0 : 1);
  const completeRef = useRef(onComplete);
  const id = useId();
  useEffect(() => { completeRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    let frame = 0;
    let start: number | undefined;
    const tick = (now: number) => {
      start ??= now;
      const elapsed = Math.min((now - start) / DURATION, 1);
      // 连续加速和减速，不在关键帧交界处停顿。
      const eased = elapsed - Math.sin(elapsed * Math.PI * 2) / (Math.PI * 2);
      setProgress(direction === 1 ? eased : 1 - eased);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
      else completeRef.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [direction]);

  const lift = Math.sin(progress * Math.PI);
  const edge = WIDTH * (1 - progress);
  const top = edge - 42 * lift;
  const bottom = edge + 42 * lift;
  const curl = 150 * lift;
  const bow = 28 * lift;
  const edgeCurve = `C ${top + bow} 190 ${bottom + bow} 420 ${bottom} ${HEIGHT}`;
  const pagePath = `M 0 0 H ${top} ${edgeCurve} H 0 Z`;
  const backPath = `M ${top} 0 ${edgeCurve} C ${bottom - curl * .8} 580 ${top - curl * 1.15} 70 ${top} 0 Z`;
  const shadowPath = `M ${top} 0 ${edgeCurve} L ${bottom + 40 * lift} ${HEIGHT} C ${bottom + bow + 40 * lift} 420 ${top + bow + 40 * lift} 190 ${top + 40 * lift} 0 Z`;

  return <div className={styles.flip} aria-hidden="true" data-testid="book-turning-page" data-direction={direction}>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" focusable="false">
      <defs>
        <clipPath id={`${id}-page`}><path d={pagePath} /></clipPath>
        <linearGradient id={`${id}-paper`} gradientUnits="userSpaceOnUse" x1={edge - curl} x2={edge + bow}>
          <stop offset="0" stopColor="#c4ab8b" />
          <stop offset=".3" stopColor="#f1e2cb" />
          <stop offset=".72" stopColor="#fff9ee" />
          <stop offset="1" stopColor="#dfc8aa" />
        </linearGradient>
        <linearGradient id={`${id}-shadow`} gradientUnits="userSpaceOnUse" x1={edge - 30 * lift} x2={edge + 65 * lift}>
          <stop stopColor="#4f3425" stopOpacity=".25" />
          <stop offset="1" stopColor="#4f3425" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-soft-shadow`} x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="7" /></filter>
      </defs>
      <path d={shadowPath} fill={`url(#${id}-shadow)`} filter={`url(#${id}-soft-shadow)`} opacity={lift} />
      <g clipPath={`url(#${id}-page)`}>
        <rect width={WIDTH} height={HEIGHT} rx="2" fill="#fffaf0" stroke="#e7d6c0" strokeWidth="2" />
        {src && <image href={src} x="14.4" y="14.4" width="871.2" height="571.2" preserveAspectRatio="xMidYMid slice" />}
      </g>
      <path d={backPath} fill={`url(#${id}-paper)`} stroke="#cdb697" strokeWidth=".7" opacity={Math.min(lift * 12, 1)} />
    </svg>
  </div>;
}
