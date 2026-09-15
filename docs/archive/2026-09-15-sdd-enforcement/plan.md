# SDD 维护保障实施计划

依据 [spec.md](spec.md)。使用 writing-plans 规划，按任务在当前授权范围内实施和审查。

## 目标与架构

Node/TypeScript 读取 Git 快照；纯校验函数接收文件映射和差异路径，CLI 负责 Git。复用 Vitest，不新增依赖。全局约束：不修改应用行为、不修改远端权限、不 commit/push。

## 任务

- [x] P1（AC1–3）：scripts/sdd/check.ts 实现 validateSnapshot(files, changed)，scripts/sdd/check.test.ts 用合法/非法声明验证分类、文档更新和本地引用。change.json 字段见维护指南。先运行测试确认缺失实现失败，再实现并复测。
- [x] P2（AC4–5）：scripts/sdd/cli.ts 实现 --base REF [--head REF]、--staged、--worktree --base REF；Git diff 使用 -z --no-renames，将移动视为删除+新增。快照用 git show 或文件读取；集成测试用临时仓库验证多提交、暂存隔离、删除、移动和基准失败。
- [x] P3（AC6–7）：加入模块依赖检查，package.json 提供 check:sdd；CI PR 使用实际 base/head SHA，push 执行当前结构检查，PR 必需 sdd 检查负责差异。新增 docs/sdd.md、PR 模板，更新 AGENTS、README、架构与索引。
- [x] P4：npm run check、npm run build、实际工作区差异检查；审查错误信息、声明覆盖及流程边界，记录验证并归档。

## 文件与接口

scripts/sdd/check.ts：export validateSnapshot(files: Map<string,string>, changed: string[]): string[]，返回所有错误。cli.ts：非零退出表示校验或 Git 失败。module.md 记录工具职责。测试临时 Git 仓库不触碰本项目索引。

## 回退

移除新增 sdd CI job 和 npm 入口即可解除新增检查；按 Git 差异撤回本次脚本/规则，保留既有应用验证。不自动执行回退。不更改历史归档结论。
