import { test, expect } from '@playwright/test';
import {
  routeDistMedia,
  setTheme,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('home memory arrows, hover pause and two-screen boundaries stay consistent', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await setTheme(page, 'beach');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  await expect(photo).toBeVisible();
  await expect(memory).toHaveCSS('background-image', /media\/themes\/beach\/home-memory\.webp/);
  await expect(memory.getByRole('button')).toHaveCount(3);
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);
  await expect(memory.getByRole('progressbar',{name:'主回忆进度'})).toHaveCount(1);
  await expect(memory.getByRole('heading',{name:'主回忆'})).toHaveCount(0);
  await expect(memory.getByText(/第 \d+ \/ \d+ 张/)).toHaveCount(0);

  // 照片画框固定 3:2，玻璃底板不带白边
  const frame = await photo.boundingBox();
  expect(Math.abs((frame?.width ?? 0) / (frame?.height || 1) - 1.5)).toBeLessThan(0.02);
  const mat = memory.locator('[data-memory-mat]');
  await expect(mat).toBeVisible();
  const matEdges = await mat.evaluate(node => {
    const style = getComputedStyle(node);
    return {top: style.borderTopWidth, shadow: style.boxShadow};
  });
  expect(matEdges.top).toBe('0px');
  expect(matEdges.shadow).not.toContain('inset');

  await photo.hover();
  const before = await photo.getAttribute('aria-label');
  await memory.getByRole('button',{name:'下一张照片'}).click();
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(before);
  await memory.getByRole('button',{name:'上一张照片'}).click();
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(before);

  // 焦点也需离开；仅移开指针时仍应保持焦点暂停。
  await page.locator('main').focus();
  // 指针停在照片上时暂停自动播放，移开后恢复
  await memory.getByRole('button',{name:'下一张照片'}).hover();
  const held = await photo.getAttribute('aria-label');
  await page.waitForTimeout(4200);
  expect(await photo.getAttribute('aria-label')).toBe(held);
  await page.mouse.move(4,4);
  await expect.poll(()=>photo.getAttribute('aria-label'),{timeout:4500}).not.toBe(held);

  await page.keyboard.press('ArrowUp');
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('home screens meet without a divider and memory controls stay frosted', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  for (const theme of ['beach','grassland'] as const) {
    await setTheme(page, theme);
    // 两屏之间不再渲染 1px 分隔线，也不留缝隙露出页面底色
    const junction = await page.evaluate(() => {
      const hero = document.querySelector('[data-home-section="hero"]')!;
      const memory = document.querySelector('[data-home-section="memory"]')!;
      const edges = (node: Element) => {
        const style = getComputedStyle(node);
        return `${style.borderTopWidth}/${style.borderBottomWidth}`;
      };
      return {
        hero: edges(hero),
        memory: edges(memory),
        gap: memory.getBoundingClientRect().top - hero.getBoundingClientRect().bottom,
      };
    });
    expect(junction.hero).toBe('0px/0px');
    expect(junction.memory).toBe('0px/0px');
    expect(Math.abs(junction.gap)).toBeLessThanOrEqual(1);

    // 交界带用第二屏背景做跨屏淡入；层位在首屏之上、第二屏之下，不覆盖第二屏底板与照片
    const seam = await page.evaluate(() => {
      const layer = document.querySelector('[data-home-seam]') as HTMLElement;
      const style = getComputedStyle(layer);
      const memory = document.querySelector('[data-home-section="memory"]') as HTMLElement;
      return {
        ariaHidden: layer.getAttribute('aria-hidden'),
        pointerEvents: style.pointerEvents,
        mask: style.maskImage || style.webkitMaskImage,
        layerZ: Number(style.zIndex),
        memoryZ: Number(getComputedStyle(memory).zIndex),
      };
    });
    expect(seam.ariaHidden).toBe('true');
    expect(seam.pointerEvents).toBe('none');
    expect(seam.mask).toContain('linear-gradient');
    expect(seam.layerZ).toBeGreaterThan(0);
    expect(seam.memoryZ).toBeGreaterThan(seam.layerZ);

    await page.keyboard.press('ArrowDown');
    const memory = page.locator('[data-home-section="memory"]');
    await expect(memory).toBeInViewport();
    await memory.getByRole('button',{name:/暂停主回忆自动播放/}).click();
    const surfaces = [memory.getByRole('button',{name:'上一张照片'}), memory.getByRole('button',{name:'下一张照片'}), memory.getByRole('button',{name:'继续播放主回忆'}), memory.getByRole('progressbar',{name:'主回忆进度'})];
    for (const surface of surfaces) {
      await expect(surface).toBeVisible();
      const style = await surface.evaluate(node => {
        const computed = getComputedStyle(node);
        return { blur: computed.backdropFilter, background: computed.backgroundColor, border: computed.borderTopWidth };
      });
      expect(style.blur).toContain('blur(');
      expect(style.background).toMatch(/rgba\(\d+, \d+, \d+, 0\.[0-5]/);
      expect(style.border).toBe('0px');
    }
    await page.keyboard.press('ArrowUp');
  }
});

test('home memory photo pauses playback and never opens the viewer', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  await expect(photo).toBeVisible();

  // 点击照片暂停：首页不进入查看器，照片下方出现播放按钮
  await photo.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(photo).toHaveAttribute('aria-label', /^继续主回忆自动播放/);
  const play = memory.getByRole('button',{name:'继续播放主回忆'});
  await expect(play).toBeVisible();
  const playBox = await play.boundingBox();
  expect(playBox?.width).toBeGreaterThanOrEqual(44);
  expect(playBox?.height).toBeGreaterThanOrEqual(44);
  const photoBox = await photo.boundingBox();
  expect(playBox?.y).toBeGreaterThan((photoBox?.y ?? 0) + (photoBox?.height ?? 0) - 2);
  // 键盘顺序聚焦到播放按钮时显示焦点环
  for (let step = 0; step < 10; step += 1) {
    if (await play.evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(play).toBeFocused();
  expect(await play.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');

  // 指针与焦点都离开后暂停状态保持，不再自动前进
  await page.evaluate(()=> (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4,4);
  const paused = await photo.getAttribute('aria-label');
  await page.waitForTimeout(4200);
  expect(await photo.getAttribute('aria-label')).toBe(paused);

  // 播放按钮恢复自动播放并隐藏自身
  await play.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);
  await expect(photo).toHaveAttribute('aria-label', /^暂停主回忆自动播放/);
  await page.evaluate(()=> (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4,4);
  const resumed = await photo.getAttribute('aria-label');
  const resumedAt = Date.now();
  await expect.poll(()=>photo.getAttribute('aria-label'),{timeout:4500}).not.toBe(resumed);
  expect(Date.now() - resumedAt).toBeLessThan(4000);

  // 再次点击照片同样恢复播放，按钮不出现重复入口
  await photo.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  await photo.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);
});

test('mobile memory hides arrows, swipes photos and keeps the two-screen flow', async ({page, isMobile}) => {
  test.skip(!isMobile, '触控滑动只在移动项目验证');
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  await expect(photo).toBeVisible();
  await expect(memory.getByRole('button',{name:'上一张照片'})).toBeHidden();
  await expect(memory.getByRole('button',{name:'下一张照片'})).toBeHidden();
  await expect(memory.getByRole('button')).toHaveCount(1);

  // 点击照片暂停并显示播放按钮，不进入查看器
  await photo.tap();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  await memory.getByRole('button',{name:'继续播放主回忆'}).tap();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);

  // 第二屏内横向滑动换图
  const before = await photo.getAttribute('aria-label');
  await memory.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:300,clientY:420}]});
  await memory.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:120,clientY:430}]});
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(before);
  const afterSwipe = await photo.getAttribute('aria-label');
  await memory.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:120,clientY:420}]});
  await memory.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:300,clientY:430}]});
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(before);
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toHaveCount(0);

  // 音乐按钮上的触摸不计入换图
  const music = page.getByTestId('music-toggle');
  await music.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:320,clientY:40}]});
  await music.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:180,clientY:40}]});
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(before);
  await expect(memory).toBeInViewport();
  expect(afterSwipe).not.toBe(before);

  // 纵向滑动仍然切回首屏
  await memory.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:180,clientY:300}]});
  await memory.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:186,clientY:640}]});
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

