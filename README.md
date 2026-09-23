# 王乐悠 · 成长相册

用相册收藏孩子与家人的生活瞬间。React + TypeScript + Vite 构建，产物是可部署到 GitHub Pages 的静态文件。

## 当前版本

已实现首页、影像浏览（年份分组与类型筛选）、相册索引与详情（照片与视频混排、视频带播放角标）、手动照片查看与视频播放（全站共用查看器：`yet-another-react-lightbox` + Captions/Fullscreen/Slideshow/Thumbnails/Video/Zoom 插件，含原生控制条、键盘与触屏操作）、两套隔离主题（海边沙滩 / 旷野草原）切换与偏好记忆，以及内容校验、缩略图生成与视频按内容哈希发布。查看器不在进入时自动播放幻灯片，视频结束停留当前项。

App 套壳属于后续里程碑。首页背景音乐由海边、草原各自的主题私有资产提供。海边与草原分别拥有完整的页面 UI、CSS、装饰和资产引用，只共享无 UI 的业务与交互契约；查看器是唯一的共用 UI（`src/media-viewer`），主题只挂载它、不能定制其样式或功能。后续页面与交互设计以用户口述和活动规格为准。

仓库含 6 张本地演示照片、2 个非空相册及 1 个空相册。演示素材和日期不代表真实家庭记录，来源见 [素材说明](public/media/SOURCES.md)。

## 本地启动

使用 Node.js 24 和 npm，已验证 Node 24.18.0、npm 11.16.0。版本锁定在 package-lock.json，使用 `npm ci` 安装。

```bash
nvm use
npm ci
npm run dev
```

默认访问 `http://127.0.0.1:5173/wangleyou/`。端口被占用时以终端打印的地址为准。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 本地开发 |
| `npm run dev:lan` | 本地开发并监听局域网（用手机访问同一 Wi-Fi 下的 `http://<电脑内网IP>:5173/wangleyou/` 做真机核对） |
| `npm run generate:media` | 增量生成发布 WebP、尺寸/srcSet 内容索引与本地媒体缓存 |
| `npm run generate:photo-index` | `generate:media` 的兼容别名 |
| `npm run compress:photos` | 离线把照片压成发布规格：长边封顶、统一 JPEG、剥离元数据，不改动源文件 |
| `npm run validate:content` | 检查配置结构、日期、ID 和实际文件 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 内容、路由、照片状态及文件校验单测 |
| `npm run check` | 内容、类型、静态检查和单元测试 |
| `npm run build` | 校验后生成 dist 静态产物 |
| `npm run preview` | 预览构建结果，默认端口 4173 |
| `npm run test:e2e` | 构建产物上的桌面与移动端 Chrome 验收 |

浏览器测试前先 `npm run build`。测试使用 scripts/serve-built.mjs 提供严格静态服务，未知文件返回 404，不做 SPA 回退。需要 Chrome；环境尚未安装时运行 `npx playwright install chrome`。Linux CI 使用 `npx playwright install --with-deps chrome`。报告在 playwright-report，截图/失败 trace 在 test-results，均不提交 Git。

## 添加照片或相册

1. 将原图加入 `media-source/YYYY-MM-sequenceNN-相册名/`；原图会提交 Git，但不会发布到网页。照片与视频共用同一层目录结构。媒体顺序由构建脚本按文件名生成：`top01.jpg`、`top01.mp4` 等 `topNN` 文件按编号排在最前面，其余按文件名自然序（照片与视频共用这一条规则）。
2. 视频放入同一目录，用 H.264 + AAC 的 MP4（faststart）。封面源素材 `<视频同名>.poster.jpg` 是**可选**的真实帧：提供了就派生它，没提供时构建期生成一张中立的占位封面，构建都不会失败；两种情况都会派生 480/960/1600/2560 的 WebP 封面，并按内容哈希把 MP4 发布到 `public/media/<相册目录>/`。扩展名不是 `.mp4` 或体积超限仍会让构建失败。
3. 相册详情页的缩略图由页面按媒体类型叠加播放标识：中间凸起的通透玻璃圆钮 + 灰色实心 Play 图标（`lucide-react`，居中，桌面 38px / 手机 26px）；标识不烘焙进封面资源，所以留影页的层叠封面保持干净。
4. 在目录中编辑 `meta.json`：`album` 段写这一段日子的标题、日期和说明；需要给某几张媒体配寄语时，在 `photos_meta.captions` 里按文件名登记（照片或视频都可，可以只写一部分）。媒体顺序与 ID 不需要登记。
5. 编辑 `media-source/home-memory.json`，显式填写首页主回忆照片及播放顺序。
6. 运行 `npm run check` 和 `npm run build`；命令会自动生成 480/960/1600/2560 宽度的 WebP（照片与视频封面）、按内容哈希发布视频、写入索引并校验资源。未改变的源文件会由 `.cache/media-variants/` 跳过重编码与重复复制；派生目录 `public/media/<相册目录>/` 与缓存均不提交 Git。

