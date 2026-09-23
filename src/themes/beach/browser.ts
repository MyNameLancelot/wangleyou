/** 减少动态效果时，CSS 过渡与平滑滚动都应立即定位。 */
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
