# 长期 UI/交互设计系统实施计划

> **执行要求：** 使用 subagent-driven-development 或 executing-plans 按任务执行；每个任务完成后独立复核。所有任务继承本计划的全局约束。

**目标：** 将 UI/交互设计治理纳入 SDD，并把现有双主题 Penpot 文件升级为适合长期扩展的原生设计系统。

**架构：** 仓库以 `change.json` 的 `designImpact` 描述设计影响，校验脚本保证声明完整；产品、架构和模块文档分别维护行为、边界与实现契约。Penpot 使用 Primitive → Semantic → Component 三层变量、共享组件实例和主题模式，业务页面不复制主题组件逻辑。

**技术与工具：** Markdown、JSON、TypeScript、Vitest、现有 SDD CLI、Penpot Cloud、浏览器交互验证。

## 全局约束

- 不修改 `src/` 内的前端运行时代码或产品行为。
- 不引入依赖、业务后端、数据库、登录、CMS、付费服务或原生桥接。
- 不提交、推送或公开发布。
- 不使用真实家庭媒体或未经许可的商业素材。
- 主题共享信息架构、组件语义、操作位置和无障碍标准。
- playback 唯一拥有队列、当前媒体、播放意图和调度；viewer 不复制业务状态。
- 所有验证如实记录；未完成的 Penpot 原生能力不得以规范画板代替并宣称通过。

## 文件结构与职责

- 修改 `AGENTS.md`：增加设计影响判断、Penpot 更新门槛和完成条件。
- 修改 `docs/sdd.md`：定义 `designImpact` 字段、流程和审查清单。
- 修改 `docs/changes/README.md`：把设计影响写入活动变更模板要求。
- 修改 `scripts/sdd/check.ts`：校验 `designImpact`、`designReason` 以及 `update` 只能使用 full。
- 修改 `scripts/sdd/check.test.ts`：覆盖合法值、缺失字段和非法组合。
- 修改 `docs/requirements.md`：增加长期设计交付和主题扩展要求。
- 修改 `docs/architecture.md`：描述设计系统与运行时架构之间的边界。
- 修改 `src/themes/module.md`：记录设计 Token 到 CSS 变量的契约，但不改变实现状态。
- 修改 `README.md`：增加 Penpot 文件入口、主题设计接入步骤和设计影响说明。
- 新建 `docs/decisions/0002-design-system-governance.md`：记录 Token 分层、主题模式和组件治理决策。
- 修改 `docs/decisions/README.md`：索引新决策。
- 修改 `docs/changes/long-term-design-system/*`：持续同步计划、任务与验证证据。
- 修改 Penpot 文件 `王乐悠家庭影像 - 双主题交互设计`：原生变量、组件、实例、原型和 Changelog。

---

### 任务 1：实施 SDD 设计影响声明

**文件：**

- 修改：`scripts/sdd/check.ts`
- 修改：`scripts/sdd/check.test.ts`
- 修改：`AGENTS.md`
- 修改：`docs/sdd.md`
- 修改：`docs/changes/README.md`

**产出接口：**

```ts
type DesignImpact = 'none' | 'sync' | 'update';
```

所有 `change.json` 必须提供非空 `designImpact` 和 `designReason`。`update` 必须使用 `mode: "full"`；`none`、`sync` 可根据实际行为选择 full 或 light。历史未修改归档不追溯补写，只有进入本次差异的声明才按新规则校验。

- [ ] 在测试 fixture 中加入 `designImpact: 'none'` 和具体 `designReason`。
- [ ] 添加测试：缺少 `designImpact`、非法值或空 `designReason` 均失败。
- [ ] 添加测试：`mode: 'light'` 与 `designImpact: 'update'` 组合失败。
- [ ] 运行 `npm test -- scripts/sdd/check.test.ts`，确认新测试在实现前失败。
- [ ] 在 `validateSnapshot` 中加入上述校验，错误信息分别为“designImpact 必须为 none、sync 或 update”“designReason 必须填写实际内容”“设计更新必须使用 full”。
- [ ] 更新 AGENTS、SDD 指南和活动变更规范，明确三级触发条件、Penpot 责任和证据要求。
- [ ] 运行 `npm test -- scripts/sdd/check.test.ts`，预期全部通过。
- [ ] 运行 `npm run check:sdd -- --worktree --base origin/main`，记录实际结果。

