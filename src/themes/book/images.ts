import type { Photo } from '../../content';
import { mediaUrl } from '../../content';

export type ImageSource = Pick<Photo, 'src' | 'srcSet'>;
export const responsiveSrcSet = (source: ImageSource) => source.srcSet?.map(candidate => `${mediaUrl(candidate.src)} ${candidate.width}w`).join(', ');

// 与 ThemeHome 的外边距、书页内边距和照片相框一致；桌面照片上限约 598px。
export const homePhotoSizes = '(max-width: 390px) calc((100vw - 96px) * .968 - 2px), (max-width: 700px) calc((100vw - 113px) * .968 - 2px), calc((min(640px, min(950px, 100vw - clamp(40px, 10vw, 144px)) - clamp(42px, 6vw, 76px) - clamp(29px, 5vw, 68px) - 19px) - 20px) * .968 - 2px)';
export const albumCoverSizes = '(max-width: 600px) calc(100vw - 16px), (max-width: 900px) calc((100vw - 16px) / 2 - 24px), calc((100vw - 48px) / 3 - 24px)';
