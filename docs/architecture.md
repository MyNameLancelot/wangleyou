# 总架构

## 当前状态

网站是部署在 GitHub Pages 的 React + TypeScript + Vite 静态应用。它提供线缝相册单页首页、相册与全部影像浏览、媒体查看器，以及唯一相册主题；背景音乐能力保留但当前停用。媒体和内容配置均由仓库维护；没有后端、数据库、登录或运行时内容管理服务。

`native/ios` 和 `native/android` 是独立的原生容器工程，运行时仅把现有 HTTPS 生产网站载入系统 WebView。原生包不含网站构建产物或家庭相册媒体；Android 包内有本地开屏视频，无首尾静帧。Android 构建与家庭签名 APK 已验证，真机逐项验收待补录；iOS 构建和验收受完整 Xcode 与签名资料限制，用户已决定暂缓安装。

产品行为见 [requirements.md](requirements.md)，开发与检查约定见 [AGENTS.md](../AGENTS.md) 和 [SDD 指南](sdd.md)。本文只描述当前模块边界和运行时归属。

## 模块

| 模块 | 职责 |
| --- | --- |
| app | 应用入口、Hash 路由、模块装配和全局生命周期。 |
| albums | 首页主回忆、横向手势与计时器的无 UI 交互契约。 |
| content | 内容模型、排序、校验、生成索引及媒体 URL 解析。 |
| media-viewer | 全站共用的媒体查看器：受控渲染 lightbox、把库事件翻译成 playback 命令；样式与功能不可按主题定制。 |
| playback | 查看器会话和背景音乐的唯一业务状态所有者。 |
| themes | 唯一相册主题应用及其页面 UI、样式和静态资产。 |
| shared | 跨模块复用的无 UI 类型契约。 |
| native/ios | iPhone/iPad 的 WKWebView、导航白名单、加载和错误状态及原生工程。 |
| native/android | Android WebView、导航白名单、系统返回、视频全屏、加载和错误状态及 Gradle 工程。 |

`app` 可以装配其他模块；业务模块不得反向依赖 `app`。主题只能使用其他模块的公开入口；除共用 media-viewer 外，主题 UI 均位于 book 目录。模块内部文件不作为跨模块接口。

## 内容与媒体

- 相册原始素材位于 `media-source/YYYY-MM-sequenceNN-相册名/`（照片、视频与 `<视频同名>.poster.jpg` 封面源素材共用同一层结构），构建期生成不提交的 `public/media/YYYY-MM-sequenceNN-相册名/` 派生资源。生成器按原图内容哈希与编码配置（含派生输出布局版本）缓存，写入实际尺寸、最大 WebP `src` 与 `srcSet`，以及相册元信息（`title`、`date`、`description`、可选 `opening`）到 `src/content/generated-photo-index.json`；原图不会进入 `dist`。
- 视频在同一目录发布：源文件按内容哈希复制为 `<文件名>.<哈希12>.mp4`，目标存在即跳过复制；封面走与照片相同的 480/960/1600/2560 WebP 派生——有 `<视频同名>.poster.jpg` 就派生真实帧，没有则由构建期渲染一张中立占位底纹（16:9、`video-poster-placeholder-v1`，占位版本提升即重新生成），索引里始终写入 `poster`、`posterSrcSet` 与对应 `width`/`height`。构建期不转码、不抽帧、不引入 ffmpeg/ffprobe：只接受 `.mp4`，>100 MB 警告、>200 MB 失败。源→产物映射记录在 `.cache/media-variants/manifest.json` 的 `entries`（含 `${视频源路径}#poster` 占位条目）与 `videos` 段，用于清理旧产物。
- 相册主题的浏览头图与保留的背景音乐资产位于 `public/media/themes/book/`；当前只引用浏览头图，不加载音乐。
- 内容配置只保存 `media/...` 相对路径。`content.mediaUrl()` 是图片、视频、视频封面和音乐的唯一 URL 入口：构建期优先使用 `VITE_MEDIA_BASE_URL`，未设置时回退 Vite `BASE_URL`。它拒绝协议、绝对路径、反斜杠、查询、片段和目录穿越，并对每段路径编码。
- 页面 base 保持 `/wangleyou/`，路由继续使用 Hash。生产构建不设置 `VITE_MEDIA_BASE_URL`，媒体与页面同源，由 GitHub Pages 从构建产物分发；该变量只用于临时镜像或未来迁移，且不改变页面 base 与 Hash 路由。

构建前的 `scripts/generate-photo-index.ts`（扫描目录并生成含视频的内容索引）、`scripts/generate-media.ts`（派生 WebP 与按内容哈希发布视频）和 `scripts/validate-content.ts`（校验配置、发布资源存在性、视频扩展名与体积基线）共同构成内容管线。运行时网络错误由页面内反馈处理，不让应用白屏。

## 媒体托管与演进

媒体与页面同源：GitHub Pages 自身经边缘节点分发并支持 Range 请求，图片、视频、封面、主题图与背景音乐都已经走 CDN，不再叠一层。2026-09-24 实测线上首页与媒体响应均含 `server: GitHub.com`、`x-github-edge-region` 与 `accept-ranges: bytes`，缓存头是固定的 `cache-control: max-age=600`。

