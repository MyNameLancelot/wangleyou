# 音乐按钮仅保留悬浮放大实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除双主题音乐按钮的播放波纹，只保留 hover/focus 时图标组合约 10% 的轻微放大。

**Architecture:** 在两个主题组件中增加只包裹音符与暂停斜杠的 `glyph`，CSS 仅变换该层，确保 32px 表面和 44px 命中区不变。删除播放状态伪元素与关键帧，播放状态继续只决定普通音符或斜杠音符。

**Tech Stack:** React、TypeScript、CSS Modules、Playwright、Vite。

## Global Constraints

- 删除全部播放波纹和循环动画。
- hover 与 focus-visible 时仅图标组合缩放至 1.1，160ms；减少动态时遵循全局不超过 1ms 的过渡。
- 右上位置、32px 圆形、44px 命中区、ARIA 和播放逻辑不变。
- 两套主题独立实现，不新增依赖。

---

### Task 1: 更新失败验收

**Files:**
- Modify: `tests/browsing.spec.ts`

**Interfaces:**
- Consumes: `data-music-surface`。
- Produces: `data-music-glyph` 的缩放与过渡验收。

- [ ] 把播放态“动画名不是 none”改为 surface `::before`/`::after` 的 `content` 均为 `none`、`animationName` 均为 `none`。
- [ ] 断言 glyph 默认 transform 为 `none`，hover 后 transform 矩阵约等于 scale(1.1)，移开后恢复；键盘 focus-visible 同样放大。
- [ ] 在减少动态用例中断言 glyph transitionDuration 不超过 `0.001s`。
- [ ] 运行定向 Playwright，预期因缺少 `data-music-glyph` 和现有波纹而失败。

### Task 2: 删除波纹并实现图标放大

**Files:**
- Modify: `src/themes/beach/BeachMusicToggle.tsx`
- Modify: `src/themes/beach/BeachMusicToggle.module.css`
- Modify: `src/themes/grassland/GrasslandMusicToggle.tsx`
- Modify: `src/themes/grassland/GrasslandMusicToggle.module.css`

**Interfaces:**
- Produces: `<span className={styles.glyph} data-music-glyph>` 包裹音符与暂停斜杠。

- [ ] 两套组件在 surface 内新增 glyph 包装，保持装饰节点 `aria-hidden`。
- [ ] 删除 `.dock[data-playing='true'] .surface::after`、`@keyframes musicPulse` 及对应 reduced-motion 动画规则。
- [ ] 新增 `.glyph` 的居中布局、`transform:scale(1)` 和 `transition:transform 160ms ease`；hover/focus-visible 时 `scale(1.1)`。
- [ ] reduced-motion 下将 `.glyph` 的 `transition-duration` 设为 `0ms`。
- [ ] 运行定向 Playwright，预期桌面和移动端通过。

### Task 3: 同步基线、完整验证和归档

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `src/themes/module.md`
- Modify: `docs/changes/music-toggle-hover-only/change.json`
- Create: `docs/changes/music-toggle-hover-only/tasks.md`
- Modify: `docs/archive/README.md`
- Move: `docs/changes/music-toggle-hover-only/` → `docs/archive/2026-09-20-music-toggle-hover-only/`

**Interfaces:** 无运行时接口变化。

- [ ] 删除三份基线中的播放波纹要求，写入普通/斜杠状态图标及 hover/focus 约 10% 放大。
- [ ] 运行 `npm run check`、`npm run build`、`npm run test:e2e` 并记录实际证据。
- [ ] 运行 SDD 工作区覆盖检查，通过后归档并更新归档索引。
- [ ] 运行 `git diff --check` 和归档后的最终 SDD 覆盖检查。

## Rollback

只撤销 glyph 包装、hover/focus 缩放、对应测试及本次基线文案；不改变右上定位、暂停斜杠、主题按钮或背景音乐状态逻辑。
