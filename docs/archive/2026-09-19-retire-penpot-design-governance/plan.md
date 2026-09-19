# 废弃 Penpot 设计治理计划

## 影响范围

- 流程文档：AGENTS.md、docs/sdd.md、docs/changes/README.md。
- 产品与架构：docs/requirements.md、docs/architecture.md、README.md、docs/decisions/0002 和新增 0003。
- 校验：scripts/sdd/check.ts 及对应单元、Git 快照测试。
- 模块与活动记录：themes 模块文档、两个活动 change.json、本次完整变更记录。

## 实施步骤

1. 以用户口述流程替换现行文档中的 Penpot、设计基线和设计影响分级要求，对应 AC-1、AC-4。
2. 从 SDD 校验和测试夹具中删除设计字段要求，并保留其他声明校验，对应 AC-2。
3. 清理活动记录中的废弃字段，补齐本次规格、计划、任务和验证记录，对应 AC-3。
4. 执行 SDD 工作区、完整检查和构建；将真实结果写回 change.json 与任务，对应 AC-5。

## 回退

若本次变更需要撤回，恢复本变更涉及的流程文档、ADR、脚本和测试即可；不影响运行时产品代码或内容数据。
