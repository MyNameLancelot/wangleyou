# 活动变更规范

每个变更使用有意义的独立目录名并创建 change.json，字段见 [SDD 指南](../sdd.md)。声明必须包含 `designImpact` 与 `designReason`；设计更新使用 full，并在实施前记录 Penpot 文件、页面、组件和原型入口。完整流程开始实施前创建以下三份文件；轻量流程只需要声明、理由、影响及验证证据。

## spec.md

记录状态（草案、已确认、实施中、验证中、完成或阻塞）、背景、目标、非目标、需求与架构引用、设计影响、行为及异常处理、编号验收条件、未决事项。区分用户明确要求与开发默认决策。

## plan.md

记录对应规格、影响模块及文件、依赖顺序、实施步骤、每步验证方式、文档更新和回退方式。步骤关联验收编号；尚未存在的代码路径明确标注为计划路径。方案变化时同步计划及原因。

## tasks.md

使用勾选列表跟踪真实完成状态，每项关联计划步骤；记录阻塞点、下一步及验证证据。完成表示该任务的工作和必要验证均已完成，不以已写代码代替已验证。

## 验证记录

小变更可直接写入 tasks.md，较大变更增加 verification.md。至少记录验收编号、检查或操作、环境、结果和未完成项。不保留未解释的占位符；不适用的检查写明原因。

## 阅读与归档

执行规则见 [AGENTS.md](../../AGENTS.md)，归档规则见 [archive/README.md](../archive/README.md)。目前无活动变更。最近完成：[提交信息语言约定](../archive/2026-09-17-commit-message-language/change.json)。最近完成：[长期 UI/交互设计系统](../archive/2026-09-17-long-term-design-system/spec.md)。最近完成部署配置：[GitHub Pages 部署配置](../archive/2026-09-16-github-pages-deploy/spec.md)。最近完成工程保障：[SDD 维护保障](../archive/2026-09-15-sdd-enforcement/spec.md)。最近完成：[工程初始化与相册浏览闭环](../archive/2026-09-15-foundation-album-browsing/spec.md)。
