# 首页两屏音乐按钮实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页两段整屏各提供一个随屏移动的音乐按钮，并让两个入口共享单一 audio 与 playback 状态，同时保持主题按钮只在第一屏。

**Architecture:** `BeachMusicToggle` 与 `GrasslandMusicToggle` 各自继续拥有唯一 audio 和播放副作用，但把按钮视觉提取为组件内复用的渲染函数，输出 hero/memory 两个同步入口。主题 App 只提供覆盖两屏的绝对定位包装层；音乐组件用两个绝对定位按钮分别落在 `0` 和 `100dvh`，空白容器禁用 pointer events。

**Tech Stack:** React、TypeScript、CSS Modules、Playwright、Vite。

## Global Constraints

- 首页两屏右上角各有一个音乐按钮，按钮随所属屏幕移动，不使用 fixed/sticky。
- 两个入口共享一个 audio DOM、一份播放意图和实际状态。
- 主题按钮只在第一屏右下角，第二屏不显示。
- 两个入口都保持 44×44px 命中区、32×32px 表面、约 18px 安全区和现有 hover/focus/暂停视觉。
- 非首页音乐范围、视频协调、页面可见性和查看器主题入口不变。

---

### Task 1: 添加双入口失败验收

**Files:**
- Modify: `tests/browsing.spec.ts`

**Interfaces:**
- Consumes: 现有 `data-testid="background-music"` 和主题/音乐按钮无障碍名称。
- Produces: `data-music-screen="hero" | "memory"` 的测试契约。

- [ ] 将首页控件用例改为按 `data-music-screen` 定位 hero 与 memory 音乐按钮，断言 audio 只有一个。
- [ ] 首屏断言 hero 音乐与主题可见、memory 音乐不在视口；第二屏断言 memory 音乐可见、hero 音乐与主题不在视口。
- [ ] 在第一屏播放后切到第二屏，断言 memory 入口为播放态；在第二屏暂停后返回第一屏，断言 hero 入口为暂停态且 audio 状态一致。
- [ ] 同时覆盖两个入口非 fixed/sticky、44px 命中区、32px 表面、右上角几何与草原主题。
- [ ] 运行 `npm run build && npx playwright test tests/browsing.spec.ts --grep "two-screen music|theme switch and background music"`，预期 memory 入口不存在而失败。

### Task 2: 实现单音频双按钮

**Files:**
- Modify: `src/themes/beach/BeachMusicToggle.tsx`
- Modify: `src/themes/beach/BeachMusicToggle.module.css`
- Modify: `src/themes/grassland/GrasslandMusicToggle.tsx`
- Modify: `src/themes/grassland/GrasslandMusicToggle.module.css`
- Modify: `src/themes/beach/BeachApp.module.css`
- Modify: `src/themes/grassland/GrasslandApp.module.css`

**Interfaces:**
- Consumes: `BackgroundMusic`、`ThemeMusicCommands`、`shouldPlayBackgroundMusic()` 和 App 的首页 `musicControl` 包装层。
- Produces: 单一 `background-music` audio 及两个共享 `commands.toggle`/`playing` 的 `data-music-screen` 按钮。

- [ ] 在两套音乐组件中保留唯一 audio 和现有 effect，将按钮标记/视觉复用为组件内 `renderButton(screen)`，分别输出 hero 与 memory 入口。
- [ ] 根 dock 覆盖两屏高度并设 `pointer-events:none`；按钮恢复 `pointer-events:auto`，hero 位于顶部，memory 位于 `top:100dvh`。
- [ ] App 的 `musicControl` 包装层继续使用右侧/顶部安全区，但扩展为两屏定位容器；主题包装层不变。
- [ ] 更新组件注释，明确单一音频资源、双入口和随屏定位职责。
- [ ] 运行定向 Playwright，预期桌面和移动端双主题相关用例通过。

### Task 3: 同步基线、完整验证与归档

**Files:**
- Modify: `docs/requirements.md`
- Modify: `docs/architecture.md`
- Modify: `src/themes/module.md`
- Modify: `docs/changes/home-two-screen-music-controls/change.json`
- Modify: `docs/changes/home-two-screen-music-controls/spec.md`
- Modify: `docs/archive/README.md`
- Move: `docs/changes/home-two-screen-music-controls/` → `docs/archive/2026-09-20-home-two-screen-music-controls/`

**Interfaces:**
- Consumes: 本规格的验收条件和实际验证结果。
- Produces: 当前产品基线与可追溯归档记录。

- [ ] 把需求、架构和 themes 模块基线更新为“两屏各一音乐入口、单一 audio、主题仅第一屏”。
- [ ] 运行 `npm run check`、`npm run build`、`npm run test:e2e`，把真实结果写入 change.json 与规格验证记录。
- [ ] 运行 `npm run check:sdd -- --worktree --base origin/main`，通过后归档并更新索引。
- [ ] 运行 `git diff --check` 和归档后 SDD 复核；不提交、不推送、不发布。

## Rollback

仅撤销音乐组件的第二屏入口、两屏定位 CSS、对应测试和本次基线同步；保留上一变更已实现的页面内容层定位、第一屏主题按钮以及音乐状态视觉。
