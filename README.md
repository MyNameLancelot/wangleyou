# 王乐悠 · 成长相册

用相册收藏孩子与家人的生活瞬间。React + TypeScript + Vite 构建，产物是可部署到 GitHub Pages 的静态文件。

## 当前版本

已实现首页、相册列表与详情、照片大图、键盘及触屏切换、全屏、默认暖阳奶油主题，以及内容校验和缩略图生成。

自动幻灯片、生活视频播放、背景音乐、完整三套主题切换和 App 套壳属于后续里程碑。当前视频配置只显示未支持提示，不提供播放按钮。

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
| `npm run thumbnails` | 从发布大图生成缩略图，不修改大图 |
| `npm run compress:photos` | 离线把照片压成发布规格：长边封顶、统一 JPEG、剥离元数据，不改动源文件 |
| `npm run validate:content` | 检查配置结构、日期、ID 和实际文件 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 内容、路由、照片状态及文件校验单测 |
| `npm run check` | 内容、类型、静态检查和单元测试 |
| `npm run build` | 校验后生成 dist 静态产物 |
| `npm run preview` | 预览构建结果，默认端口 4173 |
| `npm run test:e2e` | 构建产物上的桌面与移动端 Chrome 验收 |
| `npm run verify:fixtures` | 临时新增单张相册并验证浏览器行为，结束后恢复原配置及构建；请串行执行 |

浏览器测试前先 `npm run build`。测试使用 scripts/serve-built.mjs 提供严格静态服务，未知文件返回 404，不做 SPA 回退。需要 Chrome；环境尚未安装时运行 `npx playwright install chrome`。Linux CI 使用 `npx playwright install --with-deps chrome`。报告在 playwright-report，截图/失败 trace 在 test-results，均不提交 Git。

## 添加照片或相册

1. 相机源素材自行保存在仓库外，准备适合网页显示的 JPEG、PNG 或 WebP 大图。
2. 将发布大图加入 `public/media/`，使用不同文件名避免覆盖现有内容。照片文件名建议小写英文和连字符。
3. 运行 `npm run thumbnails`。脚本读取 media 目录顶层图片，在 `public/media/thumbs/` 生成最长边 640px、质量 78 的 WebP，不放大、不覆盖源文件。派生文件需要一并提交。
4. 编辑 `src/content/albums.json`，添加相册或媒体项。
5. 运行 `npm run check` 和 `npm run build`，预览确认；重新部署后更新线上内容。

新增相册示例（先准备引用文件）：

```json
{
  "id": "autumn-walk",
  "title": "秋天的散步",
  "date": "2026-10-01",
  "description": "一起踩过落叶的小路。",
  "cover": "media/thumbs/autumn-walk.webp",
  "media": [
    {
      "id": "leaves-on-path",
      "type": "photo",
      "src": "media/autumn-walk.jpg",
      "thumbnail": "media/thumbs/autumn-walk.webp",
      "date": "2026-10-01",
      "description": "收集一片秋天",
      "alt": "铺着金黄色落叶的小路",
      "width": 1600,
      "height": 1067
    }
  ]
}
```

### 配置规则

- 顶层 `site.title`、`site.subtitle` 控制站点文案，`albums` 是相册数组。
- 相册必填 `id`、`title`、`media`；`date`、`description`、`cover` 可选。
- 媒体必填 `id`、`type`、`src`；`thumbnail`、`date`、`description`、`alt`、`width`、`height` 可选。
- `type` 为 `photo` 或 `video`；视频另外支持 `poster` 和非负 `duration`（秒），本期不播放。
- ID 使用小写字母、数字、单个连字符分隔。相册 ID 全局唯一，媒体 ID 在相册内唯一。
- 日期使用真实的 `YYYY-MM-DD`。相册新到旧、媒体旧到新；缺日期排末尾，同日期保持配置顺序。
- 路径相对 public，例如 `media/photo.jpg`。不写 `/wangleyou/` 或 `public/` 前缀，不写外部 URL、查询参数、反斜杠或 `../`。路径由应用统一加部署前缀。
- 不指定封面时选择第一个可用预览资源；空相册使用占位。
- 可选尺寸必须为正整数；大图按原比例显示，缩略图容器可以裁切。
- 显式引用文件不存在、配置格式错误、重复 ID 会使校验和构建失败，并指出字段位置。运行时网络失败可在大图查看器重试。
- 背景音乐配置尚未实现；本阶段不要增加无消费方的音乐配置。

