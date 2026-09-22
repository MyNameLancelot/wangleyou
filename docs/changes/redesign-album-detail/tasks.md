# 相册详情页沉浸式重构任务

- [x] 从最新 `origin/main` 创建 `redesign/album-detail` 分支。
- [x] 阅读需求、架构、albums/theme/app 模块契约、现有详情页、路由、内容索引和 playback 入口。
- [x] 提出并通过视觉伴侣确认 B 沉浸式开场 + C 档案引言 + 原始比例瀑布流方案。
- [x] 确认 `album.opening`：可选、最多 20 个 Unicode 字符、缺省回退 `description`。
- [x] 创建 full SDD 规格、计划、任务和变更声明。
- [x] 为 `opening` 添加模型、构建期/运行时校验、生成索引及单元测试。
- [x] 为两个主题实现自然比例图片状态变体与原始比例瀑布流。
- [x] 为两个主题实现沉浸式开场、开场引言与空相册状态，并删除旧详情设计。
- [ ] 扩展 E2E，验证两个主题的开场、原始比例瀑布流与详情页特有失败状态。
- [ ] 同步 requirements、architecture、content/module.md、themes/module.md 的真实实施状态。
- [ ] 执行完整 check 与静态产物浏览器验证，记录实际证据。
- [ ] 复核变更目录、死代码/无用样式、文档链接和实际验证结果。
