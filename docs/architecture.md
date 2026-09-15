# 总架构

## 状态与阅读方式

截至 2026-09-15，工程基础和手动照片浏览已实现，首个里程碑已通过本地验收并归档。技术栈为 React + TypeScript + Vite，npm 管理依赖。自动幻灯片、视频/音乐协调、多主题切换与原生桥接尚未实现。

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
| media-viewer | 媒体呈现、焦点、手势、键盘、全屏；将用户操作交给 playback |
| playback | 已实现照片队列和当前索引的纯状态函数；播放意图、计时器及音视频协调为后续目标 |
| content | 配置读取、校验、规范化、排序和内容模型 |
| themes | 已实现默认主题变量；主题偏好和切换为后续目标 |
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

查看器拥有图片 DOM、dialog、焦点与滚动锁；内部 div 为全屏目标。playback 提供 openSession/stepSession，App 唯一持有 Session；目前没有计时器、音频元素或媒体控制适配器。

图片按媒体 ID/src 创建独立加载状态，旧图片回调不会污染当前照片；只预加载相邻下一张。关闭或路由变化时卸载查看器、取消预加载、恢复滚动与焦点并释放自身全屏。

后续加入音视频后，调度与播放意图仍归 playback，视图不复制状态；具体恢复规则见需求文档。

## 内容与样式边界

- 源素材由维护者保留在仓库外；发布大图为 public/media 顶层图片，派生缩略图为 public/media/thumbs，二者提交 Git。配置为 src/content/albums.json。
- 构建校验和运行时容错分层，详情见需求文档。
- 模块样式限制在自身作用域；全局样式仅包含基础重置、设计变量及明确的通用规则。
- 主题通过设计变量生效，业务模块不硬编码各主题的完整分支。

## 工具与入口

- [技术决策](decisions/0001-frontend-foundation.md)：版本、方案取舍和路径策略。
- `src/main.tsx` → `src/app/index.ts`：应用入口；各模块 index.ts 为公开入口。
- `src/app/router.ts`：Hash 导航；静态网站默认 `/wangleyou/`，SITE_BASE 可覆盖。
- `scripts/validate-content.ts`：配置与本地资源校验，构建前必须通过。
- `scripts/thumbnails.ts`：发布大图生成缩略图。
- `npm run check`、`npm run build`、`npm run test:e2e`：验证入口，使用说明见 README。
- `.github/workflows/check.yml`：CI 检查，不发布。

## 后续决策关口

实现播放里程碑前，明确支持的媒体格式、视频封面维护及播放状态机；实现主题切换前，定义主题偏好与降级规则。未完成的产品要求继续保留在需求基线，不作为本里程碑已实现能力。

## 实施后维护

文档中的真实目录、公开接口和版本需随实现同步；架构决策被替代时保留历史理由并链接新记录。归档记录描述当时变更，不代替本文的当前架构。

最近完成：[相册浏览闭环验证](archive/2026-09-15-foundation-album-browsing/verification.md)。