test('tablet memory hides arrows and changes photos by horizontal swipe', async ({page, isMobile}) => {
  test.skip(!isMobile, '触控输入由移动项目模拟');
  await page.setViewportSize({width: 768, height: 1024});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  const photo = memory.getByRole('button', {name: /主回忆自动播放/});
  await expect(memory).toBeInViewport();
  await expect(memory.getByRole('button', {name: '上一张照片'})).toBeHidden();
  await expect(memory.getByRole('button', {name: '下一张照片'})).toBeHidden();

  const before = await photo.getAttribute('aria-label');
  await memory.dispatchEvent('touchstart', {touches: [{identifier: 1, clientX: 650, clientY: 480}]});
  await memory.dispatchEvent('touchend', {changedTouches: [{identifier: 1, clientX: 300, clientY: 490}]});
  await expect.poll(() => photo.getAttribute('aria-label')).not.toBe(before);
  await memory.dispatchEvent('touchstart', {touches: [{identifier: 1, clientX: 300, clientY: 480}]});
  await memory.dispatchEvent('touchend', {changedTouches: [{identifier: 1, clientX: 650, clientY: 490}]});
  await expect.poll(() => photo.getAttribute('aria-label')).toBe(before);
});

test('desktop memory switches photos by mouse drag without pausing', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});
  const play = memory.getByRole('button',{name:'继续播放主回忆'});

  // 先暂停，确保换图只可能来自鼠标拖动
  await photo.click();
  await expect(play).toBeVisible();
  const paused = await photo.getAttribute('aria-label');
  const center = async () => {
    const box = await photo.boundingBox();
    return {x:(box?.x ?? 0) + (box?.width ?? 0) / 2, y:(box?.y ?? 0) + (box?.height ?? 0) / 2};
  };

  // 按住鼠标向左拖动 = 下一张，且不被当作点击
  const start = await center();
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 160,start.y + 6,{steps:6});
  await page.mouse.up();
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(paused);
  await expect(play).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 向右拖动 = 上一张
  const back = await center();
  await page.mouse.move(back.x,back.y);
  await page.mouse.down();
  await page.mouse.move(back.x + 160,back.y + 6,{steps:6});
  await page.mouse.up();
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(paused);
  await expect(play).toBeVisible();

  // 位移不足阈值时仍按点击处理：恢复播放，且不换图
  const small = await center();
  await page.mouse.move(small.x,small.y);
  await page.mouse.down();
  await page.mouse.move(small.x - 20,small.y + 4,{steps:4});
  await page.mouse.up();
  await expect.poll(()=>photo.getAttribute('aria-label')).toMatch(/^暂停主回忆自动播放/);
  await expect(play).toHaveCount(0);
});

