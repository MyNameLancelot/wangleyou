# 音乐按钮位置与状态视觉实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将两套主题的音乐按钮移到主题按钮正上方，并用斜杠音符清楚表达暂停状态。

**Architecture:** 保持 `App` 和 playback 为背景音乐状态的唯一来源，只根据现有 `playing` 布尔值渲染状态视觉。两套主题分别修改自己的音乐组件和 CSS；当前 Lucide 版本没有 `MusicOff`，因此复用已有 `Music` 并在暂停态增加对读屏隐藏的 CSS 斜杠，不新增依赖或共享 UI。

**Tech Stack:** React、TypeScript、CSS Modules、lucide-react、Playwright、Vitest、Vite。

## Global Constraints

- 音乐按钮与主题按钮在右下角纵向排列，右侧中心线误差不超过 2px，44px 命中区间距为 8–16px。
- 播放态显示普通音符与现有波纹；暂停态显示降强调的斜杠音符且无波纹。
- 不改变背景音乐资源、音量、循环、自动播放限制、视频阻断、主题按钮行为或主题持久化。
- 海边和草原 JSX/CSS 独立修改，不跨主题导入 UI，不新增依赖。
- `aria-pressed` 和“播放/暂停背景音乐”可访问名称继续由现有播放状态驱动。

---

### Task 1: 添加位置和状态视觉的失败验收

**Files:**
- Modify: `tests/browsing.spec.ts`

**Interfaces:**
- Consumes: `data-testid="music-toggle"`、`data-testid="theme-switch"`、`data-playing`、`data-music-icon`。
- Produces: 浏览器断言要求暂停图标含 `data-music-muted-mark`，并验证两个悬浮控件的相对位置。

- [ ] **Step 1: 更新共存用例的几何断言**

在 `theme switch and background music controls coexist without overlap` 中，用音乐和主题按钮的 `boundingBox()` 断言：

```ts
expect(Math.abs(
  ((musicBox?.x ?? 0) + (musicBox?.width ?? 0) / 2) -
  ((themeBox?.x ?? 0) + (themeBox?.width ?? 0) / 2),
)).toBeLessThanOrEqual(2);
const verticalGap = (themeBox?.y ?? 0) - ((musicBox?.y ?? 0) + (musicBox?.height ?? 0));
expect(verticalGap).toBeGreaterThanOrEqual(8);
expect(verticalGap).toBeLessThanOrEqual(16);
```

- [ ] **Step 2: 更新暂停与播放状态断言**

在首次点击前断言暂停标记可见、无播放波纹；点击播放后断言暂停标记隐藏且 `data-playing="true"`；再次点击暂停后恢复：

```ts
const mutedMark = music.locator('[data-music-muted-mark]');
await expect(mutedMark).toBeVisible();
await expect(music).toHaveAttribute('data-playing', 'false');
await button.click();
await expect(music).toHaveAttribute('data-playing', 'true');
await expect(mutedMark).toBeHidden();
await button.click();
await expect(music).toHaveAttribute('data-playing', 'false');
await expect(mutedMark).toBeVisible();
```

- [ ] **Step 3: 运行失败验收**

Run: `npm run build && npx playwright test tests/browsing.spec.ts -g "theme switch and background music"`

Expected: FAIL；现有音乐按钮仍位于屏幕中央，且不存在 `data-music-muted-mark`。

### Task 2: 分别实现两套主题的位置与状态视觉

**Files:**
- Modify: `src/themes/beach/BeachMusicToggle.tsx`
- Modify: `src/themes/beach/BeachMusicToggle.module.css`
- Modify: `src/themes/grassland/GrasslandMusicToggle.tsx`
- Modify: `src/themes/grassland/GrasslandMusicToggle.module.css`

**Interfaces:**
- Consumes: `playing = isBackgroundMusicPlaying(music)`。
- Produces: 暂停态装饰 `<span className={styles.mutedMark} aria-hidden="true" data-music-muted-mark />`；定位 CSS 与主题按钮共用相同 `right` 和安全区基准。

- [ ] **Step 1: 为海边主题增加暂停斜杠并更新注释**

在 `Music` 后增加：

