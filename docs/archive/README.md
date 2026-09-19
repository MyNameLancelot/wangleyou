# 已完成变更归档

归档保存当时的规格、计划、任务和验证证据，不替代当前 [需求](../requirements.md) 或 [总架构](../architecture.md)。

## 归档条件

1. 完整流程规格内必要验收通过，任务全部真实完成；轻量声明中的必要验证完成。
2. 需求、架构、模块文档和使用说明已按变更影响同步。
3. 验证结果可追溯，无未解决的必要验证或实施阻塞。
4. 将活动变更整体移至 `YYYY-MM-DD-变更名称/`，修复相对链接并更新本索引；活动目录不保留重复副本。

新变更的 change.json 随目录归档，历史记录不补造声明。归档后不改写历史范围和结论；发现错误可添加有日期的更正说明。新的行为调整建立新变更。归档不代表 Git 提交、推送或部署已完成。

## 索引

| 日期 | 变更 | 范围 |
| --- | --- | --- |
| 2026-09-15 | [建立 SDD 开发指导](2026-09-15-sdd-guidance/spec.md) | 文档拆分、架构边界、计划与归档流程 |
| 2026-09-15 | [相册浏览闭环](2026-09-15-foundation-album-browsing/spec.md) | React 工程、相册与大图、内容校验、浏览器验证 |
| 2026-09-15 | [SDD 维护保障](2026-09-15-sdd-enforcement/spec.md) | 完整/轻量声明、Git 快照检查、模块依赖与 CI |
| 2026-09-16 | [GitHub Pages 部署配置](2026-09-16-github-pages-deploy/spec.md) | main 验证后发布、CI 复用与部署操作说明；线上发布待执行 |
| 2026-09-17 | [长期 UI/交互设计系统](2026-09-17-long-term-design-system/spec.md) | SDD 设计影响治理、双主题 Token/组件、1440 与 390 原型、开发交付与 A1–A12 验证 |
| 2026-09-17 | [提交信息语言约定](2026-09-17-commit-message-language/change.json) | 提交信息使用中文；type(scope) 保留英文关键字 |
| 2026-09-17 | [按设计基线实现前端](2026-09-17-ui-design-implementation/spec.md) | 三套主题运行时、照片与视频连续播放、页面结构与查看器对齐设计、状态与无障碍 |
| 2026-09-19 | [废弃 Penpot 设计治理](2026-09-19-retire-penpot-design-governance/spec.md) | 废弃外部设计稿与设计影响门禁，改由用户口述确认交互设计 |
| 2026-09-19 | [首页两屏主回忆](2026-09-19-home-two-screen-memory/spec.md) | 海滩 2K 首屏、两段整屏导航、主回忆与液态玻璃 |
| 2026-09-19 | [全站隔离主题应用](2026-09-19-isolated-theme-apps/spec.md) | 海边/草原独立 UI、无 UI 交互契约、主题隔离检查与完整浏览器验证 |
| 2026-09-19 | [悬浮主题切换](2026-09-19-floating-theme-switch/spec.md) | 移除全局顶栏、双主题独立毛玻璃悬浮开关及响应式验证 |
| 2026-09-19 | [紧凑主题切换](2026-09-19-compact-theme-switch/spec.md) | Lucide 循环图标、图标大小的毛玻璃圆形、悬浮展开胶囊与删除演示统计行 |
| 2026-09-19 | [主题开关紧凑胶囊](2026-09-19-theme-switch-compact-pill/change.json) | 展开宽度由 142px 收到 112px，毛玻璃移除白色描边与高光边 |
| 2026-09-19 | [玻璃去白边与眉标文案](2026-09-19-glass-edge-and-eyebrow-copy/change.json) | 首屏眉标改为 LeYou • Growing Moments，所有毛玻璃移除白色描边与高光边 |
| 2026-09-19 | [眉标纯文字左对齐](2026-09-19-leyou-eyebrow-plain-text/change.json) | 首屏眉标去掉底色胶囊，与标题左对齐 |
| 2026-09-19 | [首屏按钮文案](2026-09-19-start-memory-copy/change.json) | “开始回忆”改为“开启回忆” |
| 2026-09-19 | [依赖评估治理规则](2026-09-19-dependency-evaluation-policy/change.json) | 通用能力先调查现有方案和成熟第三方库，并约束依赖滥用与无依据手写 |
