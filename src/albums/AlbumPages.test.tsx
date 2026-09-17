import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AlbumPage, AlbumsPage, BrowsePage, HomePage } from './index';
import type { Media } from '../content';
import { validateContent } from '../content';

const onOpen = () => {};
const site = { title: '测试相册', subtitle: '配置驱动' };
const copy = { eyebrow: '潮汐带回的日子', title: '把有海风的日子，留在这里。', subtitle: '照片、视频与那些值得重看的片刻。' };

it('renders a new single-photo album from config without changing UI', () => {
  const data = validateContent({ site, albums: [{ id: 'new-album', title: '新相册', media: [{ id: 'one', type: 'photo', src: 'media/one.jpg' }] }] });
  expect(renderToStaticMarkup(<HomePage data={data} onOpen={onOpen} copy={copy} />)).toContain('#/albums/new-album');
  const html = renderToStaticMarkup(<AlbumPage album={data.albums[0]} albums={data.albums} onOpen={onOpen} />);
  expect(html).toContain('新相册');
  expect(html.match(/aria-label="查看照片：one"/g)).toHaveLength(1);
});

it('uses a later available thumbnail when first video has no preview', () => {
  const data = validateContent({
    site,
    albums: [{
      id: 'mixed',
      title: '混合',
      media: [
        { id: 'video', type: 'video', src: 'media/video.mp4' },
        { id: 'photo', type: 'photo', src: 'media/one.jpg', thumbnail: 'media/thumbs/one.webp' },
      ],
    }],
  });
  const html = renderToStaticMarkup(<HomePage data={data} onOpen={onOpen} copy={copy} />);
  expect(html).toContain('alt="混合"');
  expect(html).toMatch(/src="[^"]*\/media\/thumbs\/one\.webp" alt="混合"/);
  expect(html).not.toContain('留给下一段故事');
});

it('renders an empty album with a return link and no media buttons', () => {
  const html = renderToStaticMarkup(<AlbumPage album={{ id: 'empty', title: '空相册', media: [] }} albums={[]} onOpen={onOpen} />);
  expect(html).toContain('下一段故事，还在路上');
  expect(html).toContain('href="#/"');
  expect(html).not.toContain('aria-label="查看照片');
  expect(html).not.toContain('aria-label="播放视频');
});

const gallery: Media[] = [
  { id: 'p1', type: 'photo', src: 'media/one.jpg', thumbnail: 'media/thumbs/one.webp', date: '2026-08-01', description: '海边的光' },
  { id: 'v1', type: 'video', src: 'media/clip.mp4', poster: 'media/thumbs/two.webp', date: '2025-07-02', description: '一段视频', duration: 32 },
];
const galleryData = validateContent({ site, albums: [{ id: 'gallery', title: '混合相册', date: '2026-08-01', media: gallery }] });

it('浏览页按年份分组并统计照片与视频数量', () => {
  const html = renderToStaticMarkup(<BrowsePage data={galleryData} onOpen={onOpen} />);
  expect(html).toContain('全部影像');
  expect(html).toContain('全部 2');
  expect(html).toContain('照片 1');
  expect(html).toContain('视频 1');
  expect(html).toContain('id="year-2026"');
  expect(html).toContain('id="year-2025"');
  expect(html).toContain('年份');
});

it('视频缩略图带类型标识与时长，照片不带', () => {
  const html = renderToStaticMarkup(<BrowsePage data={galleryData} onOpen={onOpen} />);
  expect(html).toContain('播放视频：一段视频');
  expect(html).toContain('0:32');
  expect(html).toContain('查看照片：海边的光');
  expect(html.match(/演示素材/g)?.length).toBe(2);
});

it('相册详情提供面包屑、播放入口与相邻相册导航', () => {
  const data = validateContent({ site, albums: [
    { id: 'first', title: '第一本', media: [{ id: 'one', type: 'photo', src: 'media/one.jpg' }] },
    { id: 'second', title: '第二本', media: [{ id: 'two', type: 'photo', src: 'media/two.jpg' }] },
  ] });
  const html = renderToStaticMarkup(<AlbumPage album={data.albums[0]} albums={data.albums} onOpen={onOpen} />);
  expect(html).toContain('从这里播放');
  expect(html).toContain('href="#/browse"');
  expect(html).toContain('接下来的影像');
  expect(html).toContain('下一本相册');
  expect(html).toContain('#/albums/second');
  expect(html).not.toContain('上一本相册');
});

it('相册索引页列出所有相册，空配置给出说明', () => {
  const data = validateContent({ site, albums: [{ id: 'only', title: '唯一相册', media: [] }] });
  const html = renderToStaticMarkup(<AlbumsPage data={data} />);
  expect(html).toContain('唯一相册');
  const empty = renderToStaticMarkup(<AlbumsPage data={validateContent({ site, albums: [] })} />);
  expect(empty).toContain('相册还在准备中');
});