test('trackpad horizontal swipe switches memory photos and keeps vertical switching', async ({page}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '移动模拟不提供真实触控板 wheel 输入');
  await page.setViewportSize({width:1440,height:900});
  await page.goto('./');
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  await expect(memory).toBeInViewport();
  const photo = memory.getByRole('button',{name:/主回忆自动播放/});

  // 先暂停，换图只可能来自触控板横向滚动
  await photo.click();
  await expect(memory.getByRole('button',{name:'继续播放主回忆'})).toBeVisible();
  const paused = await photo.getAttribute('aria-label');
  const progress = memory.getByRole('progressbar',{name:'主回忆进度'});
  const progressState = async () => progress.evaluate(node => ({value:(node as HTMLProgressElement).value, max:(node as HTMLProgressElement).max}));

  // 一次两指滑动会连发多个 wheel 事件（含动量），只应换一张
  const wheelBurst = (deltaX: number, count = 6) => page.evaluate(({deltaX, count}) => {
    for (let index = 0; index < count; index += 1) {
      document.body.dispatchEvent(new WheelEvent('wheel', {deltaX, deltaY:0, bubbles:true, cancelable:true}));
    }
  }, {deltaX, count});

  const before = await progressState();
  await page.mouse.move(720,450);
  await wheelBurst(40);
  await expect.poll(async () => (await progressState()).value).toBe((before.value % before.max) + 1);
  await expect.poll(()=>photo.getAttribute('aria-label')).not.toBe(paused);
  expect(await page.evaluate(()=>scrollX)).toBe(0);

  // 停手超过手势间隔后重新滑动才再换一张，反向滑动回到上一张
  await page.waitForTimeout(450);
  await wheelBurst(-40);
  await expect.poll(async () => (await progressState()).value).toBe(before.value);
  await expect.poll(()=>photo.getAttribute('aria-label')).toBe(paused);
  await expect(memory).toBeInViewport();

  // 慢速滑动同样累积到阈值后只换一张：事件间隔约 120ms，远小于 400ms 手势间隔。
  // 派发放在页面内完成：CI 负载下 Playwright 的 waitForTimeout 会漂移到 400ms 以外，
  // 三次 25px 会被拆成三个独立手势，换不了图（实测 CI 失败，期望 2 得到 1）。
  await page.waitForTimeout(450);
  await page.evaluate(async () => {
    for (let index = 0; index < 3; index += 1) {
      document.body.dispatchEvent(new WheelEvent('wheel', {deltaX:25, deltaY:0, bubbles:true, cancelable:true}));
      if (index < 2) await new Promise(resolve => setTimeout(resolve, 120));
    }
  });
  await expect.poll(async () => (await progressState()).value).toBe((before.value % before.max) + 1);

  // 纵向滚动仍然切回首屏
  await page.waitForTimeout(400);
  await page.mouse.wheel(0,-120);
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
});

