# 依赖评估治理规则实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“实现复杂通用能力前先调查现有方案和成熟外部库，同时避免依赖滥用”纳入仓库 SDD 规则。

**Architecture:** 在 `AGENTS.md` 放置简洁的仓库级强制原则，在 `docs/sdd.md` 放置完整评估细则和记录要求。以独立 light `change.json` 覆盖本次治理文档变更，验证完成后归档，不改应用代码或依赖。

**Tech Stack:** Markdown、JSON、仓库现有 TypeScript SDD 校验工具

## Global Constraints

- 保留工作区所有既有未提交改动，仅对目标段落做局部编辑。
- 不修改应用代码、依赖、产品行为或架构状态。
- 不安装依赖，不提交、不推送、不发布。
- 不把规则绝对化为禁止手写或强制使用第三方库。

---

### Task 1: 建立 light 变更声明

**Files:**
- Create: `docs/changes/dependency-evaluation-policy/change.json`

**Interfaces:**
- Consumes: `docs/sdd.md` 中的 light 声明结构
- Produces: 覆盖本次治理文档差异、可在验证后填写实际证据的变更记录

- [x] **Step 1: 创建实施前声明**

写入 `mode: "light"`、`behavior: false`、`architecture: false`，将需求、架构、模块、决策和 README 均标记为无基线影响，并明确本次只调整开发治理规则。`verification` 初始为空数组，避免提前声称验证通过。

- [x] **Step 2: 校验 JSON 语法**

Run: `node -e "JSON.parse(require('fs').readFileSync('docs/changes/dependency-evaluation-policy/change.json', 'utf8'))"`

Expected: 退出码为 0，无输出。

### Task 2: 分层更新依赖评估规则

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/sdd.md`

**Interfaces:**
- Consumes: 已确认设计中的决策顺序和验收标准
- Produces: 仓库级原则及详细 SDD 评估规则

- [x] **Step 1: 更新 `AGENTS.md` 总原则**

将现有视觉效果专项条目替换为通用规则：复杂通用能力实施前依次检查现有实现或依赖、标准平台能力和成熟第三方库；合适时优先复用，新增依赖或自行实现均须记录取舍，并链接到 `docs/sdd.md` 细则。

- [x] **Step 2: 更新 `docs/sdd.md` 细则**

新增“依赖与自行实现评估”小节，明确：

- 维护活跃度和采用情况；
- 包体积、加载与运行时成本、直接及传递依赖；
- 许可、安全、技术栈和浏览器兼容性；
- 适用时的无障碍、降级和长期维护影响；
- 允许自行实现的四类情形；
- 调研深度与风险相称；
- 新增依赖或自行实现时记录候选方案、选择与理由。

同时把视觉效果专项要求改为该通用规则的适用说明，保留浏览器回退和无障碍评估。

- [x] **Step 3: 检查差异范围**

Run: `git diff -- AGENTS.md docs/sdd.md docs/changes/dependency-evaluation-policy/change.json`

Expected: 只出现目标规则和变更声明；既有未提交内容保持不变。

### Task 3: 验证、记录并归档

**Files:**
- Modify: `docs/changes/dependency-evaluation-policy/change.json`
- Create: `docs/archive/2026-09-19-dependency-evaluation-policy/change.json`
- Modify: `docs/archive/README.md`
- Modify: `docs/changes/README.md`

**Interfaces:**
- Consumes: 已完成规则文本和真实命令结果
- Produces: 可追溯的归档记录及索引

- [x] **Step 1: 检查重复和冲突表述**

Run: `rg -n "第三方库|外部库|自行实现|手写|依赖评估" AGENTS.md docs/sdd.md`

Expected: 总原则和细则职责分明，没有互相冲突的规则。

- [x] **Step 2: 运行 SDD 工作区校验**

Run: `npm run check:sdd -- --worktree --base origin/main`

Expected: PASS；若因当前工作区其他未提交变化失败，如实记录具体失败，不修改无关文件规避。

- [x] **Step 3: 运行文档相关仓库检查**

Run: `npm run check`

Expected: PASS；若失败，如实记录与本次变更是否相关。

- [x] **Step 4: 填写真实验证证据**

将步骤 1 至 3 的实际结果写入 `verification`，不把未运行或失败检查写成通过。

- [x] **Step 5: 归档变更记录**

将完成的 light 记录移至 `docs/archive/2026-09-19-dependency-evaluation-policy/change.json`，并更新活动与归档索引。归档移动使用补丁完成，不执行提交。

- [x] **Step 6: 最终核对**

Run: `git diff --check`

Expected: 无空白错误。

Run: `git status --short`

Expected: 能识别本次新增和修改文件，同时保留用户原有工作区变化。
