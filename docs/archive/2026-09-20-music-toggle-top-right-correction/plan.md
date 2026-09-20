# 音乐按钮右上角位置纠正实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将两套主题的音乐按钮准确移动到用户标注的屏幕右上角，并与右下角主题按钮的收起尺寸和右侧中心线对齐。

**Architecture:** 仅修改双主题音乐按钮的 CSS 定位与表面尺寸，不改变 React 状态和 playback 契约。Playwright 使用桌面 1440×900 和移动 360×800 的实际视口，分别验证右上定位、32px 可见圆形、44px 命中区与主题按钮中心线。

**Tech Stack:** React、TypeScript、CSS Modules、Playwright、Vite。

## Global Constraints

- 音乐按钮固定在右上角，主题按钮保持右下角。
- 两者命中区均为 44×44px、水平中心误差不超过 2px；音乐可见圆形与主题收起表面均为 32×32px。
- 顶部与右侧使用 `max(1.125rem, env(safe-area-inset-*)))`。
- 保留斜杠暂停态、播放波纹、ARIA、音频逻辑、减少动态和双主题隔离。

---

### Task 1: 用浏览器验收锁定右上角设计

**Files:**
- Modify: `tests/browsing.spec.ts`

**Interfaces:**
- Consumes: `data-testid="music-toggle"`、`data-testid="theme-switch"`、`data-music-surface`。
- Produces: 桌面/移动端双主题的右上位置与尺寸验收。

- [ ] 将原垂直间距断言替换为顶部/右侧偏移断言：音乐命中区 `x = viewport.width - 18 - 44`、`y = 18`，允许 2px 误差。
- [ ] 断言音乐和主题按钮水平中心误差不超过 2px，音乐可见表面与主题收起表面均约 32px。
- [ ] 将截图裁切区域改为视口右上 150×135px，并对切换后的草原主题重复几何断言。
- [ ] 运行 `npm run build && npx playwright test tests/browsing.spec.ts -g "theme switch and background music"`，预期现有右下相邻布局失败。

### Task 2: 分别纠正双主题音乐按钮样式

**Files:**
- Modify: `src/themes/beach/BeachMusicToggle.tsx`
- Modify: `src/themes/beach/BeachMusicToggle.module.css`
- Modify: `src/themes/grassland/GrasslandMusicToggle.tsx`
- Modify: `src/themes/grassland/GrasslandMusicToggle.module.css`

**Interfaces:**
- Produces: `<span className={styles.surface} data-music-surface>` 包裹现有音符和暂停斜杠。

- [ ] 将两套主题 `.dock` 改为 `top:max(1.125rem,env(safe-area-inset-top)); right:max(1.125rem,env(safe-area-inset-right)); width:44px; height:44px`，删除 bottom 定位。
- [ ] 保持 `.button` 为 44×44px 透明命中区，新增 `.surface` 为 32×32px 毛玻璃圆形；把背景、颜色、模糊、hover 和暂停弱化移到 `.surface`。
- [ ] 将波纹伪元素定位到 32px `.surface`，暂停斜杠保留在表面内部，确保视觉大小与主题按钮一致。
- [ ] 运行定向 Playwright，预期桌面与移动端均通过，并用截图确认按钮位于用户标注的右上区域。

### Task 3: 同步基线、完整验证并归档

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `src/themes/module.md`
- Modify: `docs/changes/music-toggle-top-right-correction/change.json`
- Create: `docs/changes/music-toggle-top-right-correction/tasks.md`
- Modify: `docs/archive/README.md`
- Move: `docs/changes/music-toggle-top-right-correction/` → `docs/archive/2026-09-20-music-toggle-top-right-correction/`

**Interfaces:** 无运行时接口变化。

- [ ] 把三份基线中的“主题按钮正上方/纵向排列/12px”纠正为“屏幕右上角、同右侧中心线、32px 可见圆形与 44px 命中区”。
- [ ] 运行 `npm run check`、`npm run build`、`npm run test:e2e`，将实际结果写入 `change.json.verification` 和 `tasks.md`。
- [ ] 运行 `npm run check:sdd -- --worktree --base origin/main`；通过后归档整个变更目录并更新归档索引。
- [ ] 归档后运行 `git diff --check` 和最终 SDD 覆盖检查。

## Rollback

仅撤销本次音乐按钮的 top/right 定位、32px 表面包装、对应浏览器断言及三份基线纠正；不撤销主题按钮恢复、音乐播放状态、暂停斜杠或波纹实现。
