# 王乐悠 · 成长相册

用相册收藏孩子与家人的生活瞬间。React + TypeScript + Vite 构建，产物是可部署到 GitHub Pages 的静态文件。

## 当前版本

已实现首页、影像浏览（年份分组与类型筛选）、相册索引与详情（照片与视频混排、视频带播放角标）、手动照片查看与视频播放（全站共用查看器：`yet-another-react-lightbox` + Captions/Fullscreen/Slideshow/Thumbnails/Video/Zoom 插件，含原生控制条、键盘与触屏操作）、唯一线缝相册主题，以及内容校验、缩略图生成与视频按内容哈希发布。查看器不在进入时自动播放幻灯片，视频结束停留当前项。

家庭设备原生 WebView 壳位于 `native/ios` 与 `native/android`，只加载线上网站；Android Debug APK 与家庭密钥签名的 Release 构建已通过，iOS 安装已按用户决定暂缓，完整 Xcode 构建和设备验收仍待办。首页主回忆按主回忆照片数加一张文字收束页翻阅，使用局限于内页范围的柔和卷页，到末页停止；手机标题分两行。背景音乐资产与代码能力保留在 `public/media/themes/book/` 和 playback，但当前不显示入口，也不挂载音频或播放。唯一相册主题维护页面 UI、CSS、装饰和资产引用；查看器是独立的共用 UI（`src/media-viewer`），主题只挂载它、不能定制其样式或功能。后续页面与交互设计以用户口述和活动规格为准。

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
- 背景音乐不进入相册内容配置；相册主题资产（浏览头图、保留但停用的背景音乐）放在 `public/media/themes/book/`。当前站点不播放背景音乐。重新启用或替换真实音乐时同步主题组件、素材说明和许可确认。

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

手机浏览器打开该 Network 地址即可（媒体由开发服务器直接提供，不需要先把素材推到远端）。生产构建与 `npm run preview` 使用同一份 `dist/` 和同一个媒体前缀，本地预览看到的素材就是线上素材；线上只会在改动合并到 main 后重新构建。

平台能力差异：Android Chrome 支持元素级全屏，图片与视频都能进系统全屏；iPhone Safari 不提供任意元素的全屏 API（只有 `<video>` 能全屏），此时查看器不渲染全屏按钮，影像仍是覆盖视口的黑色沉浸层。原生壳无浏览器地址栏；实际全屏能力仍以设备 WebView 为准。

格式与三端：发布形态只有一种——H.264 + AAC 的 MP4 + faststart。桌面浏览器、移动端浏览器与原生 WebView 壳共用同一份视频，不按端生成不同格式；`playsinline` 保证移动端内联播放，弱网优化也是补同一格式的更低码率/分辨率变体，而不是换 WebM/HEVC（那会带来越来越多的兼容分支与额外编码成本）。

体积基线：单个视频 >100 MB 打印警告，>200 MB 构建失败；添加大视频前先评估仓库和 Pages 限制，GitHub 普通推送本身阻止超过 100 MiB 的单文件。

## 静态路径与 GitHub Pages

普通公开仓库可以开启 Pages。本仓库部署成功后的地址为 `https://mynamelancelot.github.io/wangleyou/`。项目使用 Hash 路由，例如 `/wangleyou/#/albums/summer-days`，不依赖服务器重写。

默认构建基础路径 `/wangleyou/`，可覆盖：

```bash
SITE_BASE=/another-repo/ npm run build
SITE_BASE=/another-repo/ npm run preview
```

用户主页或自定义域名根目录使用 `SITE_BASE=/`。构建与预览应使用相同 base。

媒体前缀独立于页面 base，由构建期 `VITE_MEDIA_BASE_URL` 决定，未设置时回退页面 base。受版本控制的 `.env.production` 当前不设置该变量，因此生产构建里 `media/<相册目录>/a.jpg` 解析为 `https://mynamelancelot.github.io/wangleyou/media/<相册目录>/a.jpg`，媒体与页面同源。派生 WebP 与视频产物在构建期生成、不提交仓库，所以只读取 Git 仓库文件的 CDN（例如 jsDelivr 的 `gh/<owner>/<repo>@<ref>` 形式）不能作为媒体前缀。不要在 JSON 或主题代码写完整 URL；需要临时指向镜像或其他来源时，在构建命令覆盖：

```bash
VITE_MEDIA_BASE_URL=https://media.example.com/ npm run build
```

本地 `npm run dev` 未设置该变量时继续从 Vite `BASE_URL` 加载仓库内媒体。该变量只影响图片、视频、视频封面、主题图和背景音乐，不影响 `/wangleyou/`、页面入口或 `#/...` 路由。当前媒体托管结论、升级触发条件与两条候选路径见 [总架构](docs/architecture.md)。

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

部署已执行：2026-09-24 核实的线上地址为 `https://mynamelancelot.github.io/wangleyou/`，HTTPS 返回 200。职责见 [工作流模块](.github/workflows/module.md)。