### 任务 2：同步产品、架构和主题契约

**文件：**

- 修改：`docs/requirements.md`
- 修改：`docs/architecture.md`
- 修改：`src/themes/module.md`
- 修改：`README.md`
- 新建：`docs/decisions/0002-design-system-governance.md`
- 修改：`docs/decisions/README.md`

**产出契约：**

- 产品行为由 requirements 定义。
- Penpot 是视觉、交互和组件契约的设计事实来源。
- architecture/module.md 定义设计 Token 与运行时 CSS 变量、业务模块之间的边界。
- README 提供维护者可执行的主题接入和设计同步步骤。

- [ ] 在 requirements 的视觉、主题和交付章节加入设计系统、主题接入和设计同步要求，不把未实现的主题切换写成已实现。
- [ ] 在 architecture 增加 Design System → semantic token contract → themes CSS mapping → component consumption 的边界说明。
- [ ] 在 themes/module.md 明确当前仍只实现默认主题，未来实现需消费语义变量，设计原始色不得成为业务 CSS 契约。
- [ ] 在 README 增加 Penpot 文件入口、`designImpact` 使用方法和新增主题设计步骤。
- [ ] 写入 ADR 0002，比较“复制主题组件”“仅 CSS 变量”“分层 Token + 主题模式”，采纳第三种并说明迁移与取舍。
- [ ] 更新决策索引。
- [ ] 检查所有新增相对链接存在，运行 `git diff --check`。

### 任务 3：重构 Penpot 信息架构与治理页面

**外部设计文件：**

- `王乐悠家庭影像 - 双主题交互设计`

**产出页面：**

`00 Governance`、`01 Foundations`、`02 Primitives`、`03 Semantic Tokens`、`04 Core Components`、`05 Media Components`、`06 Patterns`、`07 Beach Theme`、`08 Grassland Theme`、`09 Responsive Screens`、`10 Interactive Prototype`、`11 States & Accessibility`、`12 Developer Handoff`、`13 Decisions & Changelog`。

- [ ] 将现有内容迁移到 14 个语义页面，保留有效设计，不删除尚未迁移的唯一信息。
- [ ] 在 Governance 写入设计影响分级、贡献流程、设计审查门、版本号和弃用规则。
- [ ] 在 Decisions & Changelog 记录本次重构日期、迁移范围和兼容性原则。
- [ ] 检查所有页面、顶级画板和主要图层无 `Frame 123`、`Group 48` 等无语义名称。
- [ ] 记录迁移前后页面清单和可访问文件链接。

### 任务 4：建立 Penpot 原生变量与主题模式

**原生 Token 集：**

- `primitive/color`
- `primitive/size`
- `semantic/color`
- `semantic/typography`
- `semantic/space`
- `semantic/shape`
- `semantic/elevation`
- `semantic/motion`
- `component/media-viewer`

**主题模式：** `Default`、`Beach`、`Grassland`。

- [ ] 创建原始颜色、尺寸、字体、间距、圆角、边框、阴影、遮罩、图标、内容宽度和动效变量。
- [ ] 创建 `color.background.canvas`、`color.background.surface`、`color.text.primary`、`color.text.secondary`、`color.action.primary`、`color.media.overlay`、`color.focus.ring` 等语义变量。
- [ ] 将 Beach 和 Grassland 模式映射到相同语义变量；组件不引用主题专属 Primitive。
- [ ] 建立媒体查看器遮罩、控制栏、轨道和焦点的 Component Token。
- [ ] 在 03 Semantic Tokens 展示 Token → CSS 自定义属性映射示例。
- [ ] 切换三种模式，逐个检查不存在空值、错误别名或不可读组合。

