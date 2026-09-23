import { test, expect } from '@playwright/test';
import {
  routeDistMedia,
} from './support';

test.beforeEach(async ({ page }) => {
  await routeDistMedia(page);
});

test('theme switch and background music controls coexist without overlap', async ({page}, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chrome' ? {width: 360, height: 800} : {width: 1440, height: 900};
  await page.setViewportSize(viewport);
  await page.goto('./');
  await expect(page.getByRole('navigation', {name: '主导航'})).toHaveCount(0);

  const music = page.getByTestId('music-toggle');
  const button = music.getByRole('button', {name: /背景音乐/});
  const musicSurface = music.locator('[data-music-surface]');
  const musicGlyph = music.locator('[data-music-glyph]');
  const audio = page.getByTestId('background-music');
  const themeDock = page.getByTestId('theme-switch');
  const themeButton = themeDock.getByRole('button', {name: /切换主题/});
  const themeSurface = themeDock.locator('[data-theme-switch-surface]');
  const themeLabel = themeDock.getByText('主题切换', {exact: true});
  const mutedMark = music.locator('[data-music-muted-mark]');
  await expect(button).toBeVisible();
  await expect(music.locator('[data-music-icon]')).toBeVisible();
  await expect(mutedMark).toBeVisible();
  await expect(music).toHaveAttribute('data-playing', 'false');
  expect(await musicSurface.evaluate(node => getComputedStyle(node, '::after').content)).toBe('none');
  await expect(themeButton).toBeVisible();
  await expect(themeButton.locator('[data-theme-switch-icon="cycle"]')).toBeVisible();
  expect(await music.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);
  expect(await themeDock.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);

  const box = await button.boundingBox();
  const musicSurfaceBox = await musicSurface.boundingBox();
  const themeBox = await themeButton.boundingBox();
  const collapsedSurface = await themeSurface.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(
    ((box?.x ?? 0) + (box?.width ?? 0) / 2) -
    ((themeBox?.x ?? 0) + (themeBox?.width ?? 0) / 2),
  )).toBeLessThanOrEqual(2);
  expect(box?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  expect(box?.y).toBeCloseTo(18, 0);
  expect(musicSurfaceBox?.width).toBeCloseTo(32, 0);
  expect(musicSurfaceBox?.height).toBeCloseTo(32, 0);
  expect(themeBox?.width).toBeGreaterThanOrEqual(44);
  expect(themeBox?.height).toBeGreaterThanOrEqual(44);
  expect(collapsedSurface?.width).toBeCloseTo(32, 0);
  expect(collapsedSurface?.x).toBeGreaterThan(viewport.width - 220);
  expect(collapsedSurface?.y).toBeGreaterThan(viewport.height - 100);
  expect(await themeLabel.evaluate(node => getComputedStyle(node).opacity)).toBe('0');

  await page.mouse.move(1, 1);
  expect(await musicGlyph.evaluate(node => getComputedStyle(node).transform)).toBe('none');
  await button.hover();
  await expect.poll(async () => {
    const transform = await musicGlyph.evaluate(node => getComputedStyle(node).transform);
    return transform === 'none' ? 1 : Number(transform.split('(')[1].split(',')[0]);
  }).toBeCloseTo(1.1, 1);
  await page.mouse.move(1, 1);
  await expect.poll(() => musicGlyph.evaluate(node => getComputedStyle(node).transform)).toBe('none');

  await themeButton.hover();
  await expect.poll(async () => Number(await themeLabel.evaluate(node => getComputedStyle(node).opacity))).toBe(1);
  await expect.poll(async () => (await themeSurface.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(104);
  expect((await themeSurface.boundingBox())?.width).toBeLessThanOrEqual(122);
  await themeButton.focus();
  await expect(themeButton).toBeFocused();
  expect(await themeButton.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');

  expect(await audio.getAttribute('src')).toContain('media/themes/beach/music.mp3');
  await page.waitForTimeout(320);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-music-toggle-hero.png`,
    clip: {x: viewport.width - 150, y: 0, width: 150, height: 135},
  });

  // 播放中滚到第二屏，两个页面控件随第一屏离开，但音乐状态不变
  const initial = await button.getAttribute('aria-pressed');
  await button.click();
  await expect.poll(() => button.getAttribute('aria-pressed')).not.toBe(initial);
  await expect(music).toHaveAttribute('data-playing', 'true');
  await expect(mutedMark).toBeHidden();
  expect(await musicSurface.evaluate(node => ({
    before: getComputedStyle(node, '::before').content,
    after: getComputedStyle(node, '::after').content,
    beforeAnimation: getComputedStyle(node, '::before').animationName,
    afterAnimation: getComputedStyle(node, '::after').animationName,
  }))).toEqual({before: 'none', after: 'none', beforeAnimation: 'none', afterAnimation: 'none'});
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  await page.evaluate(height => window.scrollTo({top: height, behavior: 'instant'}), viewport.height);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(viewport.height - 1);
  await expect(page.locator('[data-home-section="memory"]')).toBeInViewport({ratio: 0.95});
  await expect(music).not.toBeInViewport();
  await expect(themeDock).not.toBeInViewport();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  // 回顶只要求页面能停在第一屏顶部：CI 上 Chrome 曾把程序性回顶的结果改写为 66px / 81px 并稳定数秒，
  // 而诊断用例记录的每次 scroll 事件调用栈都只来自测试自身的 scrollTo，应用侧没有任何滚动写入。
  // 因此这里在同一语义下重发回顶，位置以外的用户可见结果由后续“首屏与两个控件回到视口”断言把关。
  await expect.poll(async () => {
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    return page.evaluate(() => Math.round(scrollY));
  }).toBeLessThanOrEqual(10);
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport({ratio: 0.95});
  await expect(music).toBeInViewport();
  await expect(themeDock).toBeInViewport();

  // 返回第一屏后可以暂停，状态与音频元素一致
  await button.click();
  await expect.poll(() => button.getAttribute('aria-pressed')).toBe(initial);
  await expect(music).toHaveAttribute('data-playing', 'false');
  await expect(mutedMark).toBeVisible();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);
  await themeButton.focus();
  // 每个音乐入口后面跟着自己的音量控件，反向遍历直到回到音乐按钮
  for (let step = 0; step < 5; step += 1) {
    if (await button.evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Shift+Tab');
  }
  await expect(button).toBeFocused();
  expect(await button.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
  await expect.poll(async () => {
    const transform = await musicGlyph.evaluate(node => getComputedStyle(node).transform);
    return transform === 'none' ? 1 : Number(transform.split('(')[1].split(',')[0]);
  }).toBeCloseTo(1.1, 1);
  await expect.poll(async () => {
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    return page.evaluate(() => Math.round(scrollY));
  }).toBeLessThanOrEqual(10);

  // 草原主题拥有同样的独立位置与暂停视觉实现
  await themeButton.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('grassland');
  // 收起状态才比较两个入口的中心线：单击后按钮仍处于悬浮/聚焦展开的过渡中
  await page.mouse.move(2,2);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(250);
  const grasslandMusicBox = await page.getByTestId('music-toggle').getByRole('button', {name: /背景音乐/}).boundingBox();
  const grasslandSurfaceBox = await page.getByTestId('music-toggle').locator('[data-music-surface]').boundingBox();
  // 主题切换会整体重挂载，中心线用轮询等待布局稳定
  await expect.poll(async () => {
    const [musicBox, themeBox] = await Promise.all([
      page.getByTestId('music-toggle').getByRole('button', {name: /背景音乐/}).boundingBox(),
      page.getByTestId('theme-switch').getByRole('button', {name: /切换主题/}).boundingBox(),
    ]);
    return Math.abs(
      ((musicBox?.x ?? 0) + (musicBox?.width ?? 0) / 2) -
      ((themeBox?.x ?? 0) + (themeBox?.width ?? 0) / 2),
    );
  }).toBeLessThanOrEqual(2);
  expect(grasslandMusicBox?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  // 用页面绝对坐标断言顶部间距，避免滚动残留影响几何读数
  const grasslandScrollY = await page.evaluate(() => scrollY);
  expect(Math.abs(((grasslandMusicBox?.y ?? 0) + grasslandScrollY) - 18)).toBeLessThanOrEqual(2);
  expect(grasslandSurfaceBox?.width).toBeCloseTo(32, 0);
  expect(grasslandSurfaceBox?.height).toBeCloseTo(32, 0);
  await expect(page.getByTestId('music-toggle').locator('[data-music-muted-mark]')).toBeVisible();
});

test('two-screen music controls share one audio while theme stays on the first screen', async ({page}, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chrome' ? {width: 360, height: 800} : {width: 1440, height: 900};
  await page.setViewportSize(viewport);
  await page.goto('./');

  const heroMusic = page.locator('[data-music-screen="hero"]');
  const memoryMusic = page.locator('[data-music-screen="memory"]');
  const theme = page.getByTestId('theme-switch');
  const audio = page.getByTestId('background-music');
  await expect(audio).toHaveCount(1);
  await expect(heroMusic).toBeInViewport();
  await expect(memoryMusic).not.toBeInViewport();
  await expect(theme).toBeInViewport();
  expect(await heroMusic.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);
  expect(await memoryMusic.evaluate(node => getComputedStyle(node).position)).not.toMatch(/fixed|sticky/);

  const heroBox = await heroMusic.boundingBox();
  expect(heroBox?.width).toBeGreaterThanOrEqual(44);
  expect(heroBox?.height).toBeGreaterThanOrEqual(44);
  expect(heroBox?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  expect(heroBox?.y).toBeCloseTo(18, 0);
  await heroMusic.getByRole('button', {name: '播放背景音乐'}).click();
  await expect(heroMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(memoryMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);

  await page.evaluate(height => window.scrollTo({top: height, behavior: 'instant'}), viewport.height);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(viewport.height - 1);
  await expect(heroMusic).not.toBeInViewport();
  await expect(theme).not.toBeInViewport();
  await expect(memoryMusic).toBeInViewport();
  const memoryBox = await memoryMusic.boundingBox();
  expect(memoryBox?.width).toBeGreaterThanOrEqual(44);
  expect(memoryBox?.height).toBeGreaterThanOrEqual(44);
  expect(memoryBox?.x).toBeCloseTo(viewport.width - 18 - 44, 0);
  expect(memoryBox?.y).toBeCloseTo(18, 0);
  await heroMusic.getByRole('button').focus();
  // 先到第一屏自己的音量控件，再继续到第二屏的音乐入口
  await page.keyboard.press('Tab');
  await expect(heroMusic.getByRole('slider', {name: '背景音乐音量'})).toBeFocused();
  for (let step = 0; step < 5; step += 1) {
    if (await memoryMusic.getByRole('button').evaluate(node => node === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(memoryMusic.getByRole('button')).toBeFocused();
  expect(await memoryMusic.getByRole('button').evaluate(node => getComputedStyle(node).outlineStyle)).toBe('solid');
  await memoryMusic.getByRole('button', {name: '暂停背景音乐'}).click();
  await expect(memoryMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  await expect(heroMusic.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);

  // 第二屏按钮仍聚焦时，移动端可能在下一帧把视口重新滚回焦点；先释放焦点再回顶。
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // 全局 html { scroll-behavior: smooth } 下，移动端模拟环境用 behavior: 'instant' 回顶会偶发停在
  // 2–10px（第二轮程序化滚动或改用 'auto' 可立即归零）；这里用 'auto' 避免把环境抖动当成产品缺陷。
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'auto'}));
  // 移动端 dvh + scroll-snap 在并行负载下可能残留 1–2px，这里只要求回到首屏顶部
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThanOrEqual(4);
  await expect(heroMusic).toBeInViewport();
  await expect(heroMusic.locator('[data-music-muted-mark]')).toBeVisible();
});

test('music icon reveals a right-aligned volume control on hover and focus', async ({page}, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chrome' ? {width: 360, height: 800} : {width: 1440, height: 900};
  await page.setViewportSize(viewport);
  await page.goto('./');
  const music = page.getByTestId('music-toggle');
  const button = music.getByRole('button', {name: /背景音乐/});
  const panel = page.getByTestId('music-volume');
  // 暂停时面板对整个无障碍树隐藏，因此用数据标记定位；播放态再校验可访问名称
  const slider = panel.locator('[data-music-volume-slider]');
  const surface = music.locator('[data-music-surface]');
  const audio = page.getByTestId('background-music');
  const panelOpacity = () => panel.evaluate(node => getComputedStyle(node).opacity);

  // 暂停状态不提供音量入口：悬停不展开，滑块也不在键盘顺序里
  await expect(music).toHaveAttribute('data-playing','false');
  expect(await panelOpacity()).toBe('0');
  await button.hover();
  await page.waitForTimeout(250);
  expect(await panelOpacity()).toBe('0');
  await expect(slider).toHaveAttribute('tabindex','-1');

  // 播放状态下悬停音乐图标，在图标下方展开
  await button.click();
  await expect(music).toHaveAttribute('data-playing','true');
  await button.hover();
  await expect.poll(panelOpacity).toBe('1');
  await expect(panel.getByRole('slider', {name: '背景音乐音量'})).toBeVisible();
  const surfaceBox = await surface.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(Math.abs((panelBox?.x ?? 0) + (panelBox?.width ?? 0) - ((surfaceBox?.x ?? 0) + (surfaceBox?.width ?? 0)))).toBeLessThanOrEqual(2);
  expect(panelBox?.y ?? 0).toBeGreaterThanOrEqual((surfaceBox?.y ?? 0) + (surfaceBox?.height ?? 0) - 1);
  const sliderBox = await slider.boundingBox();
  expect(sliderBox?.height).toBeGreaterThanOrEqual(44);
  expect(sliderBox?.width).toBeGreaterThanOrEqual(44);

  // 键盘聚焦同样展开，并即时写入实际播放音量
  await slider.focus();
  await expect.poll(panelOpacity).toBe('1');
  await slider.press('Home');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBe(0);
  await slider.press('ArrowRight');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBeCloseTo(0.05, 2);
  await expect(panel.locator('[data-music-volume-slider]')).toHaveValue('0.05');
  // 第二屏入口共享同一音量
  await expect(page.locator('[data-music-volume="memory"] input')).toHaveValue('0.05');

  // 指针与焦点都离开后收起
  await page.mouse.move(4,4);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(panelOpacity).toBe('0');
});

test('mobile long press opens the volume control without toggling playback', async ({page, isMobile}) => {
  test.skip(!isMobile, '长按入口只在触屏项目验证');
  await page.goto('./');
  const music = page.getByTestId('music-toggle');
  const button = music.getByRole('button', {name: /背景音乐/});
  const panel = page.getByTestId('music-volume');
  const slider = panel.getByRole('slider', {name: '背景音乐音量'});
  const audio = page.getByTestId('background-music');
  const panelOpacity = () => panel.evaluate(node => getComputedStyle(node).opacity);
  const box = await button.boundingBox();
  const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
  const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;
  const pressedBefore = await button.getAttribute('aria-pressed');

  const touchSession = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchEnd', points: Array<{x: number; y: number}>) =>
    touchSession.send('Input.dispatchTouchEvent', {type, touchPoints: points});

  // 暂停状态长按不展开，按普通点击处理（开始播放）
  await touch('touchStart', [{x, y}]);
  await page.waitForTimeout(700);
  await touch('touchEnd', []);
  await expect(music).toHaveAttribute('data-volume-pinned', 'false');
  await expect(music).toHaveAttribute('data-playing', 'true');

  // 播放状态下长按展开音量面板，且不切换播放状态
  await touch('touchStart', [{x, y}]);
  await page.waitForTimeout(700);
  await expect(music).toHaveAttribute('data-volume-pinned', 'true');
  await touch('touchEnd', []);
  await expect.poll(panelOpacity).toBe('1');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(pressedBefore).toBe('false');

  // 展开后的面板可以调音量
  await slider.focus();
  await slider.press('Home');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBe(0);

  // 点击面板外收起
  await page.touchscreen.tap(12, 740);
  await expect(music).toHaveAttribute('data-volume-pinned', 'false');
  await expect.poll(panelOpacity).toBe('0');
  await expect(page.locator('[data-home-section="hero"]')).toBeInViewport();
  await touchSession.detach();
});

test('background music preference survives reload and resumes on first interaction', async ({page}) => {
  // 偏好键与 playback 契约一致：显式切换/调整才写入，浏览器拦截与程序性暂停不写
  const stored = () => page.evaluate(() => JSON.parse(window.localStorage.getItem('wangleyou:background-music') ?? 'null'));
  await page.goto('./');
  const music = page.getByTestId('music-toggle');
  const controls = page.getByTestId('music-controls');
  const button = music.getByRole('button', {name: /背景音乐/});
  const slider = music.locator('[data-music-volume-slider]');
  const audio = page.getByTestId('background-music');

  // 显式开启并调整音量：意图与音量写入本地缓存
  await button.click();
  await expect(music).toHaveAttribute('data-playing', 'true');
  await slider.focus();
  await slider.press('Home');
  await slider.press('ArrowRight');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBeCloseTo(0.05, 2);
  await expect.poll(stored).toMatchObject({intent: 'playing', volume: 0.05});

  // 刷新：无用户手势，自动播放被拒绝进入阻塞视觉；任意首次交互用同一手势恢复播放与音量
  await page.reload();
  await expect(controls).toHaveAttribute('data-music-status', 'blocked');
  await expect.poll(stored).toMatchObject({intent: 'playing', volume: 0.05});
  await page.mouse.click(200, 400);
  await expect(music).toHaveAttribute('data-playing', 'true');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).volume)).toBeCloseTo(0.05, 2);

  // 显式暂停后刷新：缓存为暂停，刷新保持暂停且不尝试自动播放
  await button.click();
  await expect(music).toHaveAttribute('data-playing', 'false');
  await expect.poll(stored).toMatchObject({intent: 'paused'});
  await page.reload();
  await expect.poll(() => music.getAttribute('data-playing')).toBe('false');
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);
});

test('review: returning to the foreground waits for explicit resumes', async ({page}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chrome', '桌面用例专门验证程序性暂停语义');
  const setVisibility = (visible: boolean) => page.evaluate(state => {
    Object.defineProperty(document, 'visibilityState', {configurable: true, get: () => state});
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible ? 'visible' : 'hidden');
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('./');

  // 背景音乐：隐藏停止，回前台不自动播放，按钮点击显式恢复。
  const music = page.locator('[data-music-screen="hero"]');
  const audio = page.getByTestId('background-music');
  await music.getByRole('button').click();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);
  await setVisibility(false);
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(true);
  await setVisibility(true);
  await page.waitForTimeout(100);
  await expect(audio).toHaveJSProperty('paused', true);
  await music.getByRole('button').click();
  await expect.poll(() => audio.evaluate(node => (node as HTMLAudioElement).paused)).toBe(false);

  // 主回忆：回前台仍停住；点击暂停再点击恢复属于显式操作，覆盖指针停留。
  await page.getByRole('button', {name: /开启回忆/}).click();
  await expect(page.locator('[data-home-section="memory"]')).toBeInViewport();
  const memory = page.locator('[data-home-section="memory"]');
  const photo = memory.getByRole('button', {name: /主回忆自动播放/});
  const progress = memory.getByRole('progressbar');
  await setVisibility(false);
  await setVisibility(true);
  const heldValue = await progress.getAttribute('value');
  await page.waitForTimeout(4300);
  await expect(progress).toHaveAttribute('value', heldValue!);
  await photo.hover();
  await photo.click();
  await expect(photo).toHaveAttribute('aria-label', /^继续主回忆自动播放/);
  const play = memory.getByRole('button', {name: '继续播放主回忆'});
  await play.click();
  await expect(photo).toHaveAttribute('aria-label', /^暂停主回忆自动播放/);
  const resumedValue = await progress.getAttribute('value');
  await expect.poll(() => progress.getAttribute('value'), {timeout: 3500}).not.toBe(resumedValue);
});

for (const theme of ['beach', 'grassland'] as const) {
  test(`review: ${theme} unavailable localStorage still allows music controls`, async ({page}) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(name => {
    localStorage.setItem('wangleyou.theme', name);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage disabled', 'SecurityError'); },
    });
  }, theme);
  await page.goto('./');
  await expect(page.getByRole('heading', {level: 1})).toBeVisible();
  // 主题存储同样不可读，按既有约定回退海边；切换后核对另一个主题。
  if (theme === 'grassland') await page.getByTestId('theme-switch').click();
  const music = page.locator('[data-music-screen="hero"]');
  // 切换主题的手势已经恢复音乐；不要按瞬时 paused 状态再次切换意图。
  if (theme === 'beach') await music.getByRole('button').click();
  await expect(music).toHaveAttribute('data-playing', 'true');
  const slider = music.getByRole('slider');
  await slider.focus();
  await slider.press('ArrowLeft');
  await expect(slider).toHaveValue('0.45');
  await music.getByRole('button').click();
  await expect(music).toHaveAttribute('data-playing', 'false');
  expect(errors).toEqual([]);
  });
}