相册元信息示例（`meta.json`）：

```json
{
  "album": {
    "title": "周岁",
    "date": "2025-05-23",
    "description": "会走路了，什么都想摸一摸。"
  },
  "photos_meta": {
    "captions": [
      { "fileName": "top01.jpg", "caption": "黄昏把树影拉得很长，我们在这里等天色慢慢暗下来。" }
    ]
  }
}
```

### 配置规则

- 相册目录名必须是 `YYYY-MM-sequenceNN-相册名`（`sequence` 必须小写）；构建期按年月与序列识别相册，年份从新到旧、同一年内按目录的月份与序列排列。
- `meta.json` 的 `album` 段：`title`、`date`、`description` 均可选。`title` 缺省取目录名后缀；`date` 可写 `YYYY-MM` 或完整的 `YYYY-MM-DD`，缺省取目录名的年月；`description` 是留影页与相册卡片上的相册文案，**最多 16 个字符**（含标点），超过会让构建失败——它只会显示在卡片的一行里。
- `meta.json` 的 `photos_meta.captions` 是可选媒体寄语：数组项只允许 `fileName`（目录内真实存在的媒体文件名，照片或视频）与 `caption`，寄语为 1–60 个非空白字符，查看器会把有寄语的画面下方这条文案显示出来。文件名写错、重复登记同一文件、把 `*.poster.jpg` 当作媒体登记、寄语为空或超长都会让构建失败并指出位置。
- 两段以外的键会让构建失败并提示；照片 `id` 仍由文件名生成，顺序为 `topNN` 优先（按编号）、其余按文件名自然序，寄语不改变这个顺序。
- 同一相册内媒体 ID 必须唯一（同名文件或同名照片与视频才会冲突）；相册卡片取展示顺序的前三张可用缩略图做向右上的层叠封面。
- 首页主回忆由 `home-memory.json` 完整且显式定义，不从相册派生。
- 路径相对 public，例如 `media/photo.jpg`。不写 `/wangleyou/` 或 `public/` 前缀，不写外部 URL、查询参数、反斜杠或 `../`。路径由应用的统一媒体 resolver 加前缀。
- 相册封面取展示顺序的前三张可用缩略图（视频用派生封面）；可选尺寸必须为正整数。
- 显式引用文件不存在、配置格式错误、重复 ID 会使校验和构建失败，并指出字段位置。视频还要求 `.mp4` 扩展名与单个文件不超过 200 MB（超过 100 MB 打印警告）；封面源素材可以缺，缺失时构建期生成占位封面。运行时网络失败由查看器给出默认错误状态，用户可手动切换或关闭后重新打开。
- 背景音乐不进入相册内容配置；主题私有资产（首屏图、第二屏背景、背景音乐）统一放在 `public/media/themes/<主题>/`，由对应主题代码引用，来源未确认前仅用于非商业占位。替换真实音乐时同步主题组件、素材说明和许可确认。

### 压缩发布大图

相机原片和演示素材先压成适合网页发布的规格再加入 `public/media/`。这是独立的离线预处理命令，只读输入目录，不参与站点运行时，也不改变任何页面行为。

```bash
npm run compress:photos -- ~/Pictures/trip              # 输出到 ~/Pictures/trip_compressed
npm run compress:photos -- ~/Pictures/trip --out public/media --max-edge 3840 --quality 78
npm run compress:photos -- ~/Pictures/trip --dry-run     # 只扫描并打印计划与预估，不写文件
```

