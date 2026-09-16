# GitHub Pages 部署配置

状态：本地配置验收完成。用户已确认使用 GitHub Actions、main 更新后自动部署，并授权在 feat/github-pages-deploy 分支完成配置。日期：2026-09-16。

## 背景与目标

普通仓库 wangleyou 已有 React + TypeScript + Vite 静态应用和 CI。用户截图显示 Pages Source 已选择 GitHub Actions，但仓库没有部署工作流。依据 [产品需求](../../requirements.md)、[总架构](../../architecture.md) 和 [SDD 维护指南](../../sdd.md)，补充可审查、可提交的发布配置。

目标地址为 https://mynamelancelot.github.io/wangleyou/，构建路径 /wangleyou/。运行时只有静态文件，Node 24 仅用于构建与验证。

## 设计与取舍

选择“deploy.yml 调用现有 check.yml → 构建 → 部署”的显式任务依赖。相比复制一套检查命令，复用可以防止验证规则分叉；相比监听 workflow_run，单次工作流的提交和依赖更容易核对。保留现有 push/PR 独立检查，因此 main push 会同时产生独立检查和部署内检查，接受少量重复运行以保持现有检查名称及触发行为稳定。

- check.yml 新增 workflow_call；在非 PR 事件执行 SDD 结构检查，PR 仍检查完整差异。
- deploy.yml 只监听 main push 和手动触发；所有发布路径要求 github.ref 为 refs/heads/main，手动选功能分支时跳过。
- validate 调用相同提交下的 check.yml；build 依赖 validate，deploy 依赖 build。失败或跳过不上传/部署，没有 continue-on-error。
- build 使用 Node 24、npm ci、SITE_BASE=/wangleyou/，从当前运行的提交构建；产物只上传 dist/，不提交产物或创建 gh-pages 分支。
- 使用官方 Pages actions；构建仅有 contents:read 和 pages:read，部署任务才有 pages:write 和 id-token:write，关联 github-pages environment 和真实 page_url。
- 使用 pages 并发组，不中断进行中的发布；同一时间仅一个发布流程运行。

## 非目标与外部前提

本次交付仓库配置和本地验证，不自动 commit、push、合并或触发线上发布，不修改 GitHub 权限、域名和环境规则。用户已选 Source，但首次远端 Actions 成功、环境权限、线上可访问性均需提交合并后确认，不作为本次本地配置验收。自定义域名、应用功能变化不在范围内。

## 行为与异常

main 验证失败不发布；构建、Pages 未启用或上传失败时停止后续任务。Pages 环境只允许 main；如果已有审批规则则正常等待。手动重试选择 main，仍执行完整验证。若改绑根域名，另行修改构建路径并验证，不把本配置说成自动支持所有域名。

## 验收

- AC1：部署仅在 main push 或 main 手动运行时可达，普通 PR/功能分支不发布。
- AC2：检查、构建、发布有显式依赖；本地完成与复用检查一致的 check、build、内容夹具验证和浏览器验证。
- AC3：只打包 dist/；资源保持 /wangleyou/ 子路径，目录具备 index.html、资源和媒体。
- AC4：工作流 YAML/表达式通过静态检查，权限、environment、page_url 与并发控制按设计配置。
- AC5：文档说明首次发布、重试、失败定位、回退、平台容量限制，以及本地完成与线上待验证的区别。
- AC6：完整变更声明、基线影响及验证记录齐全，工作区相对 origin/main 的 SDD 检查通过。

## 未决事项

无实现阻塞。远端首次发布是后续已明确的操作阶段，不声明已上线。
