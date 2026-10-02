type ViewerMedia = { root: HTMLElement | null; slide: HTMLElement | null; media: HTMLElement | null };

/** 库拥有 DOM；挂载、换项或同项替换时只通知身份变化，无超时或轮询。 */
export function observeViewerMedia(onChange: (elements: ViewerMedia) => void) {
  let previous: ViewerMedia | undefined;
  const update = () => {
    const slide = document.querySelector<HTMLElement>('.yarl__slide_current');
    const next = {
      root: slide?.closest<HTMLElement>('.yarl__portal') ?? null,
      slide,
      media: slide?.querySelector<HTMLElement>('img, video') ?? null,
    };
    if (next.root === previous?.root && next.slide === previous?.slide && next.media === previous?.media) return;
    previous = next;
    onChange(next);
  };
  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  update();
  return () => observer.disconnect();
}
