# CI 与 Pages 工作流

## 目的与职责

check.yml 验证内容、SDD、类型、lint、单元测试、构建和浏览器行为。deploy.yml 编排 main 的验证、构建和 Pages 发布。native.yml 仅手动验证 Android 和 iOS 原生壳构建，不上传安装包。工作流不改变产品运行时功能，不管理用户域名、分支保护或环境审批规则。

## 公开入口与输入输出

- check.yml：push、pull_request、无参数 workflow_call。PR 读取事件的 base/head SHA 校验整个差异；其他事件执行 SDD 结构检查。输出任务结果，失败时上传浏览器诊断。
- deploy.yml：main push、workflow_dispatch；手动运行也要求 refs/heads/main。validate 复用同一提交的 check.yml；build 成功上传 dist/ 对应的 github-pages artifact；deploy 输出真实 page_url，展示于 github-pages environment。
- native.yml：仅 workflow_dispatch；Android 用 JDK 17/SDK 35 构建 debug APK，iOS 用 GitHub macOS runner 构建未签名模拟器 app；输出只有构建结果，不上传安装包、证书或设备资料。
- 固定部署路径 /wangleyou/；更换仓库路径或根域名需要同步 SITE_BASE 和相关验证。

## 依赖与权限

依赖 Node 24、npm 锁文件、已有校验/测试命令及 GitHub 官方 actions。只使用工作流 GITHUB_TOKEN，无需 PAT 或新增 secrets。validate 为 contents:read；build 增加 pages:read 以读取已有 Pages 设置；deploy 仅有 pages:write、id-token:write，无源码 checkout。Pages Source 必须由维护者选择 GitHub Actions。

## 状态与资源生命周期

验证、构建使用同一运行提交，不 checkout 可变的 main 分支。build 在独立干净 runner 重建原始内容，不发布内容夹具产物。artifact 使用上传 action 默认的短期保留周期；GitHub Pages 保存发布站点。pages 并发组串行发布、不取消正在运行的流程；等待中的旧运行可能被更新的运行替换。失败或跳过 validate/build 时后续任务不会执行。

## 主要文件与扩展

- check.yml：唯一检查命令定义，可独立运行或复用。
- deploy.yml：部署触发、依赖、权限、artifact 与环境。
- native.yml：手动原生构建校验，与 Pages 发布解耦。
- module.md：本契约。

保留独立 push/PR 检查，因此 main 会同时触发检查工作流与部署内验证。这保持现有必需检查名称不变，接受重复验证开销。后续合并流程需单独评估状态检查名称与保护规则，不静默改变。新增验证优先加入 check.yml。

## 验证方法

使用 actionlint 检查工作流语法、表达式及本地复用引用；人工核对 main/非 main、push/PR/手动触发和失败依赖。运行 npm run check、npm run build 与 test:e2e。首次真实 artifact 上传、Pages 权限和 HTTPS 地址需在提交合并后另行核实，不能由本地测试代替。

媒体迁移后：check任务显式设置 `VITE_MEDIA_BASE_URL` 为空，生成并使用本提交的同源媒体验收，不要求PR素材先写入R2；发布工作流的独立build不覆盖该变量，仍消费 `.env.production` 的公开R2前缀。媒体地址浏览器回归支持空前缀及真实R2两种构建。