- 默认长边上限 4096（DCI 4K 口径，横竖通用），只按原比例缩小、不放大；需要 UHD 口径时传 `--max-edge 3840`。
- 默认质量 82。同一张图 q100 体积约为 q80 的两倍而画质没有可见收益，因此不建议把默认质量调高。输出一律为 JPEG 且扩展名改为 `.jpg`，编码使用 mozjpeg 与渐进式扫描；透明通道会填成白色背景，动图 GIF 只保留首帧。
- 默认剥离 EXIF/GPS/拍摄时间等全部元数据，需要保留时加 `--keep-exif`；无论是否保留元数据，输出都会先按 EXIF Orientation 摆正。
- 默认输出目录是输入目录同级的 `<输入目录>_compressed`，用 `--out` 覆盖；输出目录不能与输入目录相同，也不能位于输入目录内。路径检查会解析 symlink。递归处理子目录并保留相对结构。可用 `--concurrency` 调整并发（默认 4，上限为 CPU 核数）。
- HEIC/HEIF 先尝试 sharp 直接解码；成功时汇总明确标出。失败后按 `sips`（macOS 自带）→ `heif-convert` → `magick` 顺序探测；三者在当前机器都没有时，该文件计入失败并给出安装建议，也可用 `--heic-via none` 跳过 HEIC。临时 JPEG 写在系统临时目录并自动清理。
- 同一输出目录内多个源文件映射到同一个 `.jpg` 名时（例如 `a.jpg` 与 `a.png` 并存），按路径字典序保留第一个，其余追加 `-2`、`-3`，并在汇总中列出改名结果。
- 重跑会覆盖同名输出文件，不影响输出目录中与本次无关的已有文件；输入目录始终保持只读。结束时打印成功、跳过、失败三类计数、体积节省比例、体积变大与失败清单。
- 退出码：0 全部成功，1 存在处理失败，2 参数或环境错误。完整参数用 `npm run compress:photos -- --help` 查看。

### 视频的离线准备

站点只发布 H.264 + AAC 的 MP4（faststart），构建、CI 与运行时不转码、不抽帧，也不需要 ffmpeg/ffprobe。两步都由维护者离线完成：

1. **转码**：相机或下载素材是 HEVC、`.mov`、`.webm` 等容器时，先用本地工具转成发布形态，例如 `ffmpeg -i in.mov -c:v libx264 -crf 23 -preset medium -c:a aac -b:a 128k -movflags +faststart out.mp4`（HandBrake 等图形工具同样可用）。构建期只接受 `.mp4`，其他扩展名会直接报错。
2. **封面（可选）**：想用真实画面做封面时，手动截取一帧存成 `<视频同名>.poster.jpg` 放进同一相册目录（`weekend-clip.mp4` → `weekend-clip.poster.jpg`），构建期把它派生成 480/960/1600/2560 的 WebP，`video.poster` 指向派生资源。没有提供封面也不会失败：构建期会生成一张中立占位封面（深色底纹、16:9），页面再按媒体类型在缩略图正中叠加玻璃播放标识。演示视频的这一帧用 macOS 自带 `qlmanage -t` 离线抽取后转 JPEG，本项目不把抽帧放进构建流程。

播放标识（玻璃圆钮 + 灰色 Play 图标）由页面按媒体类型生成，不烘焙进封面资源：这样真实封面与占位封面一致、在明暗画面上都清晰、缩略图尺寸变化时仍然锐利，留影页的层叠封面也不会被角标污染。

查看器的工具栏只保留幻灯片与全屏（放大、缩小、关闭按钮全端不渲染），退出靠 Esc 与点击黑色背景；上一项/下一项只在桌面显示，手机与平板改用触摸滑动。缩略图带上方有一条与屏幕同宽的收起条（向下/向上箭头图标），寄语贴在当前影像的左下角。全屏只展示影像，且全屏下键盘方向键与触摸滑动仍可切图。

### 用手机核对本地改动

线上站点只会在 main 更新后重新构建；功能分支上的改动先在手机上验证时，用同一 Wi-Fi 下的局域网开发服务器：

```bash
npm run dev:lan        # 终端会打印 Network: http://<电脑内网IP>:5173/wangleyou/
```

手机浏览器打开该 Network 地址即可（媒体由开发服务器直接提供，不需要先把素材推到远端）。注意：生产构建的媒体前缀是 jsDelivr 上的 `@main`，因此在改动发布前不要用 `npm run preview` 的手机结果判断新素材。

