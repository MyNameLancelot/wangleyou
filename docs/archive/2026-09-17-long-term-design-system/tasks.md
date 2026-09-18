# 长期 UI/交互设计系统任务

## 当前状态

规格已确认并全部实施完成。仓库治理、Penpot 原生化、组件状态、Token 与移动端原型均已验证，可归档。

- [x] 任务 1：实施 SDD `designImpact` 声明、自动校验和文档规则。
- [x] 任务 2：同步 requirements、architecture、themes/module、README 和 ADR。
- [x] 任务 3：将 Penpot 重构为 14 个长期维护页面并建立治理记录。
- [x] 任务 4：建立三层原生 Token 和 Default/Beach/Grassland 模式（12 个集合、约 134 个 Token；三主题映射已解析抽查）。
- [x] 任务 5：建立 Core、Media、Pattern 原生组件、变体和页面实例（29 个原生组件条目、717 个实例、28 个组件根；Button/Primary 与 Icon Button 8 态变体逐态核对并绑定 `component/button` Token，主题切换实测换色；焦点环改为 2px 表面色内圈 + 3px 焦点环外圈）。
- [x] 任务 6：连通流程 A–D，验证 1440、390 和移动横屏（桌面：18 个画板、60 原始热点、40 语义控制层并实点击通过；移动：6 张矢量画板、20 个 ≥44×44 热区，预览中实点击通过浏览、返回、查看器开关、队列切换与主题保持；横屏以规则板说明）。
- [x] 任务 7：完善开发交付、执行设计 QA、记录 A1–A12 验证证据（Token 契约页、组件状态矩阵、Changelog 与 A1–A12 验证记录均已补齐）。

## 阻塞与下一步

已无阻塞事项。浏览器 provider 的 `Unable to load browser request-header policy` 在收尾阶段出现，改为 Chrome 原生窗口控制完成移动端预览点击验证，结果已记入 verification.md。

2026-09-17 的 Penpot 自动写入会话曾持续返回插件心跳超时；重新选择 MCP 菜单中的“在此连接”后已恢复。六张移动 PNG 已写入 `09 Responsive Screens`。当前阻塞已解除；剩余工作是预览模式中的逐画板视觉、播放控制、触控和横屏验收。

## 已有证据

- 2026-09-16：用户确认采用面向长期扩展的完整设计系统方案。
- 2026-09-16：`npm run check:sdd -- --structure` 通过。
- 2026-09-16：SDD 新测试按 TDD 先出现 4 项预期失败，完成校验后 `scripts/sdd/check.test.ts` 14 项通过。
- 2026-09-16：`scripts/sdd/check.test.ts` 与 `scripts/sdd/git.test.ts` 共 18 项通过。
- 2026-09-16：`npm run check:sdd -- --worktree --base origin/main` 通过，检查 16 个差异路径。
- 2026-09-16：Penpot 文件建立 14 个语义页面；旧设计内容仍保留，新增分层页面用于后续迁移。
- 2026-09-16：Penpot 建立 9 个原生 Token Set，并创建 `Theme / Default`、`Theme / Beach`、`Theme / Grassland`，每个主题启用 9 个集合。
- 2026-09-16：Penpot 新增代表性语义 Token：`color.background.canvas`、`color.background.surface`、`color.text.primary`、`color.action.primary`、`color.media.overlay`、`color.focus.ring` 及 `mediaViewer.control.background`。
- 2026-09-16：Penpot 资产面板验证存在 3 个原生组件；A–D 目前仍是流程说明而非完整可点击原型。
- 2026-09-16：生成原创海边与草原环境插画并导入 Penpot 对应主题页；海边包含沙滩、海浪、椰子树、贝壳、礁石、漂流木和海鸟，草原包含草地、远山、云、树木、野花、飞鸟和小路。
- 2026-09-16：新增 `docs/design-assets/README.md`，标注两项资产均为 decorative、桌面/移动裁切、隐藏、导出和 reduced-motion 规则。
- 2026-09-16：海边与草原各完成 Home、Browse、Album、Viewer 四张 1440 高保真画面和 390 移动画面；海边沙滩、椰树、贝壳等已进入首页环境层，草原远山、树、野花和小路已进入草原首页。
- 2026-09-16：Penpot 新增 `mode/default`、`mode/beach`、`mode/grassland` 原始色集合；语义色、排版、间距、圆角、阴影、动效与媒体查看器变量合计约 134 个 Token。抽查 `color.action.primary` 在 Beach、Grassland、Default 分别解析为 `#087E8B`、`#3D765C`、`#456A70`。
- 2026-09-16：Penpot 新增 16 个 Core 与 7 个 Media 原生主组件，Button/Primary 与 Icon Button 均具备 Default、Hover、Focus、Pressed、Disabled、Selected、Loading、Error 原生变体；Focus 具有 3px 外侧可见焦点环。
- 2026-09-16：原型页包含海边与草原各 9 个桌面节点、共 60 个点击热点、A–D 各主题流程入口；“错误→重试→暂停”曾实际点击成功，视频相关跨画板跳转仍出现预览错误，详见 verification.md。
- 2026-09-17：草原桌面 Flow A（首页→浏览→相册→查看器→下一项→退出）、Flow B（视频暂停/播放/全屏/退出/连续下一项）及查看器主题保持，已在 Penpot 预览中抽样点击通过；为避免预览错误，原型热点使用无动画跳转，动效契约仍保留在设计标注和开发交付中。
- 2026-09-17：已生成并肉眼检查两主题各 Browse、Album、Viewer 三张 390×844 移动端 PNG；手动导入 Penpot 失败，提示“无法上传该媒体文件”。自动写入通道也持续报告插件心跳超时。
- 2026-09-17：自动化连接恢复后，六张 390×844 移动端画板已导入 Penpot `09 Responsive Screens`；临时 QA 画板和 QA 流程已清理，正式原型保留 18 个桌面画板与 9 个流程入口。
