# SDD 维护指南

## 目的

SDD 用于让有行为或架构影响的变更具备可追溯的范围、验证和基线同步；它不替代代码审查、浏览器验证或模块职责判断。历史变更资料不作为仓库内长期文档保留，当前基线以 requirements、architecture、module.md 和 ADR 为准。

## 何时使用

- **full**：改变用户可见行为、验收标准、数据结构、模块接口或依赖、关键状态/资源生命周期，或改变构建与部署架构。先说明行为和验收，再实施和验证。
- **light**：只修正文案、排版、明确既有行为的局部缺陷，且不改变产品行为和架构。记录影响范围与实际验证即可。

判断依据是实际影响，而不是文件数量、改动行数或提交类型。新页面、流程、交互语义、主题、重要响应式、空状态或错误恢复属于 full。

需要记录时，在 `docs/changes/<名称>/` 创建 `change.json`；full 另有 `spec.md`、`plan.md` 和 `tasks.md`。目录按需创建，完成后同步当前基线；不要把历史截图、设计稿或已完成的过程文档当作长期事实来源。

## 变更声明

`change.json` 说明模式、原因、行为/架构影响、实际验证以及 requirements、architecture、modules、decisions、README 的文档影响。未更新的文档也要说明原因。验证只能填写已经执行的结果。

不维护 Penpot 或其他外部设计稿，也不使用 `designImpact`、`designReason` 等设计分级字段。主题变更须确认两个主题仍不共享 JSX、CSS 或主题资产；唯一允许的共用 UI 是 `media-viewer` 查看器——它是全站共用组件，样式与功能都不可按主题定制，主题只能挂载它。新增依赖或自行实现通用能力时，记录现有实现、平台能力、候选方案和选择理由。

## 本地命令

```sh
npm run check:sdd -- --base origin/main
npm run check:sdd -- --staged
npm run check:sdd -- --worktree --base origin/main
npm run check:sdd -- --structure
```

`--structure` 只检查模块结构；PR CI 使用完整差异检查。检查会验证变更声明、Markdown 相对链接和模块公开入口/依赖方向，但不能证明交互语义正确。

## 提交与审查

提交使用中文 Conventional Commit：`type(scope): 中文描述`。`type` 可为 `feat`、`fix`、`docs`、`test`、`build`、`ci`、`chore` 等；正文按需记录原因和验证。

审查时确认：行为与验收是否明确、模块状态与资源是否唯一、基线文档是否仍准确、验证是否真实、主题隔离与媒体路径是否未被破坏。远端分支保护和合并权限在仓库 Settings 管理，不以本文替代实际配置。
