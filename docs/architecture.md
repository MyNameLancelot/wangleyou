# 总架构

## 状态与阅读方式

截至 2026-09-19，工程基础、两段整屏首页与本地主回忆、照片与视频浏览、连续播放、两套隔离主题应用与设计系统基线已实现。技术栈为 React + TypeScript + Vite，npm 管理依赖。查看器自动幻灯片、背景音乐与原生桥接尚未实现；主题隔离与首页交互的浏览器验收以活动变更验证记录为准。

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
| albums | 首页两段导航与主回忆的无 UI 纯交互契约 |
| themes | 主题偏好与主题入口契约；每个主题目录拥有独立的首页、悬浮主题开关、相册和查看器 UI |
| playback | 播放领域唯一所有者：媒体队列、当前媒体、播放意图、实际状态、连续播放、进度与 ended 推进 |
| content | 配置读取、校验、规范化、排序和内容模型 |

模块名称和实际路径在首次实施时确定，可合理调整，但职责与状态必须有唯一归属。

## 依赖与数据流

- app 负责装配，可依赖各模块公开入口；其他模块不反向依赖 app。
- themes 的各主题 UI 只能依赖 content、playback、router、albums 的无 UI 公开入口与 themes 契约；主题间不得导入，且不得导入共享 React UI。
- playback 不依赖 albums 或主题 UI，媒体事件由各主题查看器通过命令契约接入。
- content 不依赖业务模块；themes 只依赖 app 路由类型及 content、albums、playback 的公开无 UI 契约。
- 不允许循环依赖或引用其他模块内部文件。
- 静态 JSON 在构建时校验实际文件，运行时经 content 校验和排序供页面展示；用户操作通过 App 调用 playback 纯函数，更新唯一 Session，再由查看器呈现。

## 资源生命周期

查看器拥有图片与视频 DOM、dialog、焦点、滚动锁、控制栏显隐与字幕轨；内部 div 为全屏目标。playback 提供 openSession/stepSession/setIntent/setStatus/setContinuous/setProgress/handleEnded 等纯函数，App 唯一持有 Session 并把查看器命令转成状态更新。

图片按媒体 ID/src 创建独立加载状态，旧图片回调不会污染当前照片；只预加载相邻下一张。关闭或路由变化时卸载查看器、取消预加载、恢复滚动与焦点并释放自身全屏。

视频播放下调度与播放意图仍归 playback：真实暂停、缓冲、自动播放被拒或解码失败都不改写用户意图；`ended` 按意图推进队列。

首页的段、照片索引、暂停意图、可见性、输入累积、切屏锁和手势起点均是当前主题 HomePage 的短生命周期本地状态，状态推进规则来自 albums 的无 UI 纯契约。它使用独立的 interval 控制器：只在主回忆段活动、页面可见、未暂停、队列非空且查看器关闭时调度；依赖失效和组件卸载均清理 interval，切屏锁的 timeout 同样由主题 HomePage 清理。该计时器不属于 playback，也不会恢复或改写查看器会话。

## 内容与样式边界

- 源素材由维护者保留在仓库外；发布大图为 public/media 顶层图片，派生缩略图为 public/media/thumbs，二者提交 Git。配置为 src/content/albums.json。
- 构建校验和运行时容错分层，详情见需求文档。
- 主题样式、资产和 React UI 限定在各主题目录；全局样式仅包含基础重置与可访问性通用规则。
- 首页使用 `100dvh`、scroll snap 与 `color-mix()`；海边首屏由 `react-liquid-glass-svg` 提供 SVG 折射和模糊增强，不支持时由海边主题 CSS 回退到不透明玻璃底色；`prefers-reduced-motion` 取消卡片与照片非必要动效。兼容性结论必须来自实际浏览器验证，不能由代码存在推断。

## 设计系统边界

产品行为、视觉与交互要求由 requirements、用户最新口述和活动 spec 定义；模块职责与运行时状态由 architecture 和 module.md 定义。不维护外部设计稿作为事实来源。

主题是互不依赖的独立 UI 应用，而不是共享组件树的换肤模式。允许共享纯类型和交互算法，以保证操作含义、路由和 playback 状态归属一致；禁止共享 JSX、CSS、主题资产和主题间导入。装饰资产必须允许隐藏、裁切或降级，且不阻断内容和控制。

用户可见特效首先选择维护活跃的轻量第三方依赖；变更规格记录体积、依赖、许可、兼容回退和无障碍影响。海边玻璃使用 `react-liquid-glass-svg`（不使用其白色高光边），其 SVG 折射在不支持时降级为可读玻璃；两套主题的循环图标使用按需引入的 `lucide-react`（ISC，内联 SVG，无字体或网络依赖）。

SDD 根据实际行为与架构影响选择 full 或 light。新增或改变用户可见交互时，实施前在规格中记录用户确认的要求，并在指定视口和流程中以运行时浏览器验证。

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
