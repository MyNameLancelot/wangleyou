import { test, expect } from '@playwright/test';
import {
  albumId,
  albumPhotoCount,
  albumTitle,
  enterAlbum,
  firstPhoto,
  routeDistMedia,
  setTheme,
  viewerAt,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('homepage, album, original photo, keyboard and focus restoration', async ({page, isMobile}) => {
  const errors:string[]=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./');
  await expect(page.getByRole('heading', {level:1})).toContainText('把有海风的日子');
  await page.evaluate(()=>localStorage.setItem('wangleyou.lastPlayed','legacy-value'));
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  if (isMobile) {
    await expect(memory.getByRole('button', {name:'上一张照片'})).toBeHidden();
    await expect(memory.getByRole('button', {name:'下一张照片'})).toBeHidden();
  } else {
    await expect(memory.getByRole('button', {name:'上一张照片'})).toBeVisible();
    await expect(memory.getByRole('button', {name:'下一张照片'})).toBeVisible();
  }
  await expect(memory.getByRole('progressbar',{name:'主回忆进度'})).toBeVisible();
  await page.goto('./#/albums');
  await page.getByRole('link',{name:`查看相册：${albumTitle}`}).click();
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  const trigger=page.getByRole('button',{name:firstPhoto}); await trigger.click();
  const dialog=page.getByRole('dialog'); await expect(dialog.getByRole('img')).toBeVisible();
  if (isMobile) {
    // 移动端只用左右滑动切换，不渲染导航按钮
    await expect(dialog.getByRole('button',{name:'上一项'})).toHaveCount(0);
    await expect(dialog.getByRole('button',{name:'下一项'})).toHaveCount(0);
  } else {
    await expect(dialog.getByRole('button',{name:'上一项'})).toBeDisabled();
  }
  await page.keyboard.press('ArrowRight'); await viewerAt(page, 2);
  for (let index = 3; index <= albumPhotoCount; index += 1) await page.keyboard.press('ArrowRight');
  await viewerAt(page, albumPhotoCount);
  if (!isMobile) await expect(dialog.getByRole('button',{name:'下一项'})).toBeDisabled();
  await page.keyboard.press('ArrowRight'); await viewerAt(page, albumPhotoCount);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
  if (isMobile) {
    // 手机端不展示返回入口，回到留影页依赖浏览器返回手势
    await expect(page.getByRole('link',{name:'← 返回留影'})).toBeHidden();
    await page.goto('./#/browse');
  } else {
    await page.getByRole('link',{name:'← 返回留影'}).click();
  }
  await expect(page.getByRole('heading',{name:'留影',level:1})).toBeVisible();
  await page.goto('./#/');
  await expect(page.getByRole('heading',{name:'把有海风的日子，留在这里。'})).toBeVisible();
  await expect(page.locator('[data-home-section="hero"]').getByRole('button',{name:'继续播放'})).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('wangleyou.lastPlayed'))).toBe('legacy-value');
  expect(errors).toEqual([]);
});

test('subpath refresh and invalid routes',async({page})=>{
  expect((await page.request.get('./albums/missing')).status()).toBe(404);
  await enterAlbum(page); await page.reload();
  await expect(page.getByRole('heading',{name:albumTitle,level:1})).toBeVisible();
  for(const route of ['#/albums/missing','#/albums/%E0%A4%A','#/unknown']) {
    await page.goto(`./${route}`);
    await expect(page.getByRole('heading',{name:'没有找到这个相册'})).toBeVisible();
  }
});

test('browse hero returns home in both isolated themes', async ({page}) => {
  // 链接本身只在平板与桌面展示，位置与跳转行为在桌面视口核对
  await page.setViewportSize({width: 1440, height: 900});
  for (const theme of ['beach', 'grassland'] as const) {
    await page.goto('./#/browse');
    await setTheme(page, theme);
    const back = page.getByRole('link', {name: '返回首页'});
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', '#/');
    expect(await back.evaluate(element => {
      const heading = document.querySelector('#browse-title')!;
      const link = element.getBoundingClientRect();
      const title = heading.getBoundingClientRect();
      return link.bottom <= title.top && link.height >= 44;
    })).toBe(true);
    await back.click();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#/');
    await expect(page.locator('[data-home-section="hero"]')).toBeVisible();
  }

  await page.goto('./#/browse');
  await page.setViewportSize({width: 360, height: 800});
  const back = page.getByRole('link', {name: '返回首页'});
  // 手机端不展示返回首页入口
  await expect(back).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // 平板仍展示返回首页入口，并保持 44px 命中区
  await page.setViewportSize({width: 820, height: 1180});
  await page.reload();
  await expect(back).toBeVisible();
  expect(await back.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

test('phone hides the back links while tablet and desktop keep them', async ({page}) => {
  const browseBack = page.getByRole('link', {name: '返回首页'});
  const detailBack = page.getByRole('link', {name: '← 返回留影'});

  for (const [width, height, visible] of [[360, 800, false], [390, 844, false], [820, 1180, true], [1440, 900, true]] as const) {
    await page.setViewportSize({width, height});
    await page.goto('./#/browse');
    await expect(browseBack)[visible ? 'toBeVisible' : 'toBeHidden']();
    if (visible) expect(await browseBack.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.goto(`./#/albums/${albumId}`);
    await expect(detailBack)[visible ? 'toBeVisible' : 'toBeHidden']();
    if (visible) expect(await detailBack.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    // 手机端文案上移后仍在 hero 内且不产生横向溢出
    expect(await page.evaluate(() => {
      const hero = document.querySelector('[class*="detailHero"]')!.getBoundingClientRect();
      const copy = document.querySelector('[class*="detailHeroCopy"]')!.getBoundingClientRect();
      return copy.top >= hero.top && copy.bottom <= hero.bottom;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
