import { test, expect } from '@playwright/test';
import {
  albumId,
  albumPhotoCount,
  albumTitle,
  firstPhoto,
  routeDistMedia,
  setTheme,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('phone browse list opens the album and its viewer without horizontal overflow', async ({page}) => {
  await page.setViewportSize({width: 360, height: 800});
  await page.goto('./#/browse');
  const grid = page.locator('[class*="browseGrid"]').first();
  await expect(grid).toBeVisible();
  const card = page.getByRole('link', {name: `查看相册：${albumTitle}`});
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(360 - 32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 卡片仍可进入相册详情并从图集打开查看器
  await card.click();
  await expect(page.getByRole('heading', {name: albumTitle, level: 1})).toBeVisible();
  await page.getByRole('button', {name: firstPhoto}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
});

test('phone browse album cards show only the album name with a text-hugging chip', async ({page}) => {
  const measure = () => page.evaluate(() => {
    const card = document.querySelector('a[aria-label^="查看相册"]')!;
    const bar = card.querySelector('[class*="mediaBar"]') as HTMLElement;
    const title = card.querySelector('[class*="mediaAlbum"]') as HTMLElement;
    const text = card.querySelector('[class*="mediaText"]') as HTMLElement;
    return {
      cardWidth: Math.round(card.getBoundingClientRect().width),
      barWidth: Math.round(bar.getBoundingClientRect().width),
      titleWidth: Math.round(title.getBoundingClientRect().width),
      textDisplay: getComputedStyle(text).display,
      titleBorder: getComputedStyle(title).borderRightWidth,
      titleOpacity: getComputedStyle(title).opacity,
    };
  });

  await page.setViewportSize({width: 390, height: 844});
  for (const theme of ['beach', 'grassland'] as const) {
    await page.goto('./#/browse');
    await setTheme(page, theme);
    const phone = await measure();
    // 手机端只渲染相册名，说明文字不渲染
    expect(phone.textDisplay).toBe('none');
    expect(phone.titleBorder).toBe('0px');
    expect(phone.titleOpacity).toBe('1');
    // 底色框贴合文字：宽度约为文字宽加左右内边距，明显小于卡片宽度
    expect(phone.barWidth).toBeGreaterThanOrEqual(phone.titleWidth);
    expect(phone.barWidth - phone.titleWidth).toBeLessThanOrEqual(32);
    expect(phone.barWidth).toBeLessThan(phone.cardWidth);
  }

  // 平板与桌面仍展示相册名与说明文字
  await page.setViewportSize({width: 820, height: 1180});
  await page.reload();
  expect((await measure()).textDisplay).not.toBe('none');
});

test('album detail hero shrinks to two thirds and shows at least four photos on phone and pad', async ({page}) => {
  const measure = () => page.evaluate(() => {
    const hero = document.querySelector('[class*="detailHero"]')!.getBoundingClientRect();
    const grid = document.querySelector('[class*="masonryGrid"]') as HTMLElement;
    const tiles = Array.from(grid.querySelectorAll('[class*="masonryTile"]')) as HTMLElement[];
    const blockquote = document.querySelector('[class*="detailHeroCopy"] blockquote')!;
    return {
      heroHeight: hero.height,
      heroBottom: hero.bottom,
      copyBottom: blockquote.getBoundingClientRect().bottom,
      columns: Number(getComputedStyle(grid).columnCount),
      titleSize: parseFloat(getComputedStyle(document.querySelector('[class*="detailHeroCopy"] h1')!).fontSize),
      fullyVisibleTiles: tiles.filter(tile => tile.getBoundingClientRect().bottom <= window.innerHeight).length,
    };
  });

  for (const theme of ['beach', 'grassland'] as const) {
    await page.setViewportSize({width: 1440, height: 900});
    await page.goto(`./#/albums/${albumId}`);
    await setTheme(page, theme);
    const desktop = await measure();

    // 手机：首幅压到 420 → 280 → 224（再降 1/5），三列让首屏至少完整看到 4 张
    await page.setViewportSize({width: 390, height: 844});
    await page.reload();
    const phone = await measure();
    expect(phone.heroHeight).toBeLessThanOrEqual(225);
    expect(phone.columns).toBe(3);
    expect(phone.fullyVisibleTiles).toBeGreaterThanOrEqual(4);
    expect(phone.copyBottom).toBeLessThanOrEqual(phone.heroBottom);
    expect(phone.titleSize).toBeLessThan(desktop.titleSize);
    // 缩略图容器贴合图片本身，不再用容器底色撑出空白块
    const tileFit = await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll('[class*="masonryTile"]')) as HTMLElement[];
      return tiles.every(tile => {
        const thumb = tile.querySelector('[class*="mediaThumb"]') as HTMLElement;
        const image = tile.querySelector('img');
        return image ? Math.abs(thumb.getBoundingClientRect().height - image.getBoundingClientRect().height) <= 1 : true;
      });
    });
    expect(tileFit).toBe(true);

    // 平板：首幅 500 → 333 → 266（再降 1/5），三列让首屏至少完整看到 4 张
    await page.setViewportSize({width: 820, height: 1180});
    await page.reload();
    const pad = await measure();
    expect(pad.heroHeight).toBeLessThanOrEqual(267);
    expect(pad.columns).toBe(3);
    expect(pad.fullyVisibleTiles).toBeGreaterThanOrEqual(4);
    expect(pad.copyBottom).toBeLessThanOrEqual(pad.heroBottom);
    expect(pad.titleSize).toBeLessThan(desktop.titleSize);

    // 1024px iPad：沿用平板规则
    await page.setViewportSize({width: 1024, height: 768});
    await page.reload();
    const widePad = await measure();
    // 桌面首幅上限 500px，平板保持其 2/3 上限
    expect(widePad.heroHeight).toBeLessThanOrEqual(334);
    expect(widePad.columns).toBe(3);
    expect(widePad.fullyVisibleTiles).toBeGreaterThanOrEqual(4);
  }
});

