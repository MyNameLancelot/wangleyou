import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { AlbumPage, HomePage } from './index';
import { validateContent } from '../content';
const onOpen = () => {};
const site = { title: '测试相册', subtitle: '配置驱动' };
it('renders a new single-photo album from config without changing UI', () => {
  const data = validateContent({ site, albums: [{ id: 'new-album', title: '新相册', media: [{ id: 'one', type: 'photo', src: 'media/one.jpg' }] }] });
  expect(renderToStaticMarkup(<HomePage data={data} onOpen={onOpen} />)).toContain('#/albums/new-album');
  const html = renderToStaticMarkup(<AlbumPage album={data.albums[0]} onOpen={onOpen} />);
  expect(html).toContain('新相册');
  expect(html.match(/aria-label="查看照片：one"/g)).toHaveLength(1);
});
it('uses a later available thumbnail when first video has no preview', () => {
  const data = validateContent({site,albums:[{id:'mixed',title:'混合',media:[
    {id:'video',type:'video',src:'media/video.mp4'},
    {id:'photo',type:'photo',src:'media/one.jpg',thumbnail:'media/thumbs/one.webp'}
  ]}]});
  const html=renderToStaticMarkup(<HomePage data={data} onOpen={onOpen} />);
  expect(html).toContain('alt="混合"');
  expect(html).toMatch(/src="[^"]*\/media\/thumbs\/one\.webp" alt="混合"/);
  expect(html).not.toContain('留给下一段故事');
});
it('renders an empty album with a return link and no photo buttons',()=>{
  const html=renderToStaticMarkup(<AlbumPage album={{id:'empty',title:'空相册',media:[]}} onOpen={onOpen}/>);
  expect(html).toContain('下一段故事，还在路上');
  expect(html).toContain('href="#/"');
  expect(html).not.toContain('aria-label="查看照片');
});

it('prefers a later preview over an earlier full-resolution photo', () => {
  const data = validateContent({site,albums:[{id:'mixed',title:'封面优先级',media:[
    {id:'first',type:'photo',src:'media/full-first.jpg'},
    {id:'later',type:'video',src:'media/video.mp4',poster:'media/poster.jpg'}
  ]}]});
  const html=renderToStaticMarkup(<HomePage data={data} onOpen={onOpen}/>);
  expect(html).toMatch(/src="[^"]*\/media\/poster\.jpg" alt="封面优先级"/);
});