平台能力差异：Android Chrome 支持元素级全屏，图片与视频都能进系统全屏；iPhone Safari 不提供任意元素的全屏 API（只有 `<video>` 能全屏），此时查看器不渲染全屏按钮，影像仍是覆盖视口的黑色沉浸层，想连浏览器地址栏一起隐藏需要“添加到主屏幕”（standalone）或未来的 WebView 套壳。

格式与三端：发布形态只有一种——H.264 + AAC 的 MP4 + faststart。桌面浏览器、移动端浏览器与未来的 WebView 套壳共用同一份视频，不按端生成不同格式；`playsinline` 保证移动端内联播放，弱网优化也是补同一格式的更低码率/分辨率变体，而不是换 WebM/HEVC（那会带来越来越多的兼容分支与额外编码成本）。

体积基线：单个视频 >100 MB 打印警告，>200 MB 构建失败；添加大视频前先评估仓库和 Pages 限制，GitHub 普通推送本身阻止超过 100 MiB 的单文件。

## 静态路径与 GitHub Pages

普通公开仓库可以开启 Pages。本仓库部署成功后的地址为 `https://mynamelancelot.github.io/wangleyou/`。项目使用 Hash 路由，例如 `/wangleyou/#/albums/summer-days`，不依赖服务器重写。

默认构建基础路径 `/wangleyou/`，可覆盖：

```bash
SITE_BASE=/another-repo/ npm run build
SITE_BASE=/another-repo/ npm run preview
```

用户主页或自定义域名根目录使用 `SITE_BASE=/`。构建与预览应使用相同 base。

媒体前缀独立于页面 base。受版本控制的 `.env.production` 让生产构建使用 `https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/`，因此 `media/<相册目录>/a.jpg` 会请求 jsDelivr 中同一仓库 main 分支的 `public/media/<相册目录>/a.jpg`。不要在 JSON 或主题代码写完整 CDN URL；需要临时替换版本或镜像时，在构建命令覆盖：

```bash
VITE_MEDIA_BASE_URL=https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/ npm run build
```

本地 `npm run dev` 未设置该变量时继续从 Vite `BASE_URL` 加载仓库内媒体。该变量只影响图片、视频、视频封面、主题图和背景音乐，不影响 `/wangleyou/`、页面入口或 `#/...` 路由。

### 首次部署

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。用户已提供此设置的截图；不需要选择 Jekyll 或 Static HTML 模板。
2. 默认地址不需要 Custom domain，留空即可；github.io 的 HTTPS 自动启用。
3. 将本部署分支提交、推送，并通过 PR 合并到 `main`。工作流文件必须进入 main 才会自动发布；只推送功能分支不会发布网站。
4. 在 **Actions → Deploy GitHub Pages** 查看 `Validate before deployment → Build Pages artifact → Publish GitHub Pages`。
5. 若 GitHub 要求环境审批，按已有规则审批；在 **Settings → Environments → github-pages** 核实允许 `main` 部署。不要为通过检查而绕过现有审批。
6. 发布成功后打开运行中 `github-pages` 环境给出的链接，核对首页、相册直接链接和刷新、照片原图与缩略图。Pages 设置页也会显示访问地址。

`.github/workflows/deploy.yml` 监听 main 更新，也支持 **Run workflow → Branch: main** 手动重试。选择其他分支会跳过发布。每次先复用 `.github/workflows/check.yml` 运行内容校验、模块结构、类型检查、单元测试、构建和桌面/移动浏览器验证；全部成功才从同一提交重新构建并上传 `dist/`。Node/npm 只用于构建，访客浏览器加载编译后的 HTML/CSS/JS。

check.yml 保留独立 push/PR 检查，因此 main 更新时会看到独立检查和部署内检查两次运行；检查命令只维护一份。`SDD policy` 的完整变更声明门禁在 PR 执行；实际保护规则以仓库 Settings 为准。deploy.yml 不赋予构建任务 Pages 写权限；只有发布任务获得 Pages 写入与身份令牌权限，无需新增 PAT 或 secrets。

