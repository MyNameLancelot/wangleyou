# SDD 维护指南

## 何时使用完整流程

行为/验收标准、数据结构、模块契约/依赖、关键状态/生命周期或有产品/架构影响的构建部署变化，使用 full；先 spec、plan、tasks，实施、验证、同步基线后归档。

姓名/文案/排版修正、恢复明确已有规格的局部 bug、无行为和架构影响的维护，使用 light；只需声明，不强制三份文档。判断依据是实际影响，不能只看改动行数、扩展名或提交标题。bug 如果引入新行为仍为 full。

## 变更声明

每个 PR 新增或更新 `docs/changes/<名称>/change.json`；完成后可移至 `docs/archive/<日期>-<名称>/change.json`。多个记录共同解释整个 PR，审查时核对覆盖范围。轻量也在同样目录归档，仅无需三份文档。仅改旧记录中的一个空格虽可能通过结构检查，但不满足流程要求。

```json
{
  "mode": "light",
  "summary": "将展示姓名修正为王乐悠",
  "reason": "只更正文案，不改变交互、接口和架构",
  "behavior": false,
  "architecture": false,
  "verification": ["已核对展示文案和需求中的姓名一致"],
  "impacts": {
    "requirements": {"status": "updated", "reason": "统一产品姓名", "paths": ["docs/requirements.md"]},
    "architecture": {"status": "none", "reason": "不改变系统结构"},
    "modules": {"status": "none", "reason": "模块契约不变"},
    "decisions": {"status": "none", "reason": "没有长期技术决策"},
    "readme": {"status": "none", "reason": "使用方法不变"}
  }
}
```

不再维护 Penpot 或其他外部设计稿，也不使用 `designImpact`、`designReason` 字段。新增或改变页面、流程、交互语义、组件语义、主题、重要响应式、空状态或错误恢复时，必须使用 full；实施前将用户已确认的口述要求写入 spec.md 的行为和验收项。实现后以运行时浏览器核对相应视口、流程和可访问性。历史归档保留原有字段作为当时事实，不追溯修改。

涉及主题时，规格必须判断是否保持“主题 UI 完整隔离”：各主题的 JSX、CSS、装饰和资产不得互相导入或复用；仅无 UI 的类型、领域逻辑和交互契约可共享，并须有静态导入检查与每主题行为验证。

## 依赖与自行实现评估

实现具有一定复杂度且已有通用解决方案的能力前，按以下顺序调查：先检查项目已有实现或依赖能否复用，再判断标准平台能力是否足够，最后评估维护活跃的成熟第三方库。存在满足约束的方案时原则上优先复用，避免重复实现；需求简单且引入成本更高时，不得机械增加依赖。调研深度须与变更风险、复杂度及长期维护影响相称，琐碎代码不要求形式化或冗长调研。

引入新依赖时，根据实际风险评估并记录：

- 维护活跃度、社区采用情况和安全记录；
- 包体积、加载与运行时成本，以及直接和传递依赖；
- 许可证、项目技术栈和目标浏览器兼容性；
- 适用时的无障碍、降级策略和长期维护影响。

以下情况允许自行实现：需求非常简单且依赖成本明显更高；没有满足需求或约束的成熟库；候选库存在不可接受的安全、许可、体积、兼容性或维护风险；项目已有清晰稳定的内部实现模式。无论新增依赖还是自行实现，均须在本次变更记录中简述候选方案、最终选择和理由。

新增可见视觉特效仍须在 full 规格中应用上述评估；采用第三方库时明确目标浏览器回退和无障碍影响，自行实现时说明候选方案不合适的具体原因。

字段必填；verification 填实际执行和结果，不能提前声称通过。`updated.paths` 是仓库根目录相对路径，必须出现在整个差异中；文档删除也可声明，但理由须解释替代位置。不适用项写具体原因，不要求每次都修改总架构。文件引用检查覆盖变更 Markdown 及被删除/移动目标的已有引用；仅验证内联相对链接目标存在，不验证标题锚点、引用式链接或外网链接。

历史归档保留原格式，不强制补造 change.json。引入本机制的初始功能 PR 由本次声明关联已有功能归档，审查历史范围；今后的 PR 不能依赖没有变化的旧声明通过。

## 本地命令

```sh
# 全部已提交 PR 差异，自动计算 merge-base（先确保本地目标引用最新）
npm run check:sdd -- --base origin/main
# 指定完整 PR 端点
npm run check:sdd -- --base BASE_SHA --head HEAD_SHA
# 实际暂存内容；未暂存的文档不能掩盖遗漏
npm run check:sdd -- --staged
# 已提交、未暂存、暂存以及未跟踪文件共同构成的工作区
npm run check:sdd -- --worktree --base origin/main
# 当前模块结构，无变更声明门禁；已包含在 npm run check
npm run check:sdd -- --structure
```

