import { useEffect } from 'react';
import { observeViewerMedia } from './observeViewerMedia';

/** 只拥有影像测量、观察器及动画帧，不保存业务状态。 */
export function useViewerCaptionLayout(index: number, slides: readonly unknown[], thumbnailsVisible: boolean, fullscreen: boolean) {
  /**
   * 寄语贴在当前影像的左下角：量出影像相对舞台的位置，把换算结果写成查看器根节点上的
   * 自定义属性，由共用样式消费（影像没渲染出来时清掉，退回舞台左下角）。
   */
  useEffect(() => {
    const properties = ['--viewer-caption-left', '--viewer-caption-bottom', '--viewer-caption-max-width', '--viewer-caption-max-height', '--viewer-caption-padding-x', '--viewer-caption-padding-y']
    const clear = (root: HTMLElement | null | undefined) => {
      for (const name of properties) root?.style.removeProperty(name)
    }
    const measure = () => {
      const slide = document.querySelector<HTMLElement>('.yarl__slide_current');
      const root = slide?.closest<HTMLElement>('.yarl__portal');
      const media = slide?.querySelector<HTMLElement>('img, video');
      if (!slide || !media || !root) return clear(root);
      const slideBox = slide.getBoundingClientRect();
      const bounds = media.getBoundingClientRect();
      const mediaBox = { left: Math.max(bounds.left, slideBox.left), right: Math.min(bounds.right, slideBox.right), bottom: Math.min(bounds.bottom, slideBox.bottom), top: Math.max(bounds.top, slideBox.top), width: 0, height: 0 };
      mediaBox.width = Math.max(0, mediaBox.right - mediaBox.left);
      mediaBox.height = Math.max(0, mediaBox.bottom - mediaBox.top);
      if (!mediaBox.width || !mediaBox.height) return clear(root);
      const inset = Math.min(12, mediaBox.width / 8, mediaBox.height / 8);
      root.style.setProperty('--viewer-caption-left', `${mediaBox.left - slideBox.left + inset}px`);
      root.style.setProperty('--viewer-caption-bottom', `${slideBox.bottom - mediaBox.bottom + inset}px`);
      root.style.setProperty('--viewer-caption-max-width', `${Math.max(0, mediaBox.width - inset * 2)}px`);
      root.style.setProperty('--viewer-caption-max-height', `${Math.max(0, Math.min(mediaBox.height - inset * 2, mediaBox.height * .4))}px`);
      root.style.setProperty('--viewer-caption-padding-x', `${Math.min(14, mediaBox.width / 8)}px`);
      root.style.setProperty('--viewer-caption-padding-y', `${Math.min(8, mediaBox.height / 12)}px`);
    };
    // portal 与影像由库异步挂载；身份变化重绑，无固定扫描期限。
    const observer = new ResizeObserver(() => measure());
    let media: HTMLElement | null = null;
    let root: HTMLElement | null = null;
    let frame = 0;
    const measureAnimation = () => {
      cancelAnimationFrame(frame);
      measure();
      const slide = document.querySelector<HTMLElement>('.yarl__slide_current');
      if (slide?.getAnimations({ subtree: true }).some(animation => animation.playState === 'running')) frame = requestAnimationFrame(measureAnimation);
    };
    const transforms = new MutationObserver(measureAnimation);
    const stopObserving = observeViewerMedia(next => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      transforms.disconnect();
      media?.removeEventListener('load', measure);
      media?.removeEventListener('loadedmetadata', measure);
      clear(root);
      media = next.media;
      root = next.root;
      const slide = next.slide;
      if (!slide || !media) return;
      media.addEventListener('load', measure);
      media.addEventListener('loadedmetadata', measure);
      observer.observe(media);
      observer.observe(slide);
      // 缩放/平移只改变 transform，ResizeObserver 不会通知。
      transforms.observe(slide, { attributes: true, attributeFilter: ['style'], subtree: true });
      measure();
    });
    window.addEventListener('resize', measure);
    return () => {
      stopObserving();
      cancelAnimationFrame(frame);
      observer.disconnect();
      transforms.disconnect();
      media?.removeEventListener('load', measure);
      media?.removeEventListener('loadedmetadata', measure);
      window.removeEventListener('resize', measure);
      clear(root);
    };
  }, [index, slides, thumbnailsVisible, fullscreen]);

}
