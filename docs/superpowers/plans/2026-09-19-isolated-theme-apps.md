# 全站隔离主题应用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将海边和草原重构为互不依赖的完整站点 UI，同时复用无 UI 的路由、内容、播放与交互契约。

**Architecture:** `App` 保留唯一的路由、会话、主题偏好和业务命令所有权，并把稳定的 `ThemeAppProps` 传给主题入口。`src/themes/beach/` 与 `src/themes/grassland/` 各自渲染导航、首页、相册与查看器；它们不得互相导入，也不得消费共享 React UI。`albums/home-memory.ts` 等纯函数继续作为主题可用的交互契约。

**Tech Stack:** React 19、TypeScript、Vite、CSS Modules、Vitest、Playwright、`react-liquid-glass-svg`。

## Global Constraints

- 主题 UI 只能导入无 JSX 的 content、playback、router、home-memory 与 themes 公共类型/偏好 API。
- 主题 UI 之间禁止导入；共享目录不得新增 React 组件。
- 所有主题保持相同路由、查看器命令、无障碍语义与首页两屏交互契约。
- 新增视觉依赖须记录包体积、依赖、许可、浏览器降级与无障碍影响；本次固定使用 `react-liquid-glass-svg`。
- 保留静态站点、Node 24、npm 锁文件和现有公开内容模型。

---

### Task 1: 将主题隔离与依赖选型纳入 SDD 基线

**Files:**
- Modify: `AGENTS.md`, `docs/requirements.md`, `docs/architecture.md`, `docs/sdd.md`
- Modify: `src/themes/module.md`, `src/app/module.md`, `src/albums/module.md`, `docs/changes/home-two-screen-memory/{change.json,spec.md,plan.md,tasks.md,verification.md}`
- Create: `docs/changes/isolated-theme-apps/{change.json,spec.md,plan.md,tasks.md,verification.md}`

**Interfaces:**
- Produces: “主题 UI 完全隔离、仅共享无 UI 契约、第三方视觉库优先”的可审查基线。

- [ ] **Step 1: 写入完整变更声明与验收项**

在 `change.json` 声明 `mode: "full"`、`behavior: true`、`architecture: true`，规格逐项覆盖全站主题 UI、依赖选型、两屏行为和跨主题隔离。

- [ ] **Step 2: 修改基线文档**

将“统一变量、共享业务组件树”替换为：主题可以共享纯领域逻辑和类型，但不能共享 JSX、CSS 或主题资产；为每种新增视觉效果记录包体积、依赖、许可、回退与选择理由。

- [ ] **Step 3: 校验文档声明**

Run: `npm run check:sdd -- --worktree --base origin/main`

