# 恢复主题切换按钮实施计划

> **执行要求：** 使用 `executing-plans` 在当前会话逐项实施并核对，不覆盖工作区中背景音乐和首页主回忆的未提交改动。

**目标：** 在保留背景音乐控制的同时，恢复海边与草原主题右下角的既有毛玻璃主题切换按钮。

**架构：** 复用当前基线中两个主题各自独立的 `ThemeSwitch` React 组件和 CSS Module，在各主题应用根节点同时装配音乐控制与主题控制。`App` 继续持有唯一主题状态，按钮只调用现有 `onSwitchTheme(): void` 契约。

**技术栈：** React、TypeScript、CSS Modules、`react-liquid-glass-svg`、`lucide-react`、Playwright、npm。

## 全局约束

- 不删除或改写当前工作区的背景音乐功能和首页主回忆改动。
- 海边与草原主题的 JSX、CSS 和视觉参数保持独立，不跨主题导入 UI。
- 恢复既有尺寸：20px 图标、32px 玻璃圆形、至少 44×44px 命中区、hover/focus 时约 112px 胶囊。
- 不新增依赖，不改变主题持久化、路由、播放状态或查看器契约。

---

### 任务 1：先恢复主题按钮的浏览器验收

**文件：**
- 修改：`tests/browsing.spec.ts`

**接口：**
- 使用：按钮可访问名称 `/切换主题/`、`data-testid="theme-switch"`、`data-theme-switch-surface`、`data-theme-switch-icon="cycle"`。
- 验证：主题按钮与 `data-testid="music-toggle"` 同时存在，点击后 `document.documentElement.dataset.theme` 改变且刷新保留。

- [ ] 删除“主题按钮数量为 0”和通过 `localStorage` 代替用户切换的断言。
- [ ] 在主题装饰用例中通过按钮从海边切至草原、再切回海边并刷新验证持久化。
- [ ] 新增共存与几何断言：音乐按钮位于底部中央；主题按钮位于右下角，收起 32px、命中区至少 44px；桌面 hover 和键盘 focus 展开至 104–122px，并显示“主题切换”。
- [ ] 运行 `npx playwright test tests/browsing.spec.ts -g "theme decoration|theme switch.*music" --project=desktop-chrome`；预期在实现恢复前因找不到主题按钮而失败。

### 任务 2：恢复两套主题的独立按钮实现

**文件：**
- 恢复：`src/themes/beach/BeachThemeSwitch.tsx`
- 恢复：`src/themes/beach/BeachThemeSwitch.module.css`
- 恢复：`src/themes/grassland/GrasslandThemeSwitch.tsx`
- 恢复：`src/themes/grassland/GrasslandThemeSwitch.module.css`
- 修改：`src/themes/beach/BeachApp.tsx`
- 修改：`src/themes/grassland/GrasslandApp.tsx`

**接口：**
- 使用：`onSwitchTheme(): void`。
- 产生：两个主题各自的 `ThemeSwitch({ onSwitch })` 组件；测试标识和可访问名称保持既有值。

- [ ] 从当前 Git 基线逐字恢复四个被删除的主题按钮文件，保留各主题已有色调、阴影、折射参数、焦点样式和减少动态降级。
- [ ] 在 `BeachApp` 导入并渲染 `<BeachThemeSwitch onSwitch={props.onSwitchTheme} />`，同时保留 `<BeachMusicToggle ... />`。
- [ ] 在 `GrasslandApp` 导入并渲染 `<GrasslandThemeSwitch onSwitch={props.onSwitchTheme} />`，同时保留 `<GrasslandMusicToggle ... />`。
- [ ] 运行任务 1 的定向 Playwright 命令；预期通过。

### 任务 3：完整验证并同步变更证据

**文件：**
- 修改：`docs/changes/restore-theme-switch/change.json`

**接口：** 无新增运行时接口。

- [ ] 运行 `npm run check`；预期 SDD、内容校验、TypeScript、ESLint 和 Vitest 全部通过。
- [ ] 运行 `npm run build`；预期 Vite 生产构建成功。
- [ ] 运行 `npm run test:e2e`；预期浏览器验收通过，设备能力相关跳过项如实记录。
- [ ] 运行 `npm run check:sdd -- --worktree --base origin/main`；预期变更记录覆盖本次恢复文件。
- [ ] 将实际命令、通过数量、跳过或失败原因写入 `change.json.verification`；没有证据的项目不得写成已通过。

## 回退

若恢复导致回归，只撤销本变更新增的四个主题按钮文件、两处主题应用装配和对应测试断言；不触碰背景音乐、主回忆和其他用户改动。
