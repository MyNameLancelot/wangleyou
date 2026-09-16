# GitHub Pages 部署配置验证

日期：2026-09-16。分支：feat/github-pages-deploy，基准 origin/main（dd35bdb）。本报告验证仓库配置与本地静态产物，不代表 GitHub Pages 已上线。

## 环境

- macOS arm64，Node v24.18.0，现有 npm 锁文件。
- Chrome 153.0.8010.48；桌面 1440×1000、Pixel 5 移动模拟 360×800。
- Playwright 使用 CI=1 和项目严格静态服务器 /wangleyou/，不使用 Vite 的路由回退。
- actionlint 1.7.11，官方发行包，仅解压到 /private/tmp；没有新增项目依赖。

## 验收结果

| 验收 | 操作与证据 | 结果 |
| --- | --- | --- |
| AC1、AC4 | actionlint .github/workflows/check.yml .github/workflows/deploy.yml | 通过，无语法、表达式或本地复用接口错误 |
| AC1、AC2、AC4 | YAML 解析后核对触发分支、手动 guard、workflow_call、needs、权限、并发、base 与上传路径，共 12 项断言 | 通过；属于静态验证，不模拟 GitHub 服务执行 |
| AC2 | npm run check | 内容、SDD 结构、类型、lint 通过；8 个测试文件、62 项测试通过 |
| AC2、AC3 | npm run build | 通过，入口 JS/CSS 均位于 /wangleyou/assets/ 且产物文件存在 |
| AC2、AC3 | CI=1 npm run verify:fixtures | 桌面/移动模拟共 2 项通过；相册文件与原始构建已恢复 |
| AC2、AC3 | CI=1 npm run test:e2e | 15 项通过，3 项按设备跳过；覆盖相册直达/刷新、实际图片加载、空相册、键盘/触屏、错误重试与焦点/资源清理 |
| AC3 | 检查 dist/index.html 资源路径、文件存在与无 fixture-single 内容 | 通过，16 个文件共 3,166,875 字节（约 3.02 MiB），最大文件 1,382,075 字节 |
| AC5 | README、总架构、需求与工作流契约审查 | 发布、重试、环境要求、回退、容量和线上待验证状态已说明 |
| AC6 | 工作区相对 origin/main 的 SDD 检查与 git diff --check | 归档后通过，14 个差异路径；原始相册配置与 Git 基准无差异 |

3 项浏览器跳过：桌面不测触屏滑动；移动模拟不测桌面全屏进入/拒绝。这不代表真机、Safari 或 WebView 已验证。

## 触发与失败场景审查

| 场景 | 配置预期 |
| --- | --- |
| PR 或功能分支 push | 原有独立检查，无部署触发 |
| main push | 部署内复用检查，成功后构建、上传并发布 |
| main 手动运行 | 同上，不绕过验证 |
| 功能分支手动运行 | validate 条件不成立，下游默认跳过 |
| 检查/构建/上传失败 | needs 和默认 success 条件阻止后续发布 |
| 多次发布运行 | pages 并发组串行，进行中的运行不被取消 |

复用工作流与 checkout 均来自同一运行提交；没有 checkout 可变 main、continue-on-error 或 always() 发布入口。构建只读 Pages 设置，发布任务才有写权限。保留独立 CI 导致 main 重复验证，命令仍单一来源。

## 工具与环境说明

Go 下载源在沙箱中无法解析，获工具授权后仍超时；改用官方 GitHub 发行包取得 actionlint 并成功验证。旧的本项目 Vite 预览占用 4173，确认进程来源并获工具授权后停止，由 Playwright 启动/关闭自己的严格静态服务器。检查与浏览器命令在获授权的沙箱外执行。

## 交付边界与后续线上确认

本次未 commit、push、合并、触发远端 Actions 或修改域名/环境/分支保护。Pages Source=GitHub Actions 有用户截图依据，但实际 artifact 上传、令牌/环境权限、部署成功与公网 HTTPS 访问未验证。

提交合并后按 README 操作，在 Actions 核实 validate/build/deploy 成功和部署 SHA；打开环境给出的 URL，检查首页、相册直达刷新、原图及缩略图。该步骤属于后续公开发布阶段，不将本地验收记录改写为线上证据。

参考：[GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite Pages 指导](https://vite.dev/guide/static-deploy#github-pages)、[可复用工作流](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)。