在仓库根目录执行。基准不存在或历史不足会失败，不退化成 HEAD~1。移动按删除+新增处理。Git 快照只读取所选版本的文件，暂存冲突会失败；解决冲突后重试。`--staged` 不要求每个中间提交都运行，可在形成完整提交时运行；CI 使用整个 PR。

暂不安装 hook，也不改变全局 Git 配置。如果以后启用仓库级 pre-commit，调用上述 --staged 命令即可；hook 可绕过，不作为最终保障。

## 提交信息

提交信息使用中文，便于评审和回溯；类型与作用域沿用 Conventional Commits 的英文关键字，保持工具链可解析。

```
<type>(<scope>): <中文描述>
```

- type：feat、fix、docs、style、refactor、perf、test、build、ci、chore、revert。
- scope：受影响的模块或领域，例如 design-system、sdd、pages；范围不明确时可省略。
- 描述：祈使句、中文、不超过 72 字符，说明改了什么，不逐条复述 diff。
- 正文：按需补充原因、影响和验证结论；与行为和架构有关的提交必须与 change.json 的结论一致。

示例：

```
docs(sdd): 废弃外部设计稿与设计影响门禁

将页面与交互设计改为用户口述，移除 change.json 设计字段及相应自动校验。
验证：SDD 校验测试、类型检查与完整文档引用检查。
归档：docs/archive/<日期>-retire-penpot-design-governance。
```

提交信息只写给人读，不替代变更声明和文档：事实来源仍是规格、总架构、module.md 与归档记录。

## 审查清单

- PR 全部变化是否被声明解释？full/light 分类、behavior/architecture 布尔值是否真实？
- 用户可见交互是否已有明确的用户口述要求，并在 full 规格中转写为可验证的行为与验收项？
- 规格是否对应实际触发条件、异常行为和验收结果？恢复既有行为的 bug 是否说明原规格与回归验证？
- requirements、architecture、module.md 是否仍准确？none 理由是否成立？
- 实现是否遵循公开入口、依赖方向和唯一状态/资源所有权？验证证据是否真实？
- 任务状态是否真实？完成后基线同步、链接修复及归档索引是否完成？
- 提交信息是否使用中文，并与 change.json 的范围和结论一致？
- 如果修改检查脚本、CI 或本指南，是否削弱原约束？不得仅靠修改后的检查自证安全。

依赖检查解析 TS/JS 的静态导入、导出与字面量动态导入/require，约束现有模块的无环依赖白名单和公开入口。CSS 引用、路径别名、非字面量动态导入不在自动解析范围，采用新的导入方式前扩展检查并审查。既有业务测试继续验证内容和播放状态；文档检查不能证明架构正确。

## GitHub 合并限制

仓库内：工作流提供 `SDD policy` job；PR 校验完整差异，push 仅校验当前模块结构。既有 `check` job 运行应用验证和新增检查测试。远端：本次未读取或修改保护规则，实际启用状态未核实。

check.yml 同时供 deploy.yml 通过 workflow_call 复用；部署只在 main 验证通过后继续，手动运行同样执行 SDD 结构检查。独立 PR 的 `SDD policy` 与 `check` 保持不变，分支保护仍选择这两项；不要选择只在 main 发布时出现的部署内检查作为 PR 必需项。部署内结构检查不能代替 PR 的完整声明审查。

维护者在 Settings → Branches（或 Rules → Rulesets）对实际默认分支配置：

1. Require a pull request before merging；个人维护不强制要求无法由本人满足的额外审查人数。
2. Require status checks to pass：先让 PR 工作流运行，再选实际出现的 `SDD policy` 和 `check`，核实检查来源为 GitHub Actions；建议要求分支与目标保持最新。
3. 核查 bypass 列表和管理员绕过设置，按期望禁止直接推送及绕过。不允许任意强推或删除受保护分支。
4. 用违规 PR 验证检查失败时不能合并，修复后验证可合并。尚未进行此远端验证。

工作流存在不等于禁止合并或直接推送。当前没有配置 merge queue；以后启用需支持 merge_group 事件并明确队列差异基准，不要直接启用导致检查缺失。

官方参考：[Git hooks](https://git-scm.com/docs/githooks)、[GitHub 分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。

## 三个操作示例

1. 新增自动播放：full，先定义播放/暂停/后台行为，更新 playback 的 module.md 与必要基线，测试后填写 verification 并归档。
2. 修复最后一张照片越界：如果已有规格明确末张行为，用 light，reason 引用该规格，增加有意义的回归验证；若改变循环策略则 full。
3. 姓名修正：light，按上面 JSON 同步实际受影响文案和需求；已有历史记录采用有日期的更正，不改写历史结论。

自动播放属于 full；恢复既有末张行为通常为 light；不影响布局的姓名修正通常为 light。若文本长度、布局或操作含义发生变化，按实际行为选择 full。
