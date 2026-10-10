import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import styles from './ThemeHome.module.css';

const DURATION = 900;
const LOAD_TIMEOUT = 5_000;

/** 正常收束页与离场快照共用内容，避免回翻出现空纸。 */
export function EndingContent() {
  return <><span className={styles.endingRule} aria-hidden="true" /><p>翻到这里，先把书轻轻合上<br />这些日子没有走远<br />想念的时候，随时回来看看</p><span className={styles.endingMark} aria-hidden="true">❦</span></>;
}

/** 叠页层的完整旧纸片快照；输入层保留自身的响应式图片与加载状态。 */
export function PhotoTransition({ src, direction, targetRef, onComplete }: {
  src: string | null;
  direction: -1 | 1;
  targetRef: RefObject<HTMLElement | null>;
  onComplete(): void;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const outgoingRef = useRef<HTMLDivElement | null>(null);
  const completeRef = useRef(onComplete);
  useLayoutEffect(() => { completeRef.current = onComplete; }, [onComplete]);

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    const outgoing = outgoingRef.current;
    const incoming = targetRef.current;
    if (!overlay || !outgoing || !incoming) return;
    const image = incoming.querySelector('img');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let active = true;
    let started = false;
    let timeout: number | undefined;
    const animations: Animation[] = [];

    const stopWaiting = () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      timeout = undefined;
      image?.removeEventListener('load', start);
      image?.removeEventListener('error', start);
    };
    const cleanup = () => {
      stopWaiting();
      document.removeEventListener('visibilitychange', interrupt);
      preference.removeEventListener('change', interrupt);
      window.removeEventListener('resize', finish);
      animations.forEach(animation => animation.cancel());
    };
    const finish = () => {
      if (!active) return;
      active = false;
      // cancel() removes the filled end pose before React removes this snapshot.
      // Hide it first so neither the outgoing photo nor its old stacking order can flash back.
      overlay.style.visibility = 'hidden';
      cleanup();
      completeRef.current();
    };
    const interrupt = () => {
      if (document.visibilityState === 'hidden' || preference.matches) finish();
    };
    function start() {
      if (!active || started) return;
      started = true;
      stopWaiting();
      if (document.visibilityState === 'hidden' || preference.matches || typeof incoming!.animate !== 'function') {
        finish();
        return;
      }
      overlay!.dataset.phase = 'moving';
      const sheet = incoming!.closest<HTMLElement>('[data-book-page="front"]');
      if (!sheet) { finish(); return; }
      // The bottom-left corner moves left by height * sin(angle). Use the unrotated
      // sheet height and leave a small viewport margin; every size keeps the same rhythm.
      const leftSpace = Math.max(0, overlay!.getBoundingClientRect().left - 8);
      const angle = Math.min(28, Math.asin(Math.min(1, leftSpace / outgoing!.offsetHeight)) * 180 / Math.PI);
      const options: KeyframeAnimationOptions = { duration: DURATION, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' };
      const frames: Keyframe[] = [
        { transform: 'rotate(.35deg)', opacity: 1, offset: 0 },
        { transform: `rotate(${angle * 10 / 28}deg)`, opacity: 1, offset: .45 },
        { transform: `rotate(${angle}deg)`, opacity: 0, offset: 1 },
      ];
      if (direction === 1) {
        animations.push(outgoing!.animate(frames, options));
      } else {
        // The previous photo returns above the current snapshot, with the same fixed hinge.
        animations.push(sheet.animate(frames.map(frame => ({ ...frame, zIndex: 6 })), { ...options, direction: 'reverse' }));
      }
      // cancel() rejects finished; interrupted/unmounted transitions must never call back later.
      void Promise.all(animations.map(animation => animation.finished)).then(finish, () => {});
    }

    document.addEventListener('visibilitychange', interrupt);
    preference.addEventListener('change', interrupt);
    window.addEventListener('resize', finish);
    if (document.visibilityState === 'hidden' || preference.matches) finish();
    else if (!image || image.complete) start();
    else {
      image.addEventListener('load', start);
      image.addEventListener('error', start);
      timeout = window.setTimeout(finish, LOAD_TIMEOUT);
    }
    return () => {
      active = false;
      cleanup();
    };
  }, [src, direction, targetRef]);

  return <div ref={overlayRef} className={styles.pivotTransition} aria-hidden="true" data-testid="home-photo-transition" data-direction={direction} data-phase="waiting">
    <div ref={outgoingRef} className={`${styles.sheet} ${styles.sheetFront} ${styles.pivotSheet}`}>
      <span className={styles.photoViewport}><span className={`${styles.photoContent} ${src ? '' : styles.ending}`}>
        {src ? <img className={styles.snapshot} src={src} alt="" draggable={false} /> : <EndingContent />}
      </span></span>
    </div>
  </div>;
}
