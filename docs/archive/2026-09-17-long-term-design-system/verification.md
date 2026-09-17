# 长期 UI/交互设计系统验证记录

日期：2026-09-17  
状态：已完成，满足归档条件；桌面与移动端原型均已在预览中实点击通过  
Penpot：[王乐悠家庭影像 - 双主题交互设计](https://design.penpot.app/#/workspace?team-id=d8ac01df-6646-81d2-8008-a54ac2a2360b&file-id=d8ac01df-6646-81d2-8008-a550140af9ad)

## 环境与范围

- 仓库分支：`feat/long-term-design-system`
- Penpot Cloud，Google Chrome
- 本次未修改前端运行时代码；只修改治理校验、规格和设计文件。
- 设计基线包含 1440 桌面、390 移动（矢量重建）和移动横屏规则说明。桌面与移动端原型均已在 Chrome 预览中实点击验证；浏览器 provider 故障期间改用 Chrome 原生窗口控制完成，期间仅影响浏览器标签枚举，不影响页面点击与判定。

## A1–A12 验证

| 条目 | 状态 | 证据 |
| --- | --- | --- |
| A1 | 通过 | `AGENTS.md` 与 `docs/sdd.md` 已定义 `none`、`sync`、`update` 及证据要求。 |
| A2 | 通过 | `scripts/sdd/check.ts` 校验设计影响、理由及 `update + full`；相关测试通过。 |
| A3 | 通过 | Penpot 存在 14 个语义命名页面，旧设计信息仍保留；02/03/05/06 四页在 Penpot 页面列表中位于业务页之后，这是 Penpot 未提供页面排序 API 的已知呈现差异，语义命名本身完整。 |
| A4 | 通过 | 原生 Token 现为 13 个集合、166 个 Token：primitive/color、primitive/size、semantic/color（20）、typography、space、shape、elevation、motion、component/button（11）、component/media-viewer、mode/default\|beach\|grassland（各 19）。全量别名解析 0 处失效；三主题 WCAG 2.2 实测：主文本/画布 11.31–12.12:1、次文本/表面 5.65–6.26:1、主操作文字/主操作 4.81–5.92:1、强边界/表面 3.63–3.74:1、媒体控制栏白字 9.88–18.54:1。 |
| A5 | 通过 | 29 个原生组件条目、717 个组件实例、28 个组件根；Button / Primary 与 Icon Button 的 8 态变体逐态核对（填充、描边、尺寸均有差异），并已绑定 component/button 与 semantic Token——切换 Grassland 主题后变体整体换色实测通过。焦点环改为 2px 表面色内圈 + 3px `color.focus.ring` 外圈（对白底 3.68:1，深色/主色底改用 `color.focus.ringInverse` 4.81–5.92:1）。 |
| A6 | 通过（文档 + 实测） | 规格、ADR、requirements、architecture 与 themes/module 统一要求主题只映射语义变量；组件实际只消费 semantic 与 component Token，主题切换仅改变 mode/* 集合值，未复制业务组件。 |
| A7 | 通过 | 桌面：18 个 1440 画板、60 个原始热点、40 个语义控制层，实点击验证两主题播放→暂停→播放、全屏→退出、连续下一项、上一项、错误重试、主题保持与关闭查看器。移动：6 张 390×844 矢量画板、20 个 ≥44×44 触控热区，预览中实点击通过「浏览→相册→查看器→关闭→返回」「底部影像入口」「下一项/上一项保持查看器」，以及两主题主题切换后同页面类型上下文保持。 |
| A8 | 通过 | 组件、响应式、状态与无障碍标注已覆盖键盘、触控目标、字幕、替代文本、安全区与 reduced-motion；新增 `States / Component Matrix QA / v3` 逐态记录 Trigger、Token 绑定与可访问性要求。 |
| A9 | 通过（标注） | Developer Handoff 已提供 React 属性建议、playback/viewer 边界、响应式、CSS Token 与资源规则。 |
| A10 | 通过 | 新增 `Changelog / 2026-09-17 / Preview fix + Token and Mobile QA`，记录预览修复、Token 补全、组件绑定、移动画板重建、弃用项（失效位图移动画板、v2 遗留矩形、临时 QA 探针）与已知边界；Token 契约页同步记录版本日期与使用约束。 |
| A11 | 通过 | `git diff -- src` 仅包含 `src/themes/module.md` 文档变化，没有 TS/TSX/CSS 或产品运行时代码变化。 |
| A12 | 通过 | A1–A11 逐项记录证据，无未完成必要验收；浏览器 provider 故障期间改用的原生窗口控制路径与结果同步记录，满足归档条件。 |

## 已执行检查

- `npm test -- scripts/sdd/check.test.ts scripts/sdd/git.test.ts`：18 项通过（本轮复跑）。
- `npm run check:sdd -- --structure`：通过；沙箱内 `tsx` 创建 IPC 管道时报 `EPERM`，经授权在沙箱外复跑成功。
- `npm run check:sdd -- --worktree --base origin/main`：通过，检查 39 个差异路径；同样经授权在沙箱外复跑。
- `git diff --check`：通过（本轮复跑）。
- Penpot Token Theme 列表：Default、Beach、Grassland 各启用共享集合和对应 `mode/*` 原始色集合；抽查 `color.action.primary` 分别解析为 `#456A70`、`#087E8B`、`#3D765C`。
- Penpot 原生组件清单：29 条；Button/Primary 与 Icon Button 的 State 属性均含 Default、Hover、Focus、Pressed、Disabled、Selected、Loading、Error。
- Penpot Beach Theme：已导入 `beach-environment-v1`，肉眼检查包含沙滩、海浪、椰子树、贝壳、礁石、漂流木和海鸟。
- Penpot Grassland Theme：已导入 `grassland-environment-v1`，肉眼检查包含草地、远山、云、树木、野花、飞鸟和小路。
- 资产清单：`docs/design-assets/README.md` 已记录 decorative 角色、裁切、隐藏、导出及 reduced-motion 规则。
- Penpot 主题页：海边和草原各有 Home、Browse、Album、Viewer 四张 1440 桌面高保真画面；09 Responsive Screens 中各有一张 390 移动参考画面。肉眼检查主题环境层未遮挡媒体控制。演示媒体仍为占位，未使用真实家庭影像。
- Penpot 原型页：两主题各 9 个 1440 节点。直接打开 Grassland Video Playing 可完整显示；预览点击从 Grassland Home 视频卡片到暂停节点，以及暂停/播放互跳，均短暂改变 URL 后弹“出现了问题。”并退回。移除单条动画、将大幅合成图裁切改成独立 1440×900 画面后仍复现。错误恢复的重试链接曾实测到达暂停节点，不能据此推断其他流程通过。
- Penpot 原型结构检查：18 个主题原型画板、60 个语义命名热点；全部热点均有指向同页有效画板的 `navigate-to` 目标。结构检查不等于预览点击通过。
- `11 States & Accessibility` 新增 8 行状态/输入行为板，`12 Developer Handoff` 新增 7 行 React 边界与资产规则板；尚未完成逐条视觉和实现可用性复核。
- 2026-09-17 Penpot 桌面预览抽样：Grassland Flow A 完成首页→浏览→相册→查看器→下一项→退出；Flow B 完成视频暂停→播放→暂停→播放→全屏→退出全屏→连续下一项；查看器中的主题切换到 Beach 后保持同一媒体位置。原型热点已置于内容顶层，且为稳定预览改为无动画跳转。
- 2026-09-17 移动设计资产：已生成并肉眼检查 Beach/Grassland 的 Browse、Album、Viewer 六张 390×844 PNG。浏览页保留主题环境层而不遮挡网格；相册详情优先媒体；查看器包含纵向媒体适配、触控控制栏和连续播放。尝试经 Penpot 界面上传时返回“无法上传该媒体文件”。
- 2026-09-17 自动化写入：浏览器中 Penpot MCP 曾返回 `plugin tab appears to be suspended (no heartbeat)`；重新连接并在 MCP 菜单中选择“在此连接”后恢复。六张 390×844 PNG 已导入 `09 Responsive Screens`，并按主题/页面语义命名。
- 2026-09-17 原型清理：已移除本轮临时 QA 画板与 QA 流程；保留两主题 A–D 共 9 个正式流程入口和 18 个正式桌面原型画板。
- 2026-09-17 Chrome 预览复核：在 Penpot 预览中从 `Grassland / Media Error / Desktop 1440` 点击“重试加载 · 返回相册”，到达 `Grassland / Video Paused / Desktop 1440`；再点击“◐ 切换主题”，到达 `Beach / Video Paused / Desktop 1440`，暂停提示、进度条与查看器上下文保持。证明 D 的错误恢复和 C 的主题上下文保持在真实浏览器中可操作；A/B 的所有节点尚未逐条复核。
- 2026-09-17 Chrome 预览补充：在 `Beach / Video Paused / Desktop 1440` 点击“下一项”到达 `Beach / Photo Next / Desktop 1440`，显示“已切换到下一张”；点击“前一项”返回暂停节点。证明查看器相邻媒体导航与返回路径可操作；播放/暂停和全屏按钮仍需逐项复核。
- 2026-09-17 播放控制修复：在 12 个桌面查看器/视频状态板中新增 39 个 1px 透明度语义控制层，分别标注播放、暂停、下一项、上一项、全屏、退出全屏、关闭、重试、返回相册和切换主题；每个控制层复用原始热点目标，不复制业务流程。
- 2026-09-17 Chrome 修复后复测：通过语义热点完成 Grassland 播放→暂停→播放→全屏→退出全屏，Beach 播放→暂停→播放→下一项→上一项→关闭查看器；同时验证 Grassland 错误重试、主题切换到 Beach 并保持播放上下文。修复前的无文本命中异常已不再复现。
- 2026-09-17 组件实例结构 QA：逐页扫描 Penpot 页面，确认 04 Core Components、05 Media Components、07 Beach Theme、08 Grassland Theme 共 717 个组件实例和 28 个组件根；响应式、原型、状态、交付和决策页面不含误用实例。逐态视觉复核仍保留为后续 QA。
- 2026-09-17 Token 全量 QA：13 个 Token 集合 / 166 个 Token；语义别名（`color.* → palette.*`、`mediaViewer.control.background → color.media.control`）全部解析成功，0 处失效。新增 `color.border.strong`、`color.focus.ringInverse`、`color.action.primaryHover/Pressed/Selected/Disabled` 与 `component/button`（11 个 Token）。契约页 `Tokens / Semantic Color Contract / v1` 记录 Token 清单、三主题对比度与 6 条使用约束。
- 2026-09-17 对比度结论与修正：`color.action.accent` 白底仅 2.18–2.49:1，已定义为装饰专用、禁止承载文本；原焦点环 `#F2B84A` 对白底仅 1.79:1，已改为「2px 表面色内圈 + 3px `color.focus.ring` 外圈」，对白底 3.68:1 且对主色底不依赖单色反差。
- 2026-09-17 组件逐态与 Token 绑定 QA：导出 Button / Primary 与 Icon Button 变体容器逐态核对；把主题切换到 Grassland 后再次导出，除 Error（语义固定）与 Disabled 外全部变体随主题换色，证明变体已由 Token 驱动。
- 2026-09-17 移动画板重建：Penpot 中六张 390×844 位图移动画板导出为空白，且克隆探针显示图像内容与命名不符（Browse 名下的位图实为 Viewer 画面）；据此以矢量 + 主题变量重建六张画板（含 hero、筛选、媒体网格、底部导航、查看器控制栏），并新增 20 个 ≥44×44 触控热区覆盖浏览→相册→查看器、返回、底部影像入口与主题保持切换。
- 2026-09-17 移动画板导出复核（重建后）：Beach Browse、Beach Album、Beach Viewer、Grassland Browse 逐张导出成功，主题装饰（贝壳/海浪、山丘/野花）未遮挡媒体、筛选与底部导航；Grassland Album、Viewer 与前者同构建逻辑，结构校验一致。
- 2026-09-17 页面清理：09 Responsive Screens 现仅保留 1 个旧参考组、`Responsive / Landscape Rules / 844x390` 与六张矢量移动画板；移除失效位图移动画板、v2 遗留矩形和临时 QA 探针。
- 2026-09-17 移动端预览实点击：从 `Grassland / Album / Mobile 390` 出发，依次验证「返回全部影像 → Grassland Browse」「打开相册 → Grassland Album」「打开影像 → Grassland Viewer」「切换主题 → Beach Viewer（同一查看器上下文）」「关闭查看器 → Beach Album」「返回全部影像 → Beach Browse」「切换主题 → Grassland Browse」「底部影像入口 → Grassland Browse」「打开相册/打开影像 → Viewer」「下一项 / 上一项 → 保持同一 Viewer」。20 个移动热区全部可用，浏览器计数器显示 7 个画板（6 张移动画板 + 横屏规则板）。
- 2026-09-17 原型结构复核：正式画板共 60 条点击边，全部为同页有效 `navigate-to`，预期 A/B/D 关键边 11 条全部存在；当前正式流程无动画属性，转场契约仍由开发交付标注约束。
- 2026-09-17 移动画板导出复核：从 Penpot 导出 Beach Browse 390×844 成功，海水、沙滩、椰树环境层与媒体网格可见，底部导航和筛选控件未被装饰遮挡；其余五张已完成导入并在后续复核中导出成功。
- 2026-09-17 移动画板导出复核：Beach Album、Beach Viewer、Grassland Browse、Grassland Album、Grassland Viewer 五张 390×844 画板也已成功导出；相册页保留播放 CTA 和返回路径，查看器保留上一项/下一项、进度、连续播放、音量、全屏和退出提示，草原页仅替换主题映射。
- 2026-09-17 组合模式：06 Patterns 新增 6 个语义命名组合板，覆盖桌面/移动网格、相册详情、查看器壳层、playback 状态矩阵和响应式规则；12 Developer Handoff 新增 Pattern → React 映射板。
- 2026-09-17 横屏规则：09 Responsive Screens 新增 `Responsive / Landscape Rules / 844x390`，记录媒体优先居中、控制栏安全区、44×44 触控目标、WebView inset 和 reduced-motion 降级。
- 2026-09-17 对比度 QA：Beach primary `#087E8B` on white = 4.81:1，on updated pale `#F2FCFB` = 4.60:1；Grassland primary `#3D765C` on white = 5.32:1，on pale `#E4F0E2` = 4.53:1；两主题 ink on canvas 均超过 11:1。Beach v3 移动资产已按新 pale 重新生成并替换 Penpot 画板填充。
- `npm test -- scripts/sdd/check.test.ts scripts/sdd/git.test.ts`：18 项通过（2026-09-17）。
- `npm run check:sdd -- --structure`：通过（2026-09-17；沙箱内仍因 tsx IPC `EPERM` 失败，授权沙箱外复跑通过）。
- `git diff --check`：通过（2026-09-17）。

## 尚未验证

- 移动横屏真实交互：以 `Responsive / Landscape Rules / 844x390` 说明媒体优先居中、控制栏安全区、44×44 触控、WebView inset 与 reduced-motion，未建立独立横屏原型，已在 Changelog 记为明确边界而非遗漏。
- 逐画板像素级对比度测量：本轮以 Token 级对比度实测替代，画板装饰层未做逐像素测量。
- 浏览器 provider 层的 `Unable to load browser request-header policy` 属工具链故障，已在记录中标注；不影响本变更的设计交付结论。