发布只上传 dist/，不提交 dist/，不创建 gh-pages 分支。工作流明确设置 `SITE_BASE=/wangleyou/`；若以后绑定根域名或改仓库名，需同步工作流、Vite 默认路径和浏览器验证配置，不只填写 Custom domain。

### 失败处理与回退

- 检查或构建失败：查看第一个失败任务，修复后更新 main；后续上传/发布不会执行。
- Pages 配置失败：确认 Source=GitHub Actions；发布权限/环境错误则检查 job 权限及 github-pages 的分支/审批设置。
- 工作流已在 main 但没有运行：在 Actions 手动运行并选择 main。重跑历史运行会使用该次旧提交；恢复正常发布应运行当前 main。
- 页面能开但资源 404：核对 /wangleyou/ 基础路径、相册媒体配置和真实 Pages 地址。
- 暂停自动发布：在 Actions 禁用 Deploy GitHub Pages。恢复旧版本通过新 PR revert 问题提交，合并 main 后重新验证部署；禁用工作流不会删除已发布网站。

### 状态与容量

仓库已提供部署配置和本地验证；本次配置阶段没有执行远端工作流，首次线上部署及 HTTPS 访问尚待提交合并后验证。职责见 [工作流模块](.github/workflows/module.md)。

截至 2026-09-16，GitHub Pages 发布站点最大 1 GB，源仓库建议不超过 1 GB，每月带宽软限制 100 GB，单次 Pages 部署超过 10 分钟会超时；自定义 Actions 不受默认每小时 10 次构建软限制约束。[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

普通 Git 推送会阻止超过 100 MiB 的单文件；添加媒体前先压缩并评估仓库总量，不把仓库当无限容量媒体存储。[GitHub 大文件说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

配置依据：[GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite 静态部署](https://vite.dev/guide/static-deploy#github-pages)。

## 工程与 SDD

先读 [AGENTS.md](AGENTS.md)，再读 [产品需求](docs/requirements.md) 和 [总架构](docs/architecture.md)。

| 目录 | 职责 |
| --- | --- |
| src/app | 应用入口、路由、装配 |
| src/content | 配置、模型、校验与排序 |
| src/media-viewer | 全站共用媒体查看器（lightbox 受控渲染与命令转发） |
| src/albums | 首页两屏与主回忆的无 UI 交互契约 |
| src/playback | 照片队列与唯一索引状态 |
| src/themes/beach | 海边主题完整站点 UI、CSS、装饰与资产引用 |
| src/themes/grassland | 草原主题完整站点 UI、CSS、装饰与资产引用 |
| src/themes | 主题选择、偏好与无 UI 装配契约 |
| src/shared | 跨模块无 UI 类型契约（当前：路由形状） |
| scripts | 内容文件校验、缩略图与视频封面生成、视频按内容哈希发布与发布图片压缩 |
| tests | 浏览器验收 |

每个实际模块包含 module.md。新增功能按“spec → plan → tasks → 实现 → 验证 → 同步架构”推进。

页面、主题与交互变化以用户口述为准；新增或改变用户可见交互时，使用 full 流程并在规格中记录可验证的要求。详细规则见 [SDD 维护指南](docs/sdd.md)。

新增主题须建立独立目录，完整实现首页、悬浮主题开关、浏览、相册、CSS、装饰和资产引用；不得导入其他主题或共享 React UI。站点不提供常驻全局顶部导航，内容入口和返回链接由各主题页面独立维护。主题只共享 content、playback、albums、routing 的无 UI 类型与纯交互契约，以及 `media-viewer` 的共用查看器（只挂载，不定制）。视觉特效优先评估轻量既有库，并记录体积、依赖、许可与兼容回退。当前治理决策见 [ADR 0003](docs/decisions/0003-retire-penpot-design-governance.md)。

未来 WebView 通过独立适配边界接入。当前无原生 SDK、桥接或离线缓存；移动模拟测试不能代表 iOS、Android 真机或套壳验证。全屏等功能按浏览器能力降级。

## SDD 维护检查

规则、声明示例及完整/轻量流程见 [SDD 维护指南](docs/sdd.md)。提交前可执行 `npm run check:sdd -- --staged`；审查整个工作区执行 `npm run check:sdd -- --worktree --base origin/main`。`npm run check` 包含模块依赖结构检查，PR CI 校验完整差异与变更声明；实际保护规则以仓库 Settings 为准。