截至 2026-09-16，GitHub Pages 发布站点最大 1 GB，源仓库建议不超过 1 GB，每月带宽软限制 100 GB，单次 Pages 部署超过 10 分钟会超时；自定义 Actions 不受默认每小时 10 次构建软限制约束。[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

普通 Git 推送会阻止超过 100 MiB 的单文件；添加媒体前先压缩并评估仓库总量，不把仓库当无限容量媒体存储。[GitHub 大文件说明](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)

Cloudflare Pages 已通过 Git 集成从 `main` 构建根路径站点 `https://wangleyou.pages.dev/`，构建环境设 `NODE_VERSION=24`、`SITE_BASE=/`、命令 `npm ci && npm run build`、输出目录 `dist`。GitHub Pages 的 `/wangleyou/` 地址保留为浏览器备用。两处当前都让媒体与页面同源；真实照片和视频的独立存储尚未实施。仓库型 CDN 只能提供已提交的文件，拿不到构建期派生资源。媒体托管触发条件与候选路径见 [总架构](docs/architecture.md)。

配置依据：[GitHub 自定义 Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[Vite 静态部署](https://vite.dev/guide/static-deploy#github-pages)。

## 家庭设备原生 App

`native/ios` 与 `native/android` 是可独立安装的原生工程，默认只加载生产网站 `https://wangleyou.pages.dev/`。顶层站内页面限定为该 HTTPS host 的根路径，Hash 路由留在 WebView；GitHub Pages 保留浏览器备用。若更改站点域名或子路径，要同时更新两端 URL 与导航白名单。安装包只含系统 WebView 容器代码、图标、Android 本地开屏视频与加载/错误界面，不包含 `dist/`、`media-source/`、`public/media/` 或相册配置。相册和媒体更新仍由 main 的网站部署生效，无需重打原生包。

原生构建与网站部署分开。`.github/workflows/native.yml` 只能在 Actions 手动 **Run workflow**，运行 Android debug 与 iOS 无签名模拟器构建校验，不上传任何 APK/IPA。网站 main push 触发 GitHub Pages 工作流与 Cloudflare Pages Git 构建。原生壳、图标、权限或原生配置变化时，维护者提升版本号并手动构建。本次用户明确要求把 v1.0.10 签名 APK 上传公开 GitHub Release，供扫码下载；签名文件、密码与设备 ID 始终不得入仓库或上传。

### Android：本机 APK

需要 JDK 17、Android SDK Platform 35、Build Tools 35.0.0。若使用 SDKMAN，可在构建终端执行 `sdk use java 17.0.20-tem`；不要让项目继承 JDK 8 或 25。Gradle Wrapper 固定 8.11.1，Android Gradle Plugin 固定 8.9.2；首次构建需要从官方仓库下载依赖。调试安装：

```bash
cd native/android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`app-debug.apk` 由本机 debug key 签名，只供开发验证。当前 Android 家庭 Release 版本为 1.0.10（`versionCode` 11），桌面名称为「乐悠时光」，图标为奶油白底无文字翻开相册；系统启动和加载阶段播放 APK 内的 1080×1920 相册翻开视频，全程由同一画面层中心裁切铺满，视频播完后网页若仍未就绪则保持视频尾帧，网页先就绪时可用右上角「跳过」立即进入。视频源文件位于 `native/android/app/src/main/res/raw/album_opening.mp4`，加载文案下方的光条往返运动，异常或关闭动画时使用奶油白背景与文字。网页出现后状态栏透明，网页背景延伸至屏幕顶部，渐隐暗色层保证系统图标可读。请在全面屏设备上核对时间图标、顶部控件和视频全屏。家庭分发请在本机安全生成并保管私有 keystore，例如 Android Studio **Build → Generate Signed Bundle / APK → APK**；或设置以下四个环境变量后构建，Gradle 内部产物为 `native/android/app/build/outputs/apk/release/app-release.apk`：

```bash
export WANGLEYOU_ANDROID_KEYSTORE=/absolute/private/path/family.jks
export WANGLEYOU_ANDROID_STORE_PASSWORD='在本机设置'
export WANGLEYOU_ANDROID_KEY_ALIAS='在本机设置'
export WANGLEYOU_ANDROID_KEY_PASSWORD='在本机设置'
cd native/android && ./gradlew :app:assembleRelease
apksigner verify --verbose app/build/outputs/apk/release/app-release.apk
python3 package_family_apk.py  # 输出 app/build/outputs/apk/release/乐悠时光-v1.0.10.apk
```

不要把示例值当成真实密码，也不要把密码写进仓库。本机已生成的家庭签名材料位于被 Git 忽略的 `.private/android/family-release.jks` 与 `.private/android/signing.env`；请将两者加密备份到仓库和电脑之外，丢失后不能用同一身份更新已安装的 App。安装 APK 时，Android 8+ 需要在设备上为接收文件的应用临时允许“安装未知应用”；首次安装和后续更新必须使用同一私钥签名。Debug 版与家庭 Release 版签名不同，已安装 Debug 版时需先卸载，其本地数据会被清除。v1.0.10 的 GitHub Release 链接公开，扫码下载可供家庭安装；在大陆网络仍需实际确认 GitHub 下载是否可达，安装后可关闭该来源的安装权限。

截至 2026-09-24，[Android 开发者验证 FAQ](https://developer.android.com/developer-verification/guides/faq) 说明 2026-09-30 的首批执行不改变直接侧载安装；2027 年后的全球规则仍会演进。若未来设备要求开发者登记，可评估免费的[有限设备分发账户](https://developer.android.com/developer-verification/guides/limited-distribution)或按系统的高级安装流程操作；不把它误认为当前签名 APK 已完成设备登记。

### iPhone / iPad：本机 IPA

需要完整 Xcode（仅 Command Line Tools 不够）。先打开 `native/ios/WangLeYou.xcodeproj`，选 `WangLeYou` scheme，在 iPhone 和 iPad 模拟器运行；命令行无签名构建：

```bash
xcodebuild -project native/ios/WangLeYou.xcodeproj -scheme WangLeYou -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

家庭设备 Ad Hoc 安装需要 Apple Developer Program 会员、匹配 `com.mynamelancelot.wangleyou` 的 App ID、iOS Distribution 签名证书及私钥、登记每部 iPhone/iPad 的设备标识、包含这些设备的 Ad Hoc provisioning profile。用 Xcode 的 Signing & Capabilities 选择团队并管理签名，选择 **Any iOS Device** 后 **Product → Archive → Distribute App → Ad Hoc/Custom** 导出 `.ipa`；在已登记设备上通过 Xcode Device Hub 或 Apple Configurator 安装，并启用 Developer Mode。Apple 对每个设备类别的年度登记数量有限制；新增设备后需更新描述文件。证书、描述文件、私钥和设备标识只在维护者本机与 Apple 开发者账户保管。

本机缺少完整 Xcode 与 iOS 签名资料，iOS 安装已按用户决定暂缓；当前只能确认源码和无凭据检查，尚无可供家庭安装的 IPA。免费 Apple 账户的 Personal Team 配置文件约 7 天过期，家庭长期 Ad Hoc 分发需 Apple Developer Program 会员及登记设备。Android 家庭 Release APK 需签名与安装验证；真机安装和功能验收仍待用户执行。此站点切换的实际结果见 [本次变更记录](docs/changes/native-cloudflare-site/tasks.md)。

官方依据：[Apple 登记设备分发](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)、[Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview)、[Android APK 签名](https://developer.android.com/studio/publish/app-signing)、[Android 私下分发](https://developer.android.com/distribute/marketing-tools/alternative-distribution)。

## 工程与 SDD

先读 [AGENTS.md](AGENTS.md)，再读 [产品需求](docs/requirements.md) 和 [总架构](docs/architecture.md)。

| 目录 | 职责 |
| --- | --- |
| src/app | 应用入口、路由、装配 |
| src/content | 配置、模型、校验与排序 |
| src/media-viewer | 全站共用媒体查看器（lightbox 受控渲染与命令转发） |
| src/albums | 首页主回忆与横向手势的无 UI 交互契约 |
| src/playback | 照片队列与唯一索引状态 |
| src/themes/book | 唯一相册主题的页面 UI、CSS、装饰与资产引用 |
| src/themes | 主题装配契约 |
| src/shared | 跨模块无 UI 类型契约（当前：路由形状） |
| scripts | 内容文件校验、缩略图与视频封面生成、视频按内容哈希发布与发布图片压缩 |
| tests | 浏览器验收 |
| native/ios | iPhone/iPad WKWebView 原生壳与 Xcode 工程 |
| native/android | Android WebView 原生壳与 Gradle 工程 |

每个实际模块包含 module.md。新增功能按“spec → plan → tasks → 实现 → 验证 → 同步架构”推进。

页面、主题与交互变化以用户口述为准；新增或改变用户可见交互时，使用 full 流程并在规格中记录可验证的要求。详细规则见 [SDD 维护指南](docs/sdd.md)。

当前只有一套相册主题，页面内无主题切换。主题通过 content、playback、albums、routing 的公开无 UI 契约协作，仅挂载共用 `media-viewer`，不定制其样式与功能。视觉特效优先评估平台能力和既有轻量库，并记录兼容回退。当前治理决策见 [ADR 0003](docs/decisions/0003-retire-penpot-design-governance.md)。

原生 WebView 壳通过独立工程接入。当前无 JS 桥接或离线缓存；移动浏览器视口模拟不能代表 iOS、Android 真机或套壳验证。全屏等功能按系统 WebView 能力降级。

## SDD 维护检查

规则、声明示例及完整/轻量流程见 [SDD 维护指南](docs/sdd.md)。提交前可执行 `npm run check:sdd -- --staged`；审查整个工作区执行 `npm run check:sdd -- --worktree --base origin/main`。`npm run check` 包含模块依赖结构检查，PR CI 校验完整差异与变更声明；实际保护规则以仓库 Settings 为准。