test('year navigation and type filter work on the browse page', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.setViewportSize({width: 1920, height: 1080});
  await page.goto('./#/browse');
  await expect(page.getByRole('heading',{name:'留影',level:1})).toBeVisible();
  await expect(page.getByRole('button',{name:'全部',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'照片',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'视频',exact:true})).toBeVisible();
  // 浏览页不展示任何统计数量、相册快捷入口、排序说明或键盘提示
  await expect(page.getByText(/\d+\s*项/)).toHaveCount(0);
  await expect(page.locator('aside').getByRole('link')).toHaveCount(0);
  await expect(page.getByText('最新优先')).toHaveCount(0);
  await expect(page.getByText('键盘可用方向键')).toHaveCount(0);
  // 缩略图不带演示角标，说明条为紧凑单行
  await expect(page.getByText('演示素材')).toHaveCount(0);
  expect(await page.locator('[class*="mediaBar"]').first().evaluate(node => node.getBoundingClientRect().height)).toBeLessThanOrEqual(40);
  // 定位栏标题与卡片上的相册名称
  await expect(page.getByRole('heading',{name:'光阴刻度'})).toBeVisible();
  await expect(page.locator('aside').getByRole('button',{name:'2025'})).toBeVisible();
  await expect(page.getByText(albumTitle,{exact:true}).first()).toBeVisible();
  // 留影页按年份倒序聚合；同一年内仍按 YYYY-MM 与 sequenceNN 排列。
  const groups = await page.evaluate(() => Array.from(document.querySelectorAll('section[id^="year-"]')).map(section => ({
    year: section.querySelector('h2')?.textContent?.trim(),
    albums: Array.from(section.querySelectorAll('[class*="mediaTile"]')).map(tile => (tile.getAttribute('aria-label') || '').replace('查看相册：', '')),
  })));
  expect(groups).toEqual([
    { year: '2029 年', albums: ['海边傍晚'] },
    { year: '2028 年', albums: ['周末远足'] },
    { year: '2027 年', albums: ['雨后花园'] },
    { year: '2026 年', albums: ['初夏散步'] },
    { year: '2025 年', albums: ['周岁'] },
    { year: '2024 年', albums: ['破壳', '百日'] },
  ]);
  // 定位栏与 hero 文案同边，网格不贴窗口右边缘
  const layout = await page.evaluate(() => {
    const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const rail = box('[class*="railCard"]');
    const title = box('#browse-title');
    const grid = box('[class*="browseGrid"]');
    return {
      railLeft: rail?.left ?? 0, titleLeft: title?.left ?? 0, gridRight: grid?.right ?? 0,
      innerWidth: window.innerWidth,
    };
  });
  expect(Math.abs(layout.railLeft - layout.titleLeft)).toBeLessThanOrEqual(1);
  expect(layout.gridRight).toBeLessThan(layout.innerWidth - 100);
  await page.getByRole('button',{name:'照片',exact:true}).click();
  await expect(page.getByRole('button',{name:/播放视频/})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

  await page.setViewportSize({width: 360, height: 800});
  await page.reload();
  const mobile = await page.evaluate(() => {
    const pill = document.querySelector('[class*="filterPill"]')!.getBoundingClientRect();
    const title = document.querySelector('#browse-title')!.getBoundingClientRect();
    return { pillLeft: pill.left, titleLeft: title.left, overflow: document.documentElement.scrollWidth <= window.innerWidth };
  });
  expect(Math.abs(mobile.pillLeft - mobile.titleLeft)).toBeLessThanOrEqual(1);
  expect(mobile.overflow).toBe(true);
  const initialGridTop = await page.locator('[class*="browseGrid"]').first().evaluate(node => node.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, 400));
  const fixedHeader = await page.evaluate(() => ({
    heroTop: document.querySelector('[class*="browseHero"]')!.getBoundingClientRect().top,
    yearsTop: document.querySelector('[class*="yearNav"]')!.getBoundingClientRect().top,
    gridTop: document.querySelector('[class*="browseGrid"]')!.getBoundingClientRect().top,
    heroZIndex: Number(getComputedStyle(document.querySelector('[class*="browseHero"]')!).zIndex),
    yearsZIndex: Number(getComputedStyle(document.querySelector('[class*="yearNav"]')!).zIndex),
  }));
  expect(fixedHeader.heroTop).toBe(0);
  expect(fixedHeader.yearsTop).toBe(222);
  expect(fixedHeader.heroZIndex).toBeGreaterThan(fixedHeader.yearsZIndex);
  expect(initialGridTop).toBeGreaterThanOrEqual(322);
  expect(fixedHeader.gridTop).toBeLessThan(initialGridTop);
  const yearNavigation = await page.evaluate(() => {
    const label = document.querySelector('[class*="yearNavLabel"]') as HTMLElement;
    const scroller = document.querySelector('[class*="yearNavScroller"]') as HTMLElement;
    const nav = document.querySelector('[class*="yearNav"]') as HTMLElement;
    const before = label.getBoundingClientRect().left;
    scroller.scrollLeft = 80;
    return {
      labelShift: label.getBoundingClientRect().left - before,
      labelBackground: getComputedStyle(label).backgroundColor,
      navigationBackground: getComputedStyle(nav).backgroundColor,
      shellBackground: getComputedStyle(document.querySelector('main')!.parentElement!).backgroundColor,
    };
  });
  expect(yearNavigation.labelShift).toBe(0);
  expect(yearNavigation.labelBackground).toBe('rgba(0, 0, 0, 0)');
  expect(yearNavigation.navigationBackground).toBe(yearNavigation.shellBackground);
  await page.getByRole('navigation', {name: '年份定位'}).getByRole('button', {name: '2028', exact: true}).click();
  await expect.poll(() => page.locator('#year-2028').evaluate(node => node.getBoundingClientRect().top)).toBeGreaterThanOrEqual(306);
});

