# 紧凑主题切换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将两个主题的右下角开关改为默认 40px 视觉圆形、hover/focus 展开至约 128px 的循环箭头胶囊，并删除首页演示统计文案。

**Architecture:** 海边与草原继续分别维护自己的 `ThemeSwitch` 组件和 CSS，不引入共享 UI。首页文案也在两套主题各自的 `ThemePages.tsx` 中删除；公共主题状态、路由和查看器契约保持不变。

**Tech Stack:** React 19、TypeScript、CSS Modules、`react-liquid-glass-svg`、Playwright、Vite、项目 SDD 校验器。

## Global Constraints

- 40px 只表示玻璃表面的视觉直径，实际命中区域必须至少 44×44px。
- 桌面 hover 与键盘 focus 时展开至约 128px 并显示“主题切换”。
- 海边与草原不得互相导入 UI、CSS 或资产。
- 删除演示统计文案后不得留下空白占位。
- 保持主题持久化、当前路由、查看器上下文、减少动态和焦点可见行为。

---

### Task 1: 建立变更记录和失败验收

**Files:**
- Create: `docs/changes/compact-theme-switch/change.json`
- Create: `docs/changes/compact-theme-switch/spec.md`
- Create: `docs/changes/compact-theme-switch/plan.md`
- Create: `docs/changes/compact-theme-switch/tasks.md`
- Modify: `tests/browsing.spec.ts`

**Interfaces:**
- Consumes: 既有 `data-testid="theme-switch"`、可访问名称 `/切换主题/` 与首页路由。
- Produces: 对默认视觉尺寸、展开尺寸、循环图标、统计文案缺失和主题切换的自动验收。

- [ ] **Step 1: 建立 full SDD 记录**

记录本次为用户可见的组件语义和首页文案变化，验收条件逐项对应已确认设计；架构决策标记为 `none`，因为主题隔离与依赖方向不变。

- [ ] **Step 2: 把现有主题开关测试收紧为新规格**

在 `floating glass theme switch replaces the global header` 用例中增加以下断言逻辑：

```ts
const surface = dock.getByRole('button', {name: /切换主题/});
const hitBox = await dock.boundingBox();
const collapsedBox = await surface.boundingBox();
expect(hitBox?.width).toBeGreaterThanOrEqual(44);
expect(hitBox?.height).toBeGreaterThanOrEqual(44);
expect(collapsedBox?.width).toBeCloseTo(40, 0);
await expect(dock.locator('[data-theme-switch-icon="cycle"]')).toBeVisible();
await expect(page.getByText(/个片刻.*本相册.*内容均为演示/)).toHaveCount(0);
```

桌面 hover 和所有项目 focus 后轮询按钮宽度达到 120–136px，并继续验证标签透明度为 1、点击切换主题。

- [ ] **Step 3: 运行目标测试并确认失败**

Run: `npx playwright test tests/browsing.spec.ts -g "floating glass theme switch"`

Expected: FAIL；旧表面宽度约 48px、没有 `data-theme-switch-icon="cycle"`，且统计文案仍存在。

---

### Task 2: 实现双主题紧凑循环开关

**Files:**
- Modify: `src/themes/beach/BeachThemeSwitch.tsx`
- Modify: `src/themes/beach/BeachThemeSwitch.module.css`
- Modify: `src/themes/grassland/GrasslandThemeSwitch.tsx`
- Modify: `src/themes/grassland/GrasslandThemeSwitch.module.css`

**Interfaces:**
- Consumes: `onSwitch: () => void`、`LiquidGlass` 多态按钮 API。
- Produces: 保持原可访问名称和点击回调的独立主题开关。

- [ ] **Step 1: 分别替换两主题图标**

两份组件各自使用同样语义但独立维护的 SVG 双箭头，并暴露测试标记：

```tsx
<span className={styles.icon} data-theme-switch-icon="cycle" aria-hidden="true">
  <svg viewBox="0 0 24 24" focusable="false">
    <path d="M20 7.5A8 8 0 0 0 6.4 4.7L4 7" />
    <path d="M4 3.5V7h3.5" />
    <path d="M4 16.5a8 8 0 0 0 13.6 2.8L20 17" />
    <path d="M20 20.5V17h-3.5" />
  </svg>
</span>
```

