# 总架构

## 当前状态

网站是部署在 GitHub Pages 的 React + TypeScript + Vite 静态应用。它提供两段首页、相册与全部影像浏览、媒体查看器、背景音乐，以及海边和草原两套隔离主题。媒体和内容配置均由仓库维护；没有后端、数据库、登录或运行时内容管理服务。

产品行为见 [requirements.md](requirements.md)，开发与检查约定见 [AGENTS.md](../AGENTS.md) 和 [SDD 指南](sdd.md)。本文只描述当前模块边界和运行时归属。

## 模块

| 模块 | 职责 |
| --- | --- |
| app | 应用入口、Hash 路由、模块装配和全局生命周期。 |
| albums | 首页两段切换与主回忆的无 UI 交互契约。 |
| content | 内容模型、排序、校验、生成索引及媒体 URL 解析。 |
| playback | 查看器会话和背景音乐的唯一业务状态所有者。 |
| themes | 主题偏好与两个相互隔离的主题应用。 |
| shared | 跨模块复用的无 UI 类型契约。 |

`app` 可以装配其他模块；业务模块不得反向依赖 `app`。主题只能使用其他模块的公开无 UI 入口，两个主题之间不得导入 JSX、CSS 或主题资产。模块内部文件不作为跨模块接口。

## 内容与媒体

- 相册照片位于 `public/media/photos/YYYY-MM-sequenceNN-相册名/`；每个目录的 `meta.json` 用 `album` 段描述相册本身（标题、日期、说明），用 `photos` 数组按展示顺序列出照片元信息；`meta.json` 和 `home-memory.json` 在构建期生成 `src/content/generated-photo-index.json`。
- 主题私有的首屏图、第二屏背景和音乐位于 `public/media/themes/<主题>/`，只由所属主题使用。
- 内容配置只保存 `media/...` 相对路径。`content.mediaUrl()` 是图片、视频、海报、字幕和音乐的唯一 URL 入口：构建期优先使用 `VITE_MEDIA_BASE_URL`，未设置时回退 Vite `BASE_URL`。它拒绝协议、绝对路径、反斜杠、查询、片段和目录穿越，并对每段路径编码。
- 页面 base 保持 `/wangleyou/`，路由继续使用 Hash；媒体 CDN 不改变二者。

构建前的 `scripts/generate-photo-index.ts` 和 `scripts/validate-content.ts` 分别生成索引、校验配置及本地发布资源。运行时网络错误由页面内反馈处理，不让应用白屏。

## 状态与资源生命周期

`App` 唯一持有 playback 会话。查看器负责其 DOM、dialog、焦点恢复、滚动锁、全屏和媒体元素；关闭、路由变化或卸载时释放这些资源。`playback` 负责当前媒体、用户播放意图、实际状态、连续播放和视频结束后的推进，旧媒体的异步事件不得回写新会话。

首页主回忆是主题页面的短生命周期状态：只在第二屏活动、页面可见、照片数足够且未被用户或交互状态暂停时计时；离开页面、打开查看器或卸载时清理计时器。它不改变查看器会话。

背景音乐的意图、实际状态、音量和“回前台待恢复”状态属于 playback；每个主题仅持有一个 audio DOM。页面隐藏会暂停，回到前台不自动恢复；两个首页入口只投影同一份状态。主题和查看器卸载时清理音频、视频、监听器与计时器。

## 主题与样式

海边和草原是完整、互不依赖的主题应用，各自维护页面、查看器、样式、装饰和资源引用。主题只共享路由、内容和播放等无 UI 契约。装饰必须 `aria-hidden`、不拦截操作，并在不支持增强效果或减少动态时可读可用。

主题开关和音乐入口属于各自页面，不使用 `fixed` 或 `sticky`；可点击区域至少为 44px。主题偏好和背景音乐偏好可保存到 `localStorage`，存储不可用时静默降级。

## 工具与部署

- [前端基础决策](decisions/0001-frontend-foundation.md)：技术栈和静态路径策略。
- `src/main.tsx` → `src/app/index.ts`：应用入口；各模块 `index.ts` 是公开入口。
- `npm run check`、`npm run build`、`npm run test:e2e`：本地验证入口。
- `.github/workflows/check.yml`：push 和 PR 的检查；`.github/workflows/deploy.yml`：main 的 Pages 发布，详见 [工作流模块](../.github/workflows/module.md)。

查看器自动照片幻灯片和原生桥接不在当前交付范围；若实现，先更新需求、模块契约和相应验证。
