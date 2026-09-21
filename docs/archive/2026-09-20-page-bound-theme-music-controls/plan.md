# 音乐与主题按钮随页面滚动实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将音乐和主题按钮从视口固定层迁到各主题页面内容层，使首页控件随第一屏离开、其他页面主题按钮随页面顶部离开。

**Architecture:** `BeachApp`/`GrasslandApp` 为控件提供独立定位包装层；主题组件本身只保留 44px 内部布局，不再决定 fixed 坐标。首页包装层位于第一屏右上/右下，非首页主题包装层位于页面右上，状态和命令契约不变。

**Tech Stack:** React、TypeScript、CSS Modules、Playwright、Vite。

## Global Constraints

- 不使用 fixed 或 sticky；首页第二屏不重复控件。
- 音乐只在首页第一屏右上，主题在首页第一屏右下；非首页主题在页面右上。
- 右侧/顶部/底部 18px、安全区、32px 表面和 44px 命中区保持。
- 滚动不改变音乐状态；查看器继续使用内部主题切换。

---

### Task 1: 添加滚动归属失败验收

**Files:**
- Modify: `tests/browsing.spec.ts`

- [ ] 在首页控件用例中断言两个 dock 的 computed `position` 不是 fixed/sticky。
- [ ] 滚动到第二屏后断言音乐和页面主题按钮均不在视口，音乐 `aria-pressed` 与 audio paused 状态不因滚动改变；返回第一屏后重新可见。
- [ ] 在 `#/browse` 滚动到底部后断言页面主题按钮离开视口；打开查看器后内部主题按钮仍可用。
- [ ] 运行定向 Playwright，预期现有 fixed 控件仍可见而失败。

### Task 2: 实现页面内容层定位

**Files:**
- Modify: `src/themes/beach/BeachApp.tsx`
- Modify: `src/themes/beach/BeachApp.module.css`
- Modify: `src/themes/beach/BeachMusicToggle.module.css`
- Modify: `src/themes/beach/BeachThemeSwitch.module.css`
- Modify: `src/themes/grassland/GrasslandApp.tsx`
- Modify: `src/themes/grassland/GrasslandApp.module.css`
- Modify: `src/themes/grassland/GrasslandMusicToggle.module.css`
- Modify: `src/themes/grassland/GrasslandThemeSwitch.module.css`

- [ ] 两套 App 的 `.shell` 增加 `position:relative`，用 `musicControl`、`themeControl` 包装现有组件。
- [ ] 首页音乐包装层 absolute 定位第一屏右上；首页主题包装层 absolute 定位 `top:calc(100dvh - 62px)`；非首页主题包装层 absolute 定位页面右上。
- [ ] 包装层使用右侧安全区并保持 44px 尺寸和 z-index；组件 `.dock` 改为 `position:relative; inset:auto`，不再 fixed。
- [ ] 运行定向 Playwright并核对桌面/移动端滚动前后。

### Task 3: 同步基线、完整验证与归档

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `src/themes/module.md`
- Modify: `docs/changes/page-bound-theme-music-controls/change.json`
- Create: `docs/changes/page-bound-theme-music-controls/tasks.md`
- Modify: `docs/archive/README.md`
- Move: `docs/changes/page-bound-theme-music-controls/` → `docs/archive/2026-09-20-page-bound-theme-music-controls/`

- [ ] 同步页面内容层、首页第一屏、非首页顶部和滚动离开行为。
- [ ] 运行 `npm run check`、`npm run build`、`npm run test:e2e` 并记录证据。
- [ ] 运行 SDD 工作区覆盖检查，通过后归档、更新索引并复核 `git diff --check` 与 SDD。

## Rollback

仅撤销 App 控件包装层、四个 dock 的定位变化、对应测试和本次基线同步；不撤销按钮右上/右下视觉、状态图标、主题切换或音乐逻辑。