Expected: 变更声明、链接和模块文档检查通过。

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs src/*/module.md
git commit -m "docs(sdd): 约束全站主题隔离"
```

### Task 2: 建立无 UI 的主题装配契约和隔离检查

**Files:**
- Create: `src/themes/contracts.ts`, `src/themes/contracts.test.ts`
- Modify: `src/themes/index.ts`, `src/themes/theme.test.ts`, `scripts/sdd/check.ts`, `scripts/sdd/check.test.ts`

**Interfaces:**
- Produces: `ThemeAppProps`（路由、内容、查看器会话、业务命令、主题切换回调）及 `ThemeApp` 类型；无 JSX。
- Consumes: `SiteContent`, `Route`, `Session`, `ViewerCommands`, `ThemeName`。

- [ ] **Step 1: 写失败测试**

验证 `ThemeAppProps` 不携带样式/颜色字段；SDD 检查对 `src/themes/<theme>/` 中导入另一个主题、`shared` JSX 文件或其他主题 CSS 的情况报告错误。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/themes/contracts.test.ts scripts/sdd/check.test.ts`

Expected: FAIL，缺少契约或隔离规则。

- [ ] **Step 3: 实现类型和静态导入规则**

```ts
export type ThemeAppProps = {
  route: Route; content: SiteContent; session: Session | null;
  commands: ViewerCommands; onOpen(album: Album, id: string): void;
  onSwitchTheme(): void; theme: ThemeName; online: boolean;
};
export type ThemeApp = (props: ThemeAppProps) => ReactElement;
```

在 SDD AST 检查中拒绝主题目录的跨主题相对导入和 JSX/UI 共享模块导入。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/themes/contracts.test.ts scripts/sdd/check.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/themes scripts/sdd
git commit -m "feat(themes): 建立主题隔离契约"
```

### Task 3: 安装并验证液态玻璃依赖

**Files:**
- Modify: `package.json`, `package-lock.json`, `docs/changes/isolated-theme-apps/{spec.md,verification.md}`
- Create: `src/themes/beach/BeachGlass.test.tsx`

**Interfaces:**
- Produces: 海边主题内部专用 `BeachGlass` UI；只由 `themes/beach` 使用。

- [ ] **Step 1: 安装锁定依赖**

Run: `npm install react-liquid-glass-svg`

Expected: `package.json` 与 `package-lock.json` 只新增该生产依赖。

- [ ] **Step 2: 写失败测试**

断言海边玻璃卡输出库提供的 `LiquidGlass` 容器，且标题与操作仍可通过角色/名称定位。

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- src/themes/beach/BeachGlass.test.tsx`

Expected: FAIL，组件尚不存在。

- [ ] **Step 4: 实现主题内部包装**

```tsx
export function BeachGlass({ children }: { children: ReactNode }) {
  return <LiquidGlass glassBorder backdropBlur={8} tintColor="rgba(255,255,255,.20)">{children}</LiquidGlass>;
}
```

仅在海边目录写卡片布局和降级 CSS；记录 MIT、零运行时依赖、约 2KB gzip、Safari/iOS 的可读玻璃回退。

- [ ] **Step 5: 运行测试确认通过并提交**

Run: `npm test -- src/themes/beach/BeachGlass.test.tsx`

```bash
git add package.json package-lock.json src/themes/beach docs/changes/isolated-theme-apps
git commit -m "feat(beach): 接入液态玻璃组件"
```

### Task 4: 实现海边完整主题应用

**Files:**
- Create: `src/themes/beach/{BeachApp.tsx,BeachApp.module.css,BeachHome.tsx,BeachHome.module.css,BeachAlbums.tsx,BeachAlbums.module.css,BeachViewer.tsx,BeachViewer.module.css,BeachMedia.tsx}`
- Create: `src/themes/beach/{BeachApp.test.tsx,BeachHome.test.tsx}`
- Modify: `src/albums/home-memory.ts`, `src/albums/home-memory.test.ts`

**Interfaces:**
- Consumes: `ThemeAppProps`, `createHomeMemory`, `getHomeWheelIntent`, `getHomeKeyIntent`, `getHomeTouchIntent`, `assetUrl` 和内容/播放公开类型。
- Produces: `BeachApp: ThemeApp`，覆盖所有当前路由与查看器。

- [ ] **Step 1: 写失败测试**

覆盖海边首页的两段 section、主回忆控制、导航活动状态、相册条目、打开/关闭查看器和切换主题按钮。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/themes/beach/BeachApp.test.tsx src/themes/beach/BeachHome.test.tsx`

Expected: FAIL，海边主题入口不存在。

- [ ] **Step 3: 将现有 UI 迁移为主题局部实现**

海边主题内复写 JSX 与 CSS，不从 `albums`、`media-viewer`、`shared` 导入 React 组件。只复用 `home-memory.ts` 纯状态和 `playback` 会话命令；确保查看器打开时主回忆 interval 停止并在卸载时清理。

- [ ] **Step 4: 运行主题与纯逻辑测试**

Run: `npm test -- src/themes/beach src/albums/home-memory.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/themes/beach src/albums/home-memory.*
git commit -m "feat(beach): 实现独立站点界面"
```

### Task 5: 实现草原完整主题应用

**Files:**
- Create: `src/themes/grassland/{GrasslandApp.tsx,GrasslandApp.module.css,GrasslandHome.tsx,GrasslandHome.module.css,GrasslandAlbums.tsx,GrasslandAlbums.module.css,GrasslandViewer.tsx,GrasslandViewer.module.css,GrasslandMedia.tsx}`
- Create: `src/themes/grassland/{GrasslandApp.test.tsx,GrasslandHome.test.tsx}`
- Modify: `public/media/SOURCES.md`

**Interfaces:**
- Consumes: 与 Task 4 相同的无 UI 公共契约。
- Produces: `GrasslandApp: ThemeApp`，不导入任何海边文件。

- [ ] **Step 1: 写失败测试**

复用海边行为测试的断言语义，验证草原独有标题、背景和控件可访问名称，但不复用任何 React 测试组件。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/themes/grassland/GrasslandApp.test.tsx src/themes/grassland/GrasslandHome.test.tsx`

Expected: FAIL，草原主题入口不存在。

- [ ] **Step 3: 实现草原的独立 UI**

以暖绿、地平线、自然纸感为视觉语言，在草原目录独立写导航、首页、相册、查看器、图片加载状态和 CSS；不可复制或导入海边 JSX/CSS。使用同一纯交互 API 保持行为一致。

- [ ] **Step 4: 运行测试确认通过并提交**

Run: `npm test -- src/themes/grassland`

```bash
git add src/themes/grassland public/media/SOURCES.md
git commit -m "feat(grassland): 实现独立站点界面"
```

### Task 6: 简化 App 装配并删除旧共享 UI

**Files:**
- Modify: `src/app/App.tsx`, `src/app/App.module.css`, `src/themes/index.ts`, `src/themes/module.md`, `src/app/module.md`
- Delete: `src/albums/{AlbumPages.tsx,AlbumPages.module.css,AlbumPages.test.tsx,index.ts}`, `src/media-viewer/{MediaViewer.tsx,MediaViewer.module.css,index.ts}`, `src/shared/{PhotoImage.tsx,PhotoImage.module.css,index.ts}`, `src/app/{ThemeDecor.tsx,ThemeDecor.module.css}`
- Modify: affected test imports and module documentation

**Interfaces:**
- Consumes: `BeachApp`, `GrasslandApp`, `ThemeAppProps`。
- Produces: theme-to-app registry, e.g. `const THEME_APPS: Record<ThemeName, ThemeApp>`。

- [ ] **Step 1: 写失败 App 测试**

断言切换主题保留 hash 路由与现有 session；主题应用接收同一命令对象；失效主题回退海边。

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/app/router.test.ts src/themes/theme.test.ts`

Expected: FAIL，装配仍引用旧共享 UI。

- [ ] **Step 3: 替换装配并删除迁移完成的共享 UI**

```tsx
const ThemePage = THEME_APPS[theme];
return <ThemePage route={route} content={content} session={session} commands={commands}
  onOpen={open} onSwitchTheme={switchTheme} theme={theme} online={online} />;
```

先确认两个主题覆盖旧 UI 的全部路由和会话行为，再删除旧文件；同步模块公开入口和依赖白名单。

- [ ] **Step 4: 运行完整静态检查**

Run: `npm run check`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/app src/themes src/albums src/media-viewer src/shared scripts/sdd
git commit -m "refactor(app): 按主题装配独立界面"
```

### Task 7: 浏览器验证、基线同步与归档准备

**Files:**
- Modify: `tests/browsing.spec.ts`, `docs/changes/isolated-theme-apps/{tasks.md,verification.md,change.json}`
- Modify: `docs/requirements.md`, `docs/architecture.md`, `README.md`, relevant `module.md`

**Interfaces:**
- Produces: 海边/草原桌面与移动端可追溯验证记录。

- [ ] **Step 1: 写 Playwright 流程**

每种主题覆盖：首页加载、箭头/滚轮进入主回忆、暂停/前后切换、打开/关闭查看器、切换主题后保持当前路由；断言首屏和主回忆均为完整视口段，页面无横向溢出。

- [ ] **Step 2: 运行浏览器验证**

Run: `npx playwright test tests/browsing.spec.ts`

Expected: desktop 与 mobile 主题流程通过；已有环境条件跳过项目如实记录。

- [ ] **Step 3: 运行交付检查**

Run: `npm run check && npm run build && npm run test:e2e`

Expected: 全部通过。

- [ ] **Step 4: 填写实际结果并提交**

只记录实际执行的浏览器、视口、通过/跳过/失败结果；完成所有验收项后按 `docs/archive/README.md` 归档活动变更。

```bash
git add docs tests README.md
git commit -m "test(themes): 验证隔离主题应用"
```
