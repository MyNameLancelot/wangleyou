# SDD 工具模块

## 目的、职责与非职责

验证变更声明结构、本地 Markdown 文件引用以及 src 模块的依赖方向和公开入口。不判断需求语义、不核实测试声明的真实性、不配置 GitHub 权限。

## 公开接口

`npm run check:sdd -- --base REF [--head REF]`、`--staged`、`--worktree --base REF`、`--structure`。成功返回 0，违规或 Git 基准不可用返回 1。

## 依赖与状态

仅依赖 Node、Git、已有 TypeScript/tsx。无持久业务状态，读取所选 Git 快照或工作区，不写索引、不修改仓库。CLI 同步子进程结束即释放。

## 文件与扩展

check.ts 提供纯函数 validateSnapshot、validateModules；cli.ts 负责 Git 和退出码；check.test.ts 与 git.test.ts 覆盖规则及临时 Git 仓库场景。新增 src 模块必须更新依赖白名单，保持有向无环关系；路径别名/非字面量动态导入暂不支持自动依赖解析，采用前必须扩展检查。

## 验证

`npx vitest run scripts/sdd`。Git 测试在临时目录内提交，不操作项目索引。