### 压缩发布大图

相机原片和演示素材先压成适合网页发布的规格再加入 `public/media/`。这是独立的离线预处理命令，只读输入目录，不参与站点运行时，也不改变任何页面行为。

```bash
npm run compress:photos -- ~/Pictures/trip              # 输出到 ~/Pictures/trip_compressed
npm run compress:photos -- ~/Pictures/trip --out public/media --max-edge 3840 --quality 78
npm run compress:photos -- ~/Pictures/trip --dry-run     # 只扫描并打印计划与预估，不写文件
```

- 默认长边上限 4096（DCI 4K 口径，横竖通用），只按原比例缩小、不放大；需要 UHD 口径时传 `--max-edge 3840`。
- 默认质量 82。同一张图 q100 体积约为 q80 的两倍而画质没有可见收益，因此不建议把默认质量调高。输出一律为 JPEG 且扩展名改为 `.jpg`，编码使用 mozjpeg 与渐进式扫描。
- 默认剥离 EXIF/GPS/拍摄时间等全部元数据，需要保留时加 `--keep-exif`；无论是否保留元数据，输出都会先按 EXIF Orientation 摆正。
- 默认输出目录是输入目录同级的 `<输入目录>_compressed`，用 `--out` 覆盖；递归处理子目录并保留相对结构。可用 `--concurrency` 调整并发（默认 4，上限为 CPU 核数）。
- HEIC/HEIF 需要外部解码器：先尝试 sharp 直接解码，失败后按 `sips`（macOS 自带）→ `heif-convert` → `magick` 顺序探测；三者在当前机器都没有时，该文件计入失败并给出安装建议，也可用 `--heic-via none` 跳过 HEIC。临时 JPEG 写在系统临时目录并自动清理。
- 同一输出目录内多个源文件映射到同一个 `.jpg` 名时（例如 `a.jpg` 与 `a.png` 并存），按路径字典序保留第一个，其余追加 `-2`、`-3`，并在汇总中列出改名结果。
- 重跑会覆盖同名输出文件，不影响输出目录中与本次无关的已有文件；输入目录始终保持只读。结束时打印成功、跳过、失败三类计数、体积节省比例、体积变大与失败清单。
- 退出码：0 全部成功，1 存在处理失败，2 参数或环境错误。完整参数用 `npm run compress:photos -- --help` 查看。

视频封面当前需维护者自行准备。添加大视频前先评估仓库和 Pages 限制；本项目没有在线压缩或转码服务。

## 静态路径与 GitHub Pages

普通公开仓库可以开启 Pages。本仓库部署成功后的地址为 `https://mynamelancelot.github.io/wangleyou/`。项目使用 Hash 路由，例如 `/wangleyou/#/albums/summer-days`，不依赖服务器重写。

默认构建基础路径 `/wangleyou/`，可覆盖：

```bash
SITE_BASE=/another-repo/ npm run build
SITE_BASE=/another-repo/ npm run preview
```

用户主页或自定义域名根目录使用 `SITE_BASE=/`。构建与预览应使用相同 base。

### 首次部署

1. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。用户已提供此设置的截图；不需要选择 Jekyll 或 Static HTML 模板。
2. 默认地址不需要 Custom domain，留空即可；github.io 的 HTTPS 自动启用。
3. 将本部署分支提交、推送，并通过 PR 合并到 `main`。工作流文件必须进入 main 才会自动发布；只推送功能分支不会发布网站。
4. 在 **Actions → Deploy GitHub Pages** 查看 `Validate before deployment → Build Pages artifact → Publish GitHub Pages`。
5. 若 GitHub 要求环境审批，按已有规则审批；在 **Settings → Environments → github-pages** 核实允许 `main` 部署。不要为通过检查而绕过现有审批。
6. 发布成功后打开运行中 `github-pages` 环境给出的链接，核对首页、相册直接链接和刷新、照片原图与缩略图。Pages 设置页也会显示访问地址。

