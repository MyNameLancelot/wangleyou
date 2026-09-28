# 相册详情页沉浸式重构任务

- [x] 从最新 `origin/main` 创建 `redesign/album-detail` 分支。
- [x] 阅读需求、架构、albums/theme/app 模块契约、现有详情页、路由、内容索引和 playback 入口。
- [x] 提出并通过视觉伴侣确认 B 沉浸式开场 + C 档案引言 + 原始比例瀑布流方案。
- [x] 确认 `album.opening`：可选、最多 20 个 Unicode 字符、缺省回退 `description`。
- [x] 创建 full SDD 规格、计划、任务和变更声明。
- [x] 为 `opening` 添加模型、构建期/运行时校验、生成索引及单元测试。
- [x] 为两个主题实现自然比例图片状态变体与原始比例瀑布流。
- [x] 为两个主题实现沉浸式开场、开场引言与空相册状态，并删除旧详情设计。
- [x] 扩展 E2E，验证两个主题的开场、原始比例瀑布流与详情页特有失败状态（2026-09-28 补 `tests/browse.spec.ts`：引言与 description 回退、无效相册 ID 返回入口；桌面与移动 Chrome 共 4 用例通过）。
- [x] 同步 requirements、architecture、content/module.md、themes/module.md 的真实实施状态（2026-09-28 补 `opening` 的渲染规则、校验上限与索引字段说明）。
- [x] 执行完整 check 与静态产物浏览器验证，记录实际证据（2026-09-28：`npm run check` 13 文件 / 107 用例通过，`npm run build` 通过，端到端用例跑在静态产物服务上）。
- [x] 复核变更目录、死代码/无用样式、文档链接和实际验证结果（2026-09-28：SDD 检查与 `git diff --check` 通过）。