```tsx
{!playing && <span className={styles.mutedMark} aria-hidden="true" data-music-muted-mark />}
```

组件注释改为“位于主题按钮正上方；播放为音符与波纹，暂停为斜杠音符”。

- [ ] **Step 2: 调整海边主题音乐按钮 CSS**

将 `.dock` 的中央定位改为：

```css
.dock{position:fixed;right:max(1.125rem,env(safe-area-inset-right));bottom:calc(max(1.125rem,env(safe-area-inset-bottom)) + 56px);z-index:40;width:44px;height:44px;filter:drop-shadow(0 .5rem 1rem rgb(0 55 75/.2))}
```

补充暂停弱化和斜杠：

```css
.dock[data-playing='false'] .button{background:rgb(237 252 255/.62);color:rgb(10 74 95/.68)}
.mutedMark{position:absolute;width:24px;height:2px;border-radius:999px;background:currentColor;transform:rotate(-45deg);box-shadow:0 0 0 2px rgb(237 252 255/.72)}
```

- [ ] **Step 3: 为草原主题增加相同语义的独立实现**

在草原组件增加相同的条件装饰节点，并将 `.dock` 改为相同右侧和垂直定位；暂停色使用草原色：

```css
.dock[data-playing='false'] .button{background:rgb(246 250 232/.64);color:rgb(45 72 44/.68)}
.mutedMark{position:absolute;width:24px;height:2px;border-radius:999px;background:currentColor;transform:rotate(-45deg);box-shadow:0 0 0 2px rgb(246 250 232/.74)}
```

- [ ] **Step 4: 运行定向验收**

Run: `npm run build && npx playwright test tests/browsing.spec.ts -g "theme switch and background music"`

Expected: desktop-chrome 与 mobile-chrome 均通过。

### Task 3: 同步产品、架构和模块基线

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `src/themes/module.md`
- Modify: `docs/changes/music-toggle-placement-state/change.json`

**Interfaces:** 无运行时接口变化。

- [ ] **Step 1: 更新需求基线**

在背景音乐和主题段明确：首页音乐按钮位于主题按钮正上方；播放显示音符与波纹，暂停显示降强调的斜杠音符且无波纹；两者均保持 44×44px 命中区和安全区。

- [ ] **Step 2: 更新架构与模块契约**

记录音乐按钮只消费 playback 状态、不持有第二套状态；两套主题分别实现其视觉，悬浮控件在右下角纵向排列。

- [ ] **Step 3: 将 change.json 的三项 pending 改为 updated**

分别保留 `docs/requirements.md`、`docs/architecture.md`、`src/themes/module.md` 路径，并将理由改为已经同步的实际内容。

### Task 4: 完整验证、证据与归档

**Files:**
- Modify: `docs/changes/music-toggle-placement-state/change.json`
- Modify: `docs/archive/README.md`
- Move: `docs/changes/music-toggle-placement-state/` → `docs/archive/2026-09-20-music-toggle-placement-state/`

**Interfaces:** 无运行时接口变化。

- [ ] **Step 1: 运行静态与单元检查**

Run: `npm run check`

Expected: SDD 结构、内容校验、TypeScript、ESLint 和全部 Vitest 测试通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: Vite 生产构建成功并输出资源体积。

- [ ] **Step 3: 运行完整浏览器验收**

Run: `npm run test:e2e`

Expected: 所有适用用例通过；设备能力相关跳过项如实记录。

- [ ] **Step 4: 记录证据并检查 SDD 覆盖**

将实际命令结果写入 `change.json.verification`，再运行：

Run: `npm run check:sdd -- --worktree --base origin/main`

Expected: 工作区全部差异路径被活动变更覆盖。

- [ ] **Step 5: 满足完成条件后归档**

把整个变更目录移至 `docs/archive/2026-09-20-music-toggle-placement-state/`，在 `docs/archive/README.md` 增加索引，再次运行 `git diff --check` 与 SDD 覆盖检查。

## Rollback

仅恢复两套 `MusicToggle.tsx` 和对应 CSS Module 的本次位置/斜杠视觉修改，撤销本次 Playwright 断言与三份基线文档同步；不改动主题按钮恢复、背景音乐状态逻辑、音频资源或首页主回忆工作。