`.github/workflows/deploy.yml` 监听 main 更新，也支持 **Run workflow → Branch: main** 手动重试。选择其他分支会跳过发布。每次先复用 `.github/workflows/check.yml` 运行内容/SDD 结构/类型/lint/单元测试/构建、内容夹具与桌面和移动模拟浏览器验证；全部成功才从同一提交重新构建并上传 `dist/`。Node/npm 只用于构建，访客浏览器加载编译后的 HTML/CSS/JS。

check.yml 保留独立 push/PR 检查，因此 main 更新时会看到独立检查和部署内检查两次运行；检查命令只维护一份。`SDD policy` 的完整变更声明门禁仍在 PR 执行，保护 main 仍需要 [分支保护](docs/sdd.md)。deploy.yml 不赋予构建任务 Pages 写权限；只有发布任务获得 Pages 写入与身份令牌权限，无需新增 PAT 或 secrets。

发布只上传 dist/，不提交 dist/，不创建 gh-pages 分支。工作流明确设置 `SITE_BASE=/wangleyou/`；若以后绑定根域名或改仓库名，需同步工作流、Vite 默认路径和浏览器验证配置，不只填写 Custom domain。

### 失败处理与回退

- 检查或构建失败：查看第一个失败任务，修复后更新 main；后续上传/发布不会执行。
- Pages 配置失败：确认 Source=GitHub Actions；发布权限/环境错误则检查 job 权限及 github-pages 的分支/审批设置。
- 工作流已在 main 但没有运行：在 Actions 手动运行并选择 main。重跑历史运行会使用该次旧提交；恢复正常发布应运行当前 main。
- 页面能开但资源 404：核对 /wangleyou/ 基础路径、相册媒体配置和真实 Pages 地址。
- 暂停自动发布：在 Actions 禁用 Deploy GitHub Pages。恢复旧版本通过新 PR revert 问题提交，记录相应 SDD 说明，合并 main 后重新验证部署；禁用工作流不会删除已发布网站。

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
| src/albums | 首页和相册页面 |
| src/playback | 照片队列与唯一索引状态 |
| src/media-viewer | 大图、键盘、触屏、焦点与全屏 |
| src/shared | 复用图片组件 |
| src/themes | 默认主题变量 |
| scripts | 内容文件校验、缩略图生成与发布图片压缩 |
| tests | 浏览器验收 |
| docs/changes | 活动规格、计划与任务 |
| docs/archive | 已完成变更与验证记录 |

每个实际模块包含 module.md。新增功能按“spec → plan → tasks → 实现 → 验证 → 同步架构 → 归档”推进。

新增主题应沿用 `src/themes/tokens.css` 的语义变量；后续主题选择和偏好管理放在 themes，业务模块不维护独立主题分支。

未来 WebView 通过独立适配边界接入。当前无原生 SDK、桥接或离线缓存；移动模拟测试不能代表 iOS、Android 真机或套壳验证。全屏等功能按浏览器能力降级。

本里程碑的 [规格、计划和任务归档](docs/archive/2026-09-15-foundation-album-browsing/spec.md) 与 [验证记录](docs/archive/2026-09-15-foundation-album-browsing/verification.md) 已完成。

## SDD 维护检查

规则、声明示例、完整/轻量流程及 GitHub 必需检查设置见 [SDD 维护指南](docs/sdd.md)。提交前可执行 `npm run check:sdd -- --staged`；审查整个工作区执行 `npm run check:sdd -- --worktree --base origin/main`。`npm run check` 包含模块依赖结构检查，PR CI 校验完整差异与变更声明。远端保护尚未核实，工作流存在不代表已经限制合并。