test('browse album cards stack top covers with depth in both themes', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('./#/browse');

  for (const theme of ['beach', 'grassland'] as const) {
    await setTheme(page, theme);
    const card = page.getByRole('link', {name: `查看相册：${albumTitle}`});
    const stack = card.locator('[data-browse-album-stack]');
    await expect(stack).toHaveAttribute('data-stack', '3');
    await expect(stack.locator('[data-browse-cover]').count()).resolves.toBe(3);
    await expect(stack.locator('[data-browse-cover="front"] img')).toHaveAttribute('src', /top01\.jpg$/);
    await expect(stack.locator('[data-browse-cover="front"] img')).toHaveCSS('object-fit', 'cover');
    await card.hover();
    await expect(stack.locator('[data-browse-cover="front"] img')).toHaveCSS('transform', 'none');

    const layerBox = (layer: string) => stack.locator(`[data-browse-cover="${layer}"]`).evaluate(node => {
      const box = node.getBoundingClientRect();
      return {x: Math.round(box.x), y: Math.round(box.y), border: getComputedStyle(node).borderWidth, shadow: getComputedStyle(node).boxShadow};
    });
    const [front, middle, back] = await Promise.all([layerBox('front'), layerBox('middle'), layerBox('back')]);
    expect(back.x).toBeGreaterThan(middle.x);
    expect(middle.x).toBeGreaterThan(front.x);
    expect(back.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(front.y);
    expect(front.border).toBe('0px');
    expect(middle.border).toBe('0px');
    expect(back.border).toBe('0px');
    expect(front.shadow).toBe('none');
    expect(middle.shadow).toBe('none');
    expect(back.shadow).toBe('none');

    const selectedFilter = page.getByRole('button', {name: '全部', exact: true});
    const railYear = page.locator('aside').getByRole('button', {name: '2025'});
    await railYear.hover();
    const [filterColors, yearColors] = await Promise.all([selectedFilter.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color })), railYear.evaluate(node => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color }))]);
    expect(yearColors).toEqual(filterColors);
  }

  await page.setViewportSize({width: 360, height: 800});
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('album cards stack up to three photos and show album level metadata', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('./#/albums');
  // 相册级元信息来自 meta.json 的 album 段，不再出现“待续”
  await expect(page.getByText('待续')).toHaveCount(0);
  const card = page.getByRole('link',{name:`查看相册：${albumTitle}`});
  await expect(card).toBeVisible();
  // 相册日期缺省取目录名的年月
  await expect(card).toContainText('2024.05');
  await expect(card).toContainText('小小的你，第一次和我们见面。');
  await expect(card.getByText(`${albumPhotoCount} 个瞬间`)).toBeVisible();
  const layerBox = (kind: string) => card.locator(`[class*="coverLayer${kind}"]`).evaluate(node => {
    const box = node.getBoundingClientRect();
    return { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
  });
  const [front, mid, back] = await Promise.all([layerBox('Front'), layerBox('Mid'), layerBox('Back')]);
  // 三张照片层叠：后排向右上探出，尺寸一致
  expect(await card.locator('[class*="coverLayer"]').count()).toBe(3);
  expect(back.x).toBeGreaterThan(mid.x);
  expect(mid.x).toBeGreaterThan(front.x);
  expect(back.y).toBeLessThan(mid.y);
  expect(mid.y).toBeLessThan(front.y);
  expect(back.w).toBe(front.w);
  expect(await card.locator('img').count()).toBe(3);
  // 封面保持普通相机横拍的 3:2 比例
  const cover = await card.locator('[data-stack]').evaluate(node => { const box = node.getBoundingClientRect(); return box.width / box.height; });
  expect(Math.abs(cover - 1.5)).toBeLessThan(0.02);
  // 封面按原比例完整显示，不裁切
  await expect(card.locator('[class*="coverLayerFront"] img')).toHaveCSS('object-fit', 'contain');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