for (const theme of ['beach', 'grassland'] as const) {
  test(`review: ${theme} focus and hover independently pause memory`, async ({page, isMobile}) => {
  test.skip(isMobile, '悬停验证需要鼠标');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');
  await setTheme(page, theme);
  await page.clock.install();
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  const next = memory.getByRole('button', {name: '下一张照片'});
  const progress = memory.getByRole('progressbar');
  await next.click();
  await page.mouse.move(0, 0);
  await expect(next).toBeFocused();
  const focusedValue = await progress.getAttribute('value');
  await page.clock.runFor(2100);
  await expect(progress).toHaveAttribute('value', focusedValue!);
  await memory.getByRole('button', {name: /主回忆自动播放/}).hover();
  await page.locator('main').focus();
  await page.clock.runFor(2100);
  await expect(progress).toHaveAttribute('value', focusedValue!);
  await page.mouse.move(0, 0);
  await page.clock.runFor(2100);
  await expect(progress).not.toHaveAttribute('value', focusedValue!);
  });

  test(`review: ${theme} explicit memory resume overrides the current hover`, async ({page, isMobile}) => {
  test.skip(isMobile, '悬停恢复验证需要鼠标');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');
  await setTheme(page, theme);
  await page.keyboard.press('ArrowDown');
  const memory = page.locator('[data-home-section="memory"]');
  const photo = memory.getByRole('button', {name: /主回忆自动播放/});
  const progress = memory.getByRole('progressbar');

  // 用真实节奏验证：本版 Playwright 的假时钟不冻结时间，真实 2 秒节奏照走而 runFor 又叠加一次，
  // 断言会同时受两套时钟影响（实测同一用例 20 次里失败 5–17 次），因此这里不装假时钟。
  await photo.hover();
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /^继续主回忆自动播放/);
  const pausedValue = await progress.getAttribute('value');
  await page.waitForTimeout(3000);
  await expect(progress).toHaveAttribute('value', pausedValue!);

  // 显式恢复覆盖当前悬停：指针仍在播放器内也立即继续计时
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /^暂停主回忆自动播放/);
  await expect.poll(() => progress.getAttribute('value'), {timeout: 4000}).not.toBe(pausedValue);

  // 指针与焦点都离开后覆盖结束，播放继续
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4, 4);
  const leftValue = await progress.getAttribute('value');
  await expect.poll(() => progress.getAttribute('value'), {timeout: 4000}).not.toBe(leftValue);

  // 覆盖已结束：再次进入恢复普通悬停暂停
  await photo.hover();
  const hoveredValue = await progress.getAttribute('value');
  await page.waitForTimeout(3000);
  await expect(progress).toHaveAttribute('value', hoveredValue!);
  });
}