- [ ] **Step 2: 分别收紧视觉表面并保留命中区域**

两份 CSS 均令 `.dock` 成为至少 `44px` 的透明命中区域；`.button` 默认固定 `40px` 宽高并居中。hover/focus 时按钮宽度变为 `128px`、圆角保持胶囊形；标签用 `opacity` 和 `max-width` 平滑出现。颜色、阴影与玻璃 tint 仍由主题各自定义。

- [ ] **Step 3: 保持无障碍与减少动态**

保留 `aria-label="切换主题，当前是…主题"`、3px 焦点环和 `prefers-reduced-motion` 无过渡规则；确认外层透明区域不会阻挡按钮之外的内容点击。

- [ ] **Step 4: 运行目标测试**

Run: `npx playwright test tests/browsing.spec.ts -g "floating glass theme switch"`

Expected: 2 passed（desktop-chrome、mobile-chrome）。

---

### Task 3: 删除首页演示统计文案

**Files:**
- Modify: `src/themes/beach/ThemePages.tsx`
- Modify: `src/themes/grassland/ThemePages.tsx`
- Modify: `src/themes/beach/ThemePages.module.css`
- Modify: `src/themes/grassland/ThemePages.module.css`

**Interfaces:**
- Consumes: 两主题 `HomePage` 的现有内容配置。
- Produces: 不再呈现统计演示说明的首屏卡片。

- [ ] **Step 1: 删除两份统计 JSX**

分别删除：

```tsx
<p className={styles.heroMeta}>{totalMedia} 个片刻 · {data.albums.length} 本相册 · 内容均为演示</p>
```

若 `totalMedia` 只服务于该行，同时删除其局部计算，保持 TypeScript 无未使用变量。

- [ ] **Step 2: 删除两主题不再使用的 `.heroMeta` 样式**

只删除该选择器，不调整 Hero 其他间距；卡片布局应由现有 `gap` 自然收拢，不添加占位元素。

- [ ] **Step 3: 运行类型与目标浏览器测试**

Run: `npm run typecheck && npx playwright test tests/browsing.spec.ts -g "floating glass theme switch|responsive layout"`

Expected: TypeScript 通过，目标浏览器测试全部通过。

---

### Task 4: 同步基线、全量验证和归档

**Files:**
- Modify: `docs/requirements.md`
- Modify: `src/themes/module.md`
- Modify: `docs/changes/compact-theme-switch/change.json`
- Modify: `docs/changes/compact-theme-switch/tasks.md`
- Create: `docs/changes/compact-theme-switch/verification.md`
- Move: `docs/changes/compact-theme-switch/` → `docs/archive/2026-09-19-compact-theme-switch/`
- Modify: `docs/archive/README.md`
- Modify: `docs/changes/README.md`

**Interfaces:**
- Consumes: Tasks 1–3 的实现与测试证据。
- Produces: 与实际代码一致的需求基线、验证记录和归档索引。

- [ ] **Step 1: 同步需求与模块文档**

将主题开关要求明确为 40px 视觉圆形、至少 44px 命中区、hover/focus 约 128px 胶囊；移除任何仍要求首页展示演示统计的描述。

- [ ] **Step 2: 运行完整静态与单元检查**

Run: `npm run check`

Expected: SDD 结构、内容校验、TypeScript、ESLint 和 Vitest 全部通过。

- [ ] **Step 3: 运行生产构建和完整浏览器回归**

Run: `npm run build && npm run test:e2e`

Expected: 构建成功；Playwright 无失败，设备能力条件跳过如实记录。

- [ ] **Step 4: 人工核对截图**

查看 `test-results/desktop-chrome-home.png`，确认统计行消失、默认开关明显小于旧版、右下位置合理且不遮挡内容；若视觉不符合规格，先修正再继续。

- [ ] **Step 5: 填写证据并归档**

将实际命令、通过数量、条件跳过和未做真机验证写入 `verification.md`，完成任务勾选并移动完整变更目录。

- [ ] **Step 6: 运行最终 SDD 工作区校验**

Run: `npm run check:sdd -- --worktree --base origin/main && git diff --check`

Expected: SDD 检查通过且无空白错误。