### 任务 5：建立原生组件、变体和实例

**Core Components：** Logo、顶部导航、移动导航、主题切换器、Button、IconButton、Tag、Breadcrumb、Banner、Dialog、Toast、Skeleton、AlbumCard。

**Media Components：** MediaThumbnail、MediaTypeBadge、DateGroupHeading、MediaViewer、PlaybackControls、Progress、PrevNext、ThumbnailRail、QueueItem。

**Patterns：** ContinuePlayback、ThemeSwitchFeedback、EmptyState、MediaErrorRecovery、ConfigurationError、OfflineRecovery。

- [ ] 为每个组件建立原生主组件，使用 slash 语义命名和明确 Slot。
- [ ] 为适用组件建立 default、hover、focus、pressed、disabled、selected、loading、error 状态。
- [ ] 仅在契约真实变化时建立 size、density、orientation 变体，避免组合爆炸。
- [ ] 为键盘和触控组件标注 Enter/Space、Esc、方向键、44×44 最小目标及焦点恢复规则。
- [ ] 将 Beach、Grassland、Responsive 和 Prototype 页面上的重复控件替换为组件实例。
- [ ] 在组件资产面板确认核心和媒体组件可搜索、可插入，页面实例与主组件保持关联。

### 任务 6：建立可点击原型与响应式验证

**原型入口：** `Flow A / Home`、`Flow B / Home Video`、`Flow C / Theme Context`、`Flow D / Media Error`。

- [ ] 为流程 A 连线首页、浏览、详情、图片查看、下一项和退出。
- [ ] 为流程 B 连线视频打开、播放、暂停、连续下一项、全屏和退出。
- [ ] 为流程 C 在核心页面添加主题切换热区，反馈后返回同一 route/media/index 状态画板。
- [ ] 为流程 D 连线媒体失败、重试成功和返回分支。
- [ ] 建立控制栏显示与隐藏两个查看器状态，并提供鼠标、触控和键盘触发说明。
- [ ] 为 reduced-motion 建立无位移替代跳转说明，主题切换只使用即时或短淡入反馈。
- [ ] 在 1440、390 和移动横屏查看器预览四条流程；记录每个入口、终点和结果。

### 任务 7：开发交付、设计 QA 与归档准备

**文件：**

- 新建：`docs/changes/long-term-design-system/verification.md`
- 修改：`docs/changes/long-term-design-system/change.json`
- 修改：`docs/changes/long-term-design-system/tasks.md`

- [ ] 在 Developer Handoff 完成 React 页面/组件映射、建议属性、playback/viewer 状态关系和 CSS Token 示例。
- [ ] 标注 SVG、WebP、PNG 使用条件；每个装饰资源说明 required/optional/decorative、裁切、平铺、隐藏和安全区域。
- [ ] 逐项检查文本对比度、焦点可见性、非颜色状态、替代文本、字幕说明、安全区和 reduced-motion。
- [ ] 运行 `npm test -- scripts/sdd/check.test.ts`、`npm run check:sdd -- --worktree --base origin/main`、`git diff --check`。
- [ ] 检查 `git diff -- src` 为空，证明没有修改前端代码。
- [ ] 在 verification.md 对 A1–A12 逐项记录证据、环境、视口、Penpot 链接和未验证项。
- [ ] 更新 change.json 的 verification 和 impacts 为实际结果；未通过的必要验收保持未完成，不归档。

## 回退方式

- 文档和校验脚本回退时按文件恢复本变更差异，不修改历史归档。
- Penpot 重构前保留旧页面直至新页面迁移和验证完成；若原生变量或组件迁移失败，恢复旧页面为只读参考，不删除唯一设计信息。
- 不使用破坏性 Git 命令，不覆盖用户已有改动，不删除 Penpot 页面直至对应新页面验收通过。
