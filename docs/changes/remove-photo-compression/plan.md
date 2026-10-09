# 删除独立照片压缩工具计划

执行方式：按用户明确删除指令，在现有 feat/r2-media-sync 分支内实施；不额外请求已授权范围的确认。

## 影响与顺序

- scripts/compress-photos.ts、scripts/compress-photos.test.ts：删除独立 CLI/编码/报告及专属测试，无保留消费者。
- package.json、README：删除入口与说明，保留构建自动派生的维护流程。
- docs/changes/module-review、module-repairs：在含旧工具条目的历史记录注明退役，保留真实旧验证与其他模块待办。
- 本次 full 记录与活动索引：声明 CLI 能力移除与实际验证，需求/架构/模块/ADR 基线未把独立 JPEG 工具列为必需能力，因此无需改写其现行契约。

## 步骤

- [x] 搜索全仓调用和文档；确认仅入口及专属测试调用旧工具，构建直接使用 generate-media，sharp 继续必需。
- [x] 删除脚本/测试和 npm script，移除 README 对应表项、章节与目录职责中的旧能力。
- [x] 标记历史审查/修复的退役范围，不改变其他验收结论。
- [x] 搜索悬空引用，运行 Node24 的 check/build/SDD 与 git diff --check，记录专属测试移除后的真实总数。
- [x] 回填任务、声明和索引，按用户后续明确授权提交、推送并创建 PR，不执行 R2 写入或网站发布。

回退：从现有 Git 基线恢复旧脚本/测试和 npm script、README 用法；不运行压缩或覆盖真实照片。没有新依赖；删除功能无需写与删除操作机械重复的新测试。