派生 WebP 与视频产物在构建期生成、不提交仓库，只读取 Git 仓库文件的 CDN（例如 jsDelivr 的 `gh/<owner>/<repo>@<ref>` 形式）拿不到这些文件，也受 GitHub 来源单文件 20 MB 限制，因此不作为媒体前缀。

媒体托管升级是未决事项，尚未实施；满足任一触发条件时重新评估，取得用户确认后再实施：

- 派生媒体与站点总量超过约 500 MB，或仓库逼近 1 GB 推荐上限。
- 月度流量接近 GitHub Pages 的 100 GB 软限制。
- 需要发布超过 100 MiB 的视频（普通 Git 推送会阻止这种文件）。

候选路径：

1. 保留 Pages 作为源站，绑定自定义域并在前面加一层 Cloudflare 代理缓存；媒体 URL 结构不变，只换域名，需要处理 SSL 模式与可能的重定向。
2. 把媒体迁到对象存储（例如 Cloudflare R2 免费额度为 10 GB-month 存储、每月 100 万次 Class A 与 1000 万次 Class B 操作，出站流量不计费），绑定自定义域后由构建或维护者上传，并把 `VITE_MEDIA_BASE_URL` 指向该域；需要同时确认 CORS、Range 与原生壳的子资源加载。

两条路径都引入站外服务，实施前必须按 [requirements.md](requirements.md) 的技术与部署约束取得用户明确同意，并补齐新的决策记录与验证方式。

## 状态与资源生命周期

`App` 唯一持有 playback 会话并把命令交给主题，主题只负责在会话存在时挂载共用查看器。查看器归 `media-viewer` 模块：受控渲染 `open`/`index`，把库的 `view` 事件翻译成 `stepSessionTo`，把原生 video 事件翻译成状态、进度与结束命令，并按 `intent` 在打开视频时尝试播放；它负责 DOM、焦点恢复、滚动锁与媒体元素，关闭、路由变化或卸载时解绑 video 监听并释放媒体元素。查看器不保存索引副本，主题不得覆盖其样式或功能，也不得复制第二份实现。`playback` 负责当前媒体、用户播放意图、实际状态与进度；视频结束停留当前项，只有用户命令可以推进队列，旧媒体的异步事件不得回写新会话。

共用查看器自带键盘契约：库把其余页面标记为 inert，焦点越过最后一个控件会落到浏览器 chrome 上使按键失效，因此它在边界把 Tab 回绕到查看器内部；Esc、方向键、首尾禁用（不循环）、缩略图带与触摸滑动沿用库默认行为，焦点环固定为白色、不随主题变化。

首页主回忆是 book 页面短生命周期状态：照片数加一张收束页形成非循环队列；页面可见、仍有下一页且未被用户或交互状态暂停时计时，到末页停止。每翻一页，右侧实体页层数随进度变化；翻页期间锁定重复动作，PageTurn 完成后通知首页提交回翻索引并释放锁，卸载时取消动画帧。页面隐藏、打开查看器或卸载时清理 interval。它不改变查看器会话。

背景音乐的意图、实际状态、音量和“回前台待恢复”状态属于 playback；book 保留音频组件及资产，但当前不挂载，因此无音乐入口或 audio DOM，也不会尝试播放。共用查看器仍按自身生命周期清理视频、监听器与计时器。

## 主题与样式

`src/themes/book` 是唯一主题，沿用 Android 酒红相册开屏与图标的奶油纸页、酒红封边和线缝装订。首页展示横向 3:2 层叠内页，照片随页轻微倾斜；桌面有明确控制，手机标题分行，以左右手滑和点击照片操作。主题局部 PageTurn 使用 SVG 曲线、裁切和渐变表现内页范围内的卷页，正反向共用同一几何轨迹，减少动态效果下直接切换。装饰均不拦截操作。主题切换状态、入口与偏好存储均已移除。

浏览、相册页面复用现有内容和交互契约，但使用 book 的配色、字体和资产。共用查看器保持独立，主题仅挂载，不能覆盖其样式或复制实现。音乐状态能力仍由 playback 保留，但当前 UI 不使用。

## 工具与部署

- [前端基础决策](decisions/0001-frontend-foundation.md)：技术栈和静态路径策略。
- `src/main.tsx` → `src/app/index.ts`：应用入口；各模块 `index.ts` 是公开入口。
- `npm run check`、`npm run build`、`npm run test:e2e`：本地验证入口。
- `.github/workflows/check.yml`：push 和 PR 的检查；`.github/workflows/deploy.yml`：main 的 Pages 发布，详见 [工作流模块](../.github/workflows/module.md)。
- `.github/workflows/native.yml`：仅手动执行原生无凭据构建，不上传安装包；Android 签名 APK 与 iOS Ad Hoc IPA 由维护者在本机签名并私下传递。

查看器幻灯片只在用户点击工具栏按钮后运行；视频自然结束不自动推进。原生壳不持有查看器业务状态。原生桥接不在当前交付范围；若实现，先更新需求、模块契约和相应验证。
