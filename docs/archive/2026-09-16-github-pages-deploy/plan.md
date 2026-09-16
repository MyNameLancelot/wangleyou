# GitHub Pages Deployment Implementation Plan

依据 [spec.md](spec.md)。用户已确认部署方向并要求继续实施，在当前分支按任务执行、审查、验证，不额外创建工作树或提交。

**Goal:** 为 main 提供验证后发布到 GitHub Pages 的工作流。

**Architecture:** deploy.yml 通过 workflow_call 复用 check.yml，依次 validate → build → deploy。源码和工作流均来自同一运行提交；Pages 权限按任务分配。

**Tech Stack:** GitHub Actions，Node 24，npm，现有 React/TypeScript/Vite 与 Playwright。

## Global Constraints

- 仅完成本地配置，不 commit/push/合并或操作远端设置。
- 发布路径固定 /wangleyou/，上传目录 dist/，保留现有 PR 检查行为与名称。
- 不添加应用依赖，不修改应用功能或媒体。

## P1：工作流（AC1–4）

Files：修改 .github/workflows/check.yml；新增 .github/workflows/deploy.yml 和 .github/workflows/module.md。

Interfaces：check.yml 暴露无输入、无 secrets 的 workflow_call；deploy.yml 的 validate 调用同一提交的检查，build 上传默认 github-pages artifact，deploy 输出 page_url。

- [x] 在 check.yml 的 on 中添加 workflow_call；将结构检查条件改为 github.event_name != 'pull_request'，使手动调用也得到验证。
- [x] 添加部署工作流，核心依赖为：

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  validate:
    if: github.ref == 'refs/heads/main'
    uses: ./.github/workflows/check.yml
  build:
    needs: validate
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pages: read
    env:
      SITE_BASE: /wangleyou/
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - uses: actions/configure-pages@v6
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [x] 补充工作流名称、任务名称和合理超时，新增 actions 使用官方已核实的提交 SHA 固定版本；checkout/setup-node 延续已有 v4。
- [x] 检查功能分支手动运行跳过 validate 后下游默认跳过；失败下游同理，不引入 always() 或 continue-on-error。
- [x] module.md 说明职责、任务接口、权限、临时 artifact 生命周期与验证方法。

## P2：基线与使用说明（AC5–6）

Files：README.md、docs/requirements.md、docs/architecture.md、docs/sdd.md、docs/changes/README.md、当前 change.json。

- [x] README 写清 Source=GitHub Actions、合并 main 自动发布、Actions 手动选择 main、环境允许 main、失败定位和回退；说明远端尚未执行。
- [x] 修复需求中技术栈尚未确定的旧文本；记录发布触发条件，不扩展业务需求。
- [x] 架构说明验证/构建/发布边界和重复检查取舍；SDD 指南说明复用未改变 PR 必需检查。
- [x] 写入完整声明，列举 updated/none 文档影响，不补造重大技术决策。

## P3：验证与归档（AC1–6）

- [x] 使用 actionlint 静态检查两个工作流，并人工核对触发与依赖场景表；工具仅临时使用，不成为应用依赖。
- [x] 执行 npm run check、npm run build；预期所有已有测试通过且产物资源使用正确 base。
- [x] 关闭仅本任务确认的旧预览服务后，以 CI=1 串行执行 npm run verify:fixtures 与 npm run test:e2e，保证测试自己的严格静态服务器，恢复原始相册内容。
- [x] 记录环境、结果、dist 体积、未验证远端状态；运行 SDD 工作区检查和 git diff --check。
- [x] 验证通过后同步任务状态，将整个变更目录移至 docs/archive/2026-09-16-github-pages-deploy/，更新索引并复查链接。

## 回退

发布出错时先修复 main 对应问题并重新运行；需恢复旧内容时通过新 PR revert 引入问题的提交，保留 SDD 说明，再经 main 验证部署。暂停自动发布可禁用 Deploy GitHub Pages 工作流。撤回本次配置可移除 deploy.yml 与新增 workflow_call，保留原有 check.yml 验证；不自动执行任何回退。
