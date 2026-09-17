# 总架构

## 状态与阅读方式

截至 2026-09-17，工程基础、照片与视频浏览、连续播放、三套主题切换与设计系统基线已实现并通过验收。技术栈为 React + TypeScript + Vite，npm 管理依赖。自动幻灯片、背景音乐与原生桥接尚未实现。

本文维护当前有效架构；拟议方案写入变更 spec，重大选择写入 decisions。每次实施完成后同步实际结构和实施状态，历史设计保留在归档中。

产品行为以 [requirements.md](requirements.md) 为准，开发流程以 [AGENTS.md](../AGENTS.md) 为准。

## 系统边界

- 维护者更新仓库内资源和配置，构建阶段校验并生成静态站点。
- 浏览器加载静态内容，完成相册浏览和播放，无业务服务端或数据库。
- 本地存储仅保存偏好，不成为相册数据来源。
- 部署目标为 GitHub Pages；运行时不得依赖开发服务器的路由回退能力。
- 原生桥接不在本期实现范围，未来经适配层接入。

## 模块职责

| 模块 | 职责与状态归属 |
| --- | --- |
| app | 入口、路由、模块装配和全局生命周期 |
| albums | 相册列表与详情呈现，发送打开媒体的操作 |
| media-viewer | 媒体呈现、焦点、手势、键盘、控制栏显隐、字幕轨与全屏；把用户操作转发为命令，不持有业务状态 |
| playback | 播放领域唯一所有者：媒体队列、当前媒体、播放意图、实际状态、连续播放、进度与 ended 推进 |
| content | 配置读取、校验、规范化、排序和内容模型 |
| themes | 三套主题模式的语义 CSS 变量、`data-theme` 切换与偏好持久化 |
| shared | 无业务流程的基础组件与通用工具 |

模块名称和实际路径在首次实施时确定，可合理调整，但职责与状态必须有唯一归属。

## 依赖与数据流

- app 负责装配，可依赖各模块公开入口；其他模块不反向依赖 app。
- albums 可依赖 content、shared；通过装配层回调请求打开查看器。
- media-viewer 可依赖 playback、content 的公开类型和 shared。
- playback 不依赖 albums 或 media-viewer，目前只导出照片会话纯函数；后续音视频通过注入控制接口接入。
- content 和 themes 可依赖 shared；shared 不依赖业务模块。
- 不允许循环依赖或引用其他模块内部文件。
- 静态 JSON 在构建时校验实际文件，运行时经 content 校验和排序供页面展示；用户操作通过 App 调用 playback 纯函数，更新唯一 Session，再由查看器呈现。

## 资源生命周期

查看器拥有图片与视频 DOM、dialog、焦点、滚动锁、控制栏显隐与字幕轨；内部 div 为全屏目标。playback 提供 openSession/stepSession/setIntent/setStatus/setContinuous/setProgress/handleEnded 等纯函数，App 唯一持有 Session 并把查看器命令转成状态更新。

图片按媒体 ID/src 创建独立加载状态，旧图片回调不会污染当前照片；只预加载相邻下一张。关闭或路由变化时卸载查看器、取消预加载、恢复滚动与焦点并释放自身全屏。

视频播放下调度与播放意图仍归 playback：真实暂停、缓冲、自动播放被拒或解码失败都不改写用户意图；`ended` 按意图推进队列。

## 内容与样式边界

- 源素材由维护者保留在仓库外；发布大图为 public/media 顶层图片，派生缩略图为 public/media/thumbs，二者提交 Git。配置为 src/content/albums.json。
- 构建校验和运行时容错分层，详情见需求文档。
- 模块样式限制在自身作用域；全局样式仅包含基础重置、设计变量及明确的通用规则。
- 主题通过设计变量生效，业务模块不硬编码各主题的完整分支。

## 设计系统边界

Penpot 是视觉、交互、组件状态和响应式契约的设计事实来源；产品行为仍由 requirements 和活动 spec 定义，模块职责与运行时状态仍由 architecture 和 module.md 定义。设计稿不得成为第二套产品或架构文档。

设计变量按 Primitive → Semantic → Component 分层。Primitive 保存主题原始色与基础数值；Semantic 提供跨主题稳定的业务含义；Component 只用于媒体查看器等确有独立契约的共享组件。运行时 `themes` 模块把已确认的 Semantic/Component Token 映射为 CSS 自定义属性，业务模块不消费主题专属 Primitive。

主题是相同语义变量的不同模式，而不是独立业务组件树。主题可替换背景层、插画、边界图形、自然纹理和动效节奏，但不得改变主要控件位置、操作含义或 playback 状态归属。装饰资产必须允许隐藏、裁切或降级，且不阻断内容和控制。

SDD 通过 `designImpact` 区分无设计影响、复用既有设计和更新设计基线。设计更新在实现前完成；实现后再以指定视口和流程核对，不用 Penpot 预览代替运行时浏览器验证。

## 工具与入口

- [技术决策](decisions/0001-frontend-foundation.md)：版本、方案取舍和路径策略。
- `src/main.tsx` → `src/app/index.ts`：应用入口；各模块 index.ts 为公开入口。
- `src/app/router.ts`：Hash 导航；静态网站默认 `/wangleyou/`，SITE_BASE 可覆盖。
- `scripts/validate-content.ts`：配置与本地资源校验，构建前必须通过。
- `scripts/thumbnails.ts`：发布大图生成缩略图。
- `npm run check`、`npm run build`、`npm run test:e2e`：验证入口，使用说明见 README。
- `.github/workflows/check.yml`：独立 push/PR 检查，也提供 workflow_call 供部署复用；自身不发布。
- `.github/workflows/deploy.yml`：main push/手动运行，依次复用检查、构建 dist/、发布 Pages；权限和接口见 [工作流模块](../.github/workflows/module.md)。

## 后续决策关口

尚未实现：自动幻灯片、背景音乐、原生桥接。未完成的产品要求继续保留在需求基线，不作为已实现能力。

## 实施后维护

文档中的真实目录、公开接口和版本需随实现同步；架构决策被替代时保留历史理由并链接新记录。归档记录描述当时变更，不代替本文的当前架构。

最近完成：[相册浏览闭环验证](archive/2026-09-15-foundation-album-browsing/verification.md)。

## SDD 工程保障

`scripts/sdd/` 独立承担 Git 快照读取、变更声明和文档引用校验、src 模块依赖约束；职责见 [工具模块](../scripts/sdd/module.md)，维护流程见 [SDD 指南](sdd.md)。PR CI 提供 SDD policy，既有 check 保留业务验证。远端保护未核实，自动检查不判断需求语义。

## Pages 发布链路

部署工作流已配置为 validate → build → deploy：main 的同一运行提交先经完整应用验证，随后在独立 runner 重新构建原始内容并上传 dist/，最后通过 github-pages environment 发布。build 仅有源码和 Pages 读取权限；deploy 才有 Pages 写入与身份令牌权限。不依赖 Node 服务，不提交构建产物，不增加 gh-pages 分支。

手动运行也限制 main；验证失败或任务跳过时不发布。pages 并发组避免同时部署且不中断正在运行的流程。保留独立检查工作流以维持原有 PR 状态检查名称，因此 main push 有重复验证开销，命令定义仍唯一。

用户截图已显示 Pages Source=GitHub Actions。远端 artifact、环境权限和线上访问尚待提交合并后验证；本地配置验收不代表已经上线。首次操作、路径变更和回退见 [README](../README.md#首次部署)。
