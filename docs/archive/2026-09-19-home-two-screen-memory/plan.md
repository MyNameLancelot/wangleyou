# 首页两屏主回忆实施计划

**关联规格：** [首页两屏主回忆规格](spec.md)

## 影响文件与职责

| 文件 | 变更职责 |
| --- | --- |
| `public/media/theme/beach-home-hero-2k.webp` | 用户确认海滩图的 2560×1440、质量 82 WebP 发布资源。 |
| `public/media/SOURCES.md` | 记录该图为用户提供并经 AI 增强、重采样与 WebP 编码。 |
| `src/albums/home-memory.ts` | 首页两段导航和照片回忆队列的纯函数、类型与阈值。 |
| `src/albums/home-memory.test.ts` | 覆盖段切换边界、队列构建、照片推进和暂停边界。 |
| `src/albums/AlbumPages.tsx` | 组合两屏首页、滚动/键盘/触控事件与主回忆可访问控件。 |
| `src/albums/AlbumPages.module.css` | 两屏尺寸、背景裁切、毛玻璃纹理、立体阴影、主回忆视觉与响应式降级。 |
| `src/albums/AlbumPages.test.tsx` | 验证首页结构、控件名称和空状态。 |
| `src/albums/module.md` | 同步首页整屏导航与主回忆的职责、状态与验证。 |
| `docs/requirements.md`、`docs/architecture.md` | 同步完成后的首页行为和状态边界。 |

## 实施顺序

### 1. 写入发布资源与可测纯状态

1. 将已审阅的 `/private/tmp/beach-home-hero-review-2k.webp` 复制为 `public/media/theme/beach-home-hero-2k.webp`，不覆盖现有主题图。
2. 在 `public/media/SOURCES.md` 标记它的来源、2560×1440 尺寸、WebP 编码和非原始素材属性。
3. 创建 `src/albums/home-memory.ts`，导出：

```ts
export type HomeSection = 'hero' | 'memory';
export type HomeMemory = { items: Array<{ album: Album; media: Photo }>; index: number; playing: boolean };
export const HOME_MEMORY_INTERVAL_MS = 5_000;
export function nextHomeSection(section: HomeSection, delta: -1 | 1): HomeSection;
export function createHomeMemory(albums: Album[], limit?: number): HomeMemory;
export function stepHomeMemory(memory: HomeMemory, delta: -1 | 1, loop?: boolean): HomeMemory;
```

4. 先写失败测试：两段导航在边界保持当前段；队列仅含照片、按内容日期新到旧取最多 12 条；上一张/下一张循环或非循环规则明确。
5. 用最小纯函数实现使测试通过。

验证：`npx vitest run src/albums/home-memory.test.ts`。

### 2. 组合首页两段与主回忆操作

1. 扩展 `HomePage`：创建 `section`、`homeMemory`、活动段、播放计时器与手势起点的本地状态；队列为空时显示主回忆空状态。
2. 让“开始回忆”调用 `scrollToSection('memory')`；该函数以 `scrollIntoView({ behavior })` 定位对应段，减少动态效果时使用 `auto`。
3. 绑定窗口滚轮、键盘和触摸事件：累积 `deltaY` 至 56px 才切换，切换锁定 600ms；按钮、链接、输入和查看器上下文不劫持方向键；触摸仅在垂直距离至少 56px、且垂直绝对值大于水平绝对值时切换。
4. 在第二屏活动、页面可见且 `playing` 时创建 5 秒计时器推进照片；依赖变化、离开第二屏、页面隐藏、暂停、查看器打开和组件卸载均清理计时器。
5. 提供语义按钮：暂停/继续、上一张、下一张、查看当前照片；查看按钮调用既有 `onOpen(album, media.id)`。
6. 增加静态渲染测试，断言两段地标、主回忆按钮、进度信息和无照片空状态存在。

验证：`npx vitest run src/albums/AlbumPages.test.tsx src/albums/home-memory.test.ts`。

### 3. 实现海滩画面与玻璃视觉

1. 海边主题首页传入新 2K 图；草原主题继续使用已有资源，不受本次首屏替换影响。
2. 将首页容器改为两段 `min-height: 100dvh`，在桌面以 `scroll-snap-type: y mandatory` 和每段 `scroll-snap-align: start` 作为原生兜底，JS 负责意图阈值和锁定。
3. 首屏使用 `background-size: cover`，保留右侧小船区域；移动端调整位置让海浪可见并保留文字区对比度。
4. 毛玻璃卡片使用四层：半透明渐变底色、`backdrop-filter: blur(24px) saturate(150%)`、细密 CSS noise/高光纹理伪元素、内侧高光描边与外侧多层阴影。纹理仅视觉层，`pointer-events: none`。
5. 使用 `@supports not (backdrop-filter: blur(1px))` 增加更不透明底色；`prefers-reduced-motion` 移除卡片漂浮和照片转场；移动端全部控件最小 44px。

验证：`npm run build`；Playwright Chromium 在 1440×900、1920×1080、2560×1440、390×844 检查两段定位、背景无空白、玻璃可读性与无横向溢出。

### 4. 同步基线并完成验证

1. 更新 `src/albums/module.md`，声明首页两段导航、主回忆本地状态和计时器清理归属；不把状态放入 playback。
2. 更新需求和架构中首页、无障碍与资源生命周期的真实实施行为。
3. 按 AC-1 至 AC-7 执行 `npm run check`、`npm run build`、`npm run test:e2e`，将实际输出、浏览器版本、视口与未验证项写入 `verification.md`、`change.json` 和 `tasks.md`。

## 回退

保留现有 `beach-hero.webp`。如新图或两段交互出现回归，恢复 `HomePage` 的当前常规页面结构并移除新资源引用即可；内容 JSON、路由和查看器会话均不受影响。
