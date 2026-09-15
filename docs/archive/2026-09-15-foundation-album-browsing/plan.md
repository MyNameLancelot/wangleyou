# 相册浏览闭环实施计划

> 执行方式：按任务实施，使用 executing-plans / subagent-driven-development 的任务检查与审查方式；本项目 SDD 路径优先。状态以 tasks.md 为准。

**Goal:** 交付配置驱动的首页、相册与照片查看流程。
**Architecture:** app 装配页面与 Hash 导航；content 提供校验后的相册；playback 持有唯一的照片队列及索引；media-viewer 管理视图与资源生命周期。
**Tech Stack:** React、TypeScript、Vite、CSS Modules、npm；Vitest 单元测试，Playwright 浏览器验证，sharp 生成缩略图。

## 全局约束

- 纯静态产物，默认 base `/wangleyou/`，可用环境变量指定其它路径。
- 不实现自动幻灯片、音视频、主题切换及线上发布。
- 模块公开入口为 index.ts，不引用其他模块内部文件。
- 资源来源与授权须有记录；所有演示照片本地存储。
- 设计：背景 #fffaf0，正文 #343b32，强调 #a94e22，辅助 #657258，边线 #e5decb；中文标题用系统宋体系列，正文用系统无衬线，日期用等宽字体。首页以相册内真实照片组成横向生活片段，卡片保留有呼吸感的边距；不使用巨大空白宣传区。

## Task 1: 可构建的内容基础（A1、A2、A7、A8）

文件：package.json、package-lock.json、vite.config.ts、tsconfig*.json、eslint.config.js、index.html、src/content/{index.ts,model.ts,validate.ts,albums.json,content.test.ts,module.md}、scripts/{validate-content.ts,thumbnails.ts}、public/media/、public/media/SOURCES.md。

公开接口：
- `Photo` / `Video` 判别联合 `Media`；`Album` 为带媒体数组的相册；`SiteContent` 为站点及相册。
- `validateContent(input: unknown): SiteContent` 校验并抛出包含字段位置的 Error。
- `sortAlbums(albums: Album[]): Album[]` 稳定排序相册及媒体，不改变输入。
- `assetUrl(path: string, base?: string): string` 解析发布地址，默认使用 Vite base。
- `content` 导出经校验的 JSON 数据。

步骤：
- [x] 初始化 React/Vite/TypeScript、npm scripts 和锁文件；限定 Node 24，统一 npm。
- [x] 先写内容行为测试：重复 ID、真实日期、路径越界、字段类型、排序与输入不变；运行测试确认缺少实现时失败。
- [x] 实现类型与校验，CLI 校验 public 内真实文件；构建运行校验与 tsc，再执行 Vite build。
- [x] 下载至少六张来源明确的横竖生活/自然图片，发布大图置 media，sharp 生成不放大的 640px WebP 缩略图到 thumbs；JSON 记录展示尺寸和说明。
- [x] npm run test -- src/content/content.test.ts 通过；npm run validate:content 成功；故意缺失资源在临时 fixture 中必须失败。

校验规则：相册 ID 全局唯一，媒体 ID 相册内唯一；ID 为小写字母数字连字符；标题非空；可选日期严格 YYYY-MM-DD 且为真实日期；路径禁止协议、绝对路径、反斜杠、查询片段和目录穿越；尺寸若指定需为正整数；photo 要求 src，video 要求 src，thumbnail/poster 可选且路径同样校验。

## Task 2: 页面、照片状态和查看器（A3、A4、A5、A9）

文件：src/app/{App.tsx,router.ts,router.test.ts,global.css,index.ts,module.md}、src/albums/{AlbumPages.tsx,AlbumPages.module.css,index.ts,module.md}、src/playback/{session.ts,session.test.ts,index.ts,module.md}、src/media-viewer/{MediaViewer.tsx,MediaViewer.module.css,index.ts,module.md}、src/themes/{index.ts,tokens.css,module.md}、src/shared/{PhotoImage.tsx,index.ts,module.md}。

接口：
- `Route = {kind:'home'} | {kind:'album'; id:string} | {kind:'not-found'}`；`parseRoute(hash: string): Route`。
- `Session = {photos: Photo[]; index: number} | null`；`openSession(photos: Photo[], id: string): Session`；`stepSession(session: Session, delta: number): Session`，越界保持原状态。
- `HomePage` / `AlbumPage` 接收内容和 `onOpen(album, photoId)` 回调。
- `MediaViewer` 接收 session、onStep(delta)、onClose；不持有另一份索引。

步骤：
- [x] 先写 parseRoute 与 session 单元测试，覆盖损坏 URI、未知路由、空队列、首尾、单张和快速顺序切换。
- [x] 实现纯函数并验证测试通过；App 通过 reducer 或唯一 state 持有 session，路由变化清空。
- [x] 实现顶部站点标识、首页照片片段、相册入口、近期照片，及相册网格与空状态。
- [x] 原生 dialog 实现 modal、焦点恢复、滚动锁、键盘及水平手势；媒体 keyed by id，处理加载/错误/重试；全屏调用失败不影响普通查看。
- [x] 公共 PhotoImage 封装卡片图片与错误反馈；重试只在大图查看器提供，避免卡片链接/按钮内嵌套重试按钮。重试限定当前资源，不污染切换后的图片。
- [x] 写模块文档、默认主题和 360px 响应式样式；运行 tsc、lint 和单测。

## Task 3: 静态部署验证与交付（A1—A10）

文件：playwright.config.ts、tests/browsing.spec.ts、README.md、.gitignore、.nvmrc、.github/workflows/check.yml、docs/architecture.md、docs/decisions/0001-frontend-foundation.md、当前变更 verification.md。

步骤：
- [x] Playwright 通过 scripts/serve-built.mjs 严格静态服务（不做 SPA 路由回退）在静态产物上测试主流程、照片加载、首尾禁用、Esc、焦点、刷新、未知路由、失败/重试、快速切换、空与单张 fixture。
- [x] 移动端 360px 验证溢出、水平与垂直手势；保存首页和相册截图并目视检查，修复视觉问题。
- [x] 通过临时配置 fixture 验证新增相册不改 UI；单元及 CLI fixture 验证缺失本地文件失败。
- [x] 运行 `npm run check`（校验、类型、静态检查、单测）、`npm run build` 和 `npm run test:e2e`；使用另一个 base 构建并验证资源 HTTP 与页面刷新。
- [x] CI 仅检查构建和测试，不发布。README 说明本地命令、资源和缩略图维护、GitHub Pages Actions 发布步骤以及功能边界。
- [x] 同步架构、决策、任务与验证证据。逐项验收通过后归档整个变更目录并更新索引，未完成则保持活动状态。

## 回退

本分支新增应用代码与文档；出现问题只回退本次相关文件，不操作用户 .idea 或其他改动。依赖变更保留 package 与 lock 一致；不擅自执行 reset、clean、推送或公开部署。

## 后续里程碑

本次完成后另建规格实现播放状态机、自动幻灯片、视频与音乐协调，再实现完整主题切换；不得将这些未实现功能标为完成。
