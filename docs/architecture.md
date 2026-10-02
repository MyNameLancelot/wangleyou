# 总架构

本文描述当前系统组织、依赖方向和状态归属；产品行为见 [需求基线](requirements.md)，操作命令见 [README](../README.md)，开发规则见 [AGENTS](../AGENTS.md) 与 [SDD 指南](sdd.md)。

## 系统边界与状态

网站是 React + TypeScript + Vite 静态应用，发布到 Cloudflare Pages 根路径与 GitHub Pages `/wangleyou/`。源码、内容配置和原始素材由仓库维护，运行时没有后端、数据库、登录或在线内容管理服务。

唯一主题为 `src/themes/book`，包含线缝相册首页、留影、相册索引与详情。`media-viewer` 是独立共用查看器，主题仅挂载。背景音乐的状态、组件和资产仍在，但当前不挂载音频 UI 或 audio 元素。

`native/ios` 和 `native/android` 是独立系统 WebView 工程，加载 Cloudflare 生产网站；包内不含网站产物或家庭媒体，Android 另带本地开屏视频。Android 构建和模拟器有历史证据，v1.0.11 已获用户真机试用通过反馈，设备与专项矩阵未逐项记录；iOS 完整 Xcode 构建、签名和设备验收未完成，已按用户决定暂缓。已合并的原生实施记录已退役；未验证范围与 iOS 暂缓状态见 [原生交付状态](requirements.md#交付状态与验收)。

## 模块与依赖

| 模块与详细契约 | 职责 | 允许的跨模块依赖 |
| --- | --- | --- |
| [app](../src/app/module.md) | Hash 路由、装配、标题/网络状态、会话与音乐状态实例 | albums、content、playback、themes、media-viewer、shared |
| [albums](../src/albums/module.md) | 首页主回忆队列、手势、计时器的无 UI 契约 | content |
| [content](../src/content/module.md) | 内容类型与校验、索引消费、媒体 URL | 无（结构检查允许 shared） |
| [playback](../src/playback/module.md) | 查看器和保留音乐能力的纯业务状态机 | content、shared |
| [media-viewer](../src/media-viewer/module.md) | 受控 lightbox、媒体 DOM、事件转命令、焦点与滚动锁 | content、playback、shared |
| [themes](../src/themes/module.md) | book 页面、样式、装饰和资产，挂载查看器 | content、albums、playback、media-viewer、shared |
| [shared](../src/shared/module.md) | 跨模块无 UI 类型，当前为 Route | 无 |
| [native/ios](../native/ios/module.md) | WKWebView、导航限制、加载/错误与 Xcode 工程 | 系统平台；运行时加载网站 |
| [native/android](../native/android/module.md) | WebView、返回/全屏、开屏、安全区与 Gradle 工程 | 系统平台；运行时加载网站 |

`src/main.tsx` 经 `src/app/index.ts` 启动应用。跨模块只使用 `index.ts` 公开入口，业务模块不反向依赖 app，禁止循环和跨模块内部引用。shared 不承载业务流程。页面 UI、CSS 和主题资产归 book；查看器样式与功能归 media-viewer，主题不得覆盖或复制。详细输入输出和主要文件由各 module.md 维护。

## 内容管线与路径

| 层 | 位置 | 归属 |
| --- | --- | --- |
| 源素材与配置 | `media-source/YYYY-MM-sequenceNN-相册名/`、`media-source/home-memory.json` | 提交仓库，不作为站点资源发布 |
| 派生媒体 | 同名 `public/media/<相册目录>/` | 构建生成，不提交 Git |
| 生成内容 | `src/content/generated-photo-index.json`（包含 content 与 homeMemory） | 生成器维护，不手写 |
| 派生缓存 | `.cache/media-variants/manifest.json` 与派生文件 | 本地/CI 复用，可从源素材重建 |
| 主题资产 | `public/media/themes/book/` | 主题静态资产，不进入相册配置 |

照片、视频和封面源图在相册目录同一层。`scripts/generate-media.ts` 先消费内存目录扫描结果，再派生和校验媒体；缓存与索引完整暂存后以索引作为最后提交点，提交失败恢复旧缓存，成功后才清理旧产物；`scripts/generate-photo-index.ts` 解析目录、meta、寄语和显式主回忆，`scripts/validate-content.ts` 检查发布文件与视频体积。构建和开发均先运行该管线。

- 相册索引按目录年月/序号降序；留影页另按年份降序、同年月份/序号升序分组。媒体统一按 `topNN` 编号优先、其余文件名自然序排序；运行时不重新排序媒体。首页使用单独的显式数组。内容字段和错误规则见需求与 content 契约。
- sharp 按源内容哈希、编码配置和输出布局版本增量生成 480/960/1600/2560 宽 WebP（不放大、清 EXIF，源宽不足 480px 时保留源宽候选），索引写实际尺寸、最大候选 `src` 与 `srcSet`。原图不进入 dist；缓存结构、路径和尺寸须校验，生成目录拒绝链接逃逸，各项编码/复制临时文件后替换，失败不沿输出链接改写源素材。旧产物只按可信清单在发布成功后清理；派生或提交失败只回收本轮新建文件，不删除已有发布文件。
- MP4 按内容哈希复制为 `<文件名>.<哈希12>.mp4`，存在则跳过。可选同名封面源图走同一 WebP 派生器；缺失则用 sharp 生成版本化 16:9 中立占位封面。索引始终含 `poster`、`posterSrcSet` 和封面尺寸；清单的 `entries`（占位封面带 `#poster` 键）和 `videos` 管理失效产物。
- 构建不解码/抽帧/转码视频，不引入 ffmpeg/ffprobe；离线 MP4 形态及 100/200 MB 校验阈值见需求与 README。源图/视频字节变化后须清理旧哈希产物。
- 相册详情采用 `react-photo-album` Masonry，列数、间距和 `sizes` 使用默认计算，`padding={8}` 参与相框列宽计算；主题不自行覆盖 sizes。

`content.mediaUrl()` 是所有图片、视频、封面和音乐的唯一媒体 URL 入口：优先构建期 `VITE_MEDIA_BASE_URL`，未设置则用 Vite `BASE_URL`；校验安全相对路径并逐段编码。主题不得自行拼接 CDN。当前两处生产构建不设媒体前缀，媒体分别与站点同源。

页面 base 由 `SITE_BASE` 配置，GitHub 为 `/wangleyou/`，Cloudflare 为 `/`；路由使用 Hash，媒体前缀不改变页面 base 或路由。静态路径/刷新/子路径必须在构建产物中验证。

## 状态与资源生命周期

| 所有者 | 状态/资源 | 失效与清理 |
| --- | --- | --- |
| app | 路由、online、Session 与 BackgroundMusic 实例，hash/网络监听 | 改路由关闭 Session，卸载解绑监听；状态转换交 playback |
| playback | 当前媒体、队列、意图、实际状态/进度、可见性/待主动恢复、音乐偏好及临时暂停 | 同步纯函数，无 DOM/计时器；视频结束不推进，旧回调来源须匹配当前会话 |
| media-viewer / lightbox 库 | 受控 open/index、portal、video、焦点、inert、滚动锁与插件计时 | 观察当前 DOM 身份，延迟挂载和同项替换重绑；换项解绑 video 监听并失效旧播放请求；卸载释放 DOM/媒体、恢复滚动和焦点；Slideshow 计时由插件管理 |
| book 首页 / albums 控制器 | 局部纸页、用户暂停、交互/可见性、翻页帧与 interval | 条件失效清 interval，回前台不自动恢复；翻页锁重入，完成提交索引，卸载取消动画帧 |
| book 音频组件（停用） | 若挂载才创建 audio 和监听 | 当前不挂载；重新启用先确认交互与音乐协调 |
| 原生容器 | WebView、加载/错误状态、Android 视频纹理/播放器、加载光条 | 按平台生命周期暂停/释放，网站业务会话仍归网页 |

App 向查看器提供命令，主题在 Session 存在时挂载共用组件。查看器的 `view` 事件转 `stepSessionTo`，原生 video 的播放/等待/进度/结束/错误事件转 playback 命令，播放请求被拒时回报其发起队列与索引。hidden 通过插件 ref 暂停幻灯片，并使旧视频播放请求失效；回前台由 Session 的 resumeRequired 保持暂停，主动原生播放或可见时换项再继续。查看器不复制业务索引；局部缩略图/全屏 UI 状态不属于 playback。

共用查看器使用 Captions、Fullscreen、Slideshow、Thumbnails、Video、Zoom。非循环、背景关闭、工具栏裁剪、寄语与缩略图收起条、全屏和 Tab 回绕契约详见 media-viewer；其焦点环固定白色，不读取主题变量。插件幻灯片需用户显式启动，视频 ended 不推进。首页翻页由 SVG 曲线/裁切/渐变及 requestAnimationFrame 实现，与查看器会话独立。

原生壳仅允许 Cloudflare HTTPS 根路径作为顶层页面，Hash 导航留在 WebView，外部 HTTPS 用户链接交系统浏览器；媒体子资源按页面地址加载，不做原生 URL 替换，无 JS 桥接。返回、加载失败与开屏生命周期由原生 module.md 维护。

## 构建、部署与演进

- 工程基础与 Hash 路由依据 [ADR 0001](decisions/0001-frontend-foundation.md)；当前技术取舍索引见 [decisions](decisions/README.md)。
- [网站工作流](../.github/workflows/module.md)：`check.yml` 校验 push/PR；`deploy.yml` 从 main 部署 GitHub Pages；Cloudflare Git 集成也从 main 构建。原生 `native.yml` 仅手动执行无凭据构建，不上传安装包。
- 原生签名包由维护者本机生成，分发需用户授权；v1.0.10 稳定家庭包与 v1.0.11 家庭签名测试包的交付地址和安装步骤由 README 维护。v1.0.11 测试包来自本地工作区，含错误遮罩可访问性修复；原生修复源码由本次 PR 提供，网页修复未部署。iOS 尚无 IPA，不把源码或静态检查当作设备交付。
- 通常运行 `npm run check`、`npm run build`、相关 `npm run test:e2e`；按实际影响选择，SDD 差异检查不能替代行为验收。

媒体存储迁移尚未实施。以下是本项目重新评估的触发条件：派生产物约超过 500 MB、仓库逼近 1 GB、流量接近实际托管额度，或需要入库超过普通 Git 单文件上限的视频。触发时核实平台当前限制、测量实际规模，再由用户决定继续现有同源 Pages，或迁往对象存储并设置媒体前缀；不得把服务历史免费额度当成长期保证。

派生资源不提交 Git，因此只读取 Git 文件的 CDN 无法提供完整发布资源，不适合作为当前媒体前缀。若迁移对象存储，须先确认费用、上传归属、CORS、Range、缓存和 WebView 子资源验证，形成新的 ADR。原生桥接、离线媒体库及重新启用音乐均不预建空模块，获得明确需求后再演进。
