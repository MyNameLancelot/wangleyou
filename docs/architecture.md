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
| media-viewer | 全站共用的媒体查看器：受控渲染 lightbox、把库事件翻译成 playback 命令；样式与功能不可按主题定制。 |
| playback | 查看器会话和背景音乐的唯一业务状态所有者。 |
| themes | 主题偏好与两个相互隔离的主题应用。 |
| shared | 跨模块复用的无 UI 类型契约。 |

`app` 可以装配其他模块；业务模块不得反向依赖 `app`。主题只能使用其他模块的公开无 UI 入口，两个主题之间不得导入 JSX、CSS 或主题资产。模块内部文件不作为跨模块接口。

## 内容与媒体

- 相册原始素材位于 `media-source/YYYY-MM-sequenceNN-相册名/`（照片、视频与 `<视频同名>.poster.jpg` 封面源素材共用同一层结构），构建期生成不提交的 `public/media/YYYY-MM-sequenceNN-相册名/` 派生资源。生成器按原图内容哈希与编码配置（含派生输出布局版本）缓存，写入实际尺寸、最大 WebP `src` 与 `srcSet` 到 `src/content/generated-photo-index.json`；原图不会进入 `dist`。
- 视频在同一目录发布：源文件按内容哈希复制为 `<文件名>.<哈希12>.mp4`，目标存在即跳过复制；封面走与照片相同的 480/960/1600/2560 WebP 派生——有 `<视频同名>.poster.jpg` 就派生真实帧，没有则由构建期渲染一张中立占位底纹（16:9、`video-poster-placeholder-v1`，占位版本提升即重新生成），索引里始终写入 `poster`、`posterSrcSet` 与对应 `width`/`height`。构建期不转码、不抽帧、不引入 ffmpeg/ffprobe：只接受 `.mp4`，>100 MB 警告、>200 MB 失败。源→产物映射记录在 `.cache/media-variants/manifest.json` 的 `entries`（含 `${视频源路径}#poster` 占位条目）与 `videos` 段，用于清理旧产物。
- 主题私有的首屏图、第二屏背景和音乐位于 `public/media/themes/<主题>/`，只由所属主题使用。
- 内容配置只保存 `media/...` 相对路径。`content.mediaUrl()` 是图片、视频、视频封面和音乐的唯一 URL 入口：构建期优先使用 `VITE_MEDIA_BASE_URL`，未设置时回退 Vite `BASE_URL`。它拒绝协议、绝对路径、反斜杠、查询、片段和目录穿越，并对每段路径编码。
- 页面 base 保持 `/wangleyou/`，路由继续使用 Hash；媒体 CDN 不改变二者。

构建前的 `scripts/generate-photo-index.ts`（扫描目录并生成含视频的内容索引）、`scripts/generate-media.ts`（派生 WebP 与按内容哈希发布视频）和 `scripts/validate-content.ts`（校验配置、发布资源存在性、视频扩展名与体积基线）共同构成内容管线。运行时网络错误由页面内反馈处理，不让应用白屏。

## 状态与资源生命周期

`App` 唯一持有 playback 会话并把命令交给主题，主题只负责在会话存在时挂载共用查看器。查看器归 `media-viewer` 模块：受控渲染 `open`/`index`，把库的 `view` 事件翻译成 `stepSessionTo`，把原生 video 事件翻译成状态、进度与结束命令，并按 `intent` 在打开视频时尝试播放；它负责 DOM、焦点恢复、滚动锁与媒体元素，关闭、路由变化或卸载时解绑 video 监听并释放媒体元素。查看器不保存索引副本，主题不得覆盖其样式或功能，也不得复制第二份实现。`playback` 负责当前媒体、用户播放意图、实际状态与进度；视频结束停留当前项，只有用户命令可以推进队列，旧媒体的异步事件不得回写新会话。

共用查看器自带键盘契约：库把其余页面标记为 inert，焦点越过最后一个控件会落到浏览器 chrome 上使按键失效，因此它在边界把 Tab 回绕到查看器内部；Esc、方向键、首尾禁用（不循环）、缩略图带与触摸滑动沿用库默认行为，焦点环固定为白色、不随主题变化。

首页主回忆是主题页面的短生命周期状态：只在第二屏活动、页面可见、照片数足够且未被用户或交互状态暂停时计时；离开页面、打开查看器或卸载时清理计时器。它不改变查看器会话。

背景音乐的意图、实际状态、音量和“回前台待恢复”状态属于 playback；每个主题仅持有一个 audio DOM。页面隐藏会暂停，回到前台不自动恢复；两个首页入口只投影同一份状态。主题和查看器卸载时清理音频、视频、监听器与计时器。

## 主题与样式

海边和草原是完整、互不依赖的主题应用，各自维护页面、样式、装饰和资源引用；两套主题在会话存在时挂载同一个 `media-viewer` 查看器，不维护主题私有的查看器实现或样式。除这一共用组件外，主题只共享路由、内容和播放等无 UI 契约。装饰必须 `aria-hidden`、不拦截操作，并在不支持增强效果或减少动态时可读可用。

主题开关和音乐入口属于各自页面，不使用 `fixed` 或 `sticky`；可点击区域至少为 44px。共用查看器是库提供的模态层，不提供主题切换入口，背景为不使用媒体素材的纯黑不透明底；照片与视频在同一舞台内呈现，寄语由 captions 插件贴在当前影像左下角。主题偏好和背景音乐偏好可保存到 `localStorage`，存储不可用时静默降级。

## 工具与部署

- [前端基础决策](decisions/0001-frontend-foundation.md)：技术栈和静态路径策略。
- `src/main.tsx` → `src/app/index.ts`：应用入口；各模块 `index.ts` 是公开入口。
- `npm run check`、`npm run build`、`npm run test:e2e`：本地验证入口。
- `.github/workflows/check.yml`：push 和 PR 的检查；`.github/workflows/deploy.yml`：main 的 Pages 发布，详见 [工作流模块](../.github/workflows/module.md)。

查看器幻灯片只在用户点击工具栏按钮后运行；视频自然结束不自动推进。原生桥接不在当前交付范围；若实现，先更新需求、模块契约和相应验证。
