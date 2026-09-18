# 按设计基线实现前端 · 验证记录

日期：2026-09-17  
状态：实施完成，满足归档条件  
设计基线：[长期 UI/交互设计系统](../../archive/2026-09-17-long-term-design-system/spec.md)（Penpot 为设计事实来源）

## 环境与范围

- 分支：`feat/ui-design-implementation`，从已合并的 `main`（`b40ed03`）创建。
- 本机：macOS，Node 24，npm；验证命令均在本仓库执行。
- 端到端：Playwright `desktop-chrome`（1440×1000）与 `mobile-chrome`（Pixel 5，360×800），构建产物由 `scripts/serve-built.mjs` 提供，未知文件返回 404。
- 本变更只改前端运行时代码与文档；未引入登录、后端、数据库、CMS、付费服务或原生桥接。

## 阶段与提交

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| 1 | `31c9a80` | 三套运行时主题与语义设计变量 |
| 2 | `7874d13` | 播放队列升级为媒体队列，意图与状态分离 |
| 3 | `7526880` | 首页、影像浏览、相册索引与详情按设计重构 |
| 4 | `2d19048` | 查看器支持视频、控制栏与连续播放 |
| 5 | `4dd3f56` | 媒体骨架、失败文案与 44×44 触控目标 |
| 6 | `d24c90f` | 两套主题的纯 CSS 装饰层 |

## B1–B12 验证

| 条目 | 状态 | 证据 |
| --- | --- | --- |
| B1 | 通过 | `src/themes/tokens.css` 只交付两套主题：海边沙滩为 `:root` 默认外观，旷野草原由 `[data-theme='grassland']` 覆盖，不存在第三套中性主题；`applyTheme` 写入 `data-theme` 与 `localStorage: wangleyou.theme`，缺省与非法值回退海边。单测 `theme.test.ts` 6 条覆盖缺省、非法值、持久化、存储抛错与循环切换；端到端 `theme decoration stays decorative and switchable` 验证海边 ↔ 草原切换、刷新后保留，并断言草原主题下 hero 文案随之变化。 |
| B2 | 通过 | 端到端 `theme switch keeps page, media and playback context`：查看器内切主题后序号仍为 2/3、路由仍为 `#/albums/summer-days`、关闭后主题保持。主题切换只调用 `applyTheme`，不触碰会话。 |
| B3 | 通过 | `playback` 用一条队列承载照片与视频（`openSession(media,id)`）；单测覆盖混合队列推进、越界保持、`currentMedia`；端到端 `video plays…` 验证视频在第 4 项、向左切到第 3 项（照片，无进度条）。 |
| B4 | 通过 | `handleEnded`：连续播放开启且有下一项时前进并继续播放，否则停在当前项并标记 `ended`；单测 2 条覆盖两种分支。控制栏连续播放开关为 `aria-pressed` 切换，端到端验证状态翻转。 |
| B5 | 通过 | 控制栏提供播放暂停、进度（`input[type=range]` + `aria-label="播放进度"`）、静音、连续播放、上一项/下一项、全屏；键盘 `←/→/Space/M/F/Esc` 与触控水平滑动均已实现。端到端 `video plays…`、`fullscreen enters…`、`fullscreen rejection…`、`horizontal swipe…` 覆盖。 |
| B6 | 通过 | 播放中无操作 3 秒隐藏控制栏，指针移动、触摸、键盘与 `focusin` 立即恢复；控件获得焦点时不再隐藏，隐藏时 `inert` 防止焦点落到不可见控件。`image failure can be retried…` 验证重试后键盘仍可用（焦点兜底）。 |
| B7 | 通过 | 首页（影像入口、精选回忆、相册入口、继续浏览、主题切换）、`#/browse`（类型筛选 + 年份分组与定位）、`#/albums` 索引、相册详情（面包屑、时间范围、从这里播放、相邻相册）、未找到页均已实现；单测 7 条 + 端到端 `year navigation and type filter…` 覆盖。 |
| B8 | 通过 | 骨架（`media-skeleton` + `aria-busy`）、空相册、图片失败（图标 + 文案 + 重试）、视频不可播放（重试 + 下一项）、配置异常页（`contentErrorMessage`）、离线提示条均已实现；端到端 `media skeletons resolve into real images`、`image failure can be retried…`、`subpath refresh, invalid routes and empty albums` 覆盖。 |
| B9 | 通过 | 端到端 `interactive targets are at least 44px and pages never scroll horizontally`：`#/`、`#/browse`、`#/albums`、`#/albums/little-weekend` 在 1440 与 360 视口下均无横向溢出，可见交互元素不小于 44×44；查看器与页脚叠加 `env(safe-area-inset-*)`。 |
| B10 | 通过 | 端到端 `homepage, album, original photo, keyboard and focus restoration`（方向键切换、Esc 退出、焦点归还触发元素）、`dialog focus stays modal…`（Tab 保持模态）、`reduced motion collapses durations and focus ring stays visible`（焦点环 3px 实线）。 |
| B11 | 通过 | `:root` 在 `prefers-reduced-motion: reduce` 下把动效时长 Token 收敛为 1ms，并禁用循环动画；骨架与装饰层不再动画。端到端断言读取到的 `--motion-standard-duration` 为 `1ms`。 |
| B12 | 通过 | 页面与缩略图统一显示"演示素材"标签，页脚标注 Pexels / MDN CC0 来源，`public/media/SOURCES.md` 记录照片与视频来源与许可；未使用真实家庭影像。 |

## 已执行检查

- `npm run check`：通过（内容校验、typecheck、lint、单测 10 个文件 98 项）。
- `npm run build`：通过，产物 `dist/assets/index-*.js` 约 255 kB（gzip 80 kB）、CSS 约 29 kB（gzip 6 kB）。
- `npm run test:e2e`：通过，29 passed / 3 skipped（跳过项为移动端原生全屏，属平台能力差异，非失败）。
- `npm run verify:fixtures`：通过。临时新增相册后内容校验为 4 个相册 8 个媒体，`CONTENT_FIXTURE=1` 端到端 2 passed，随后配置与构建产物恢复到 3 个相册 7 个媒体。
- 视觉抽查：`test-results/desktop-chrome-home.png`、`mobile-chrome-home.png`、`desktop-chrome-album.png`、`mobile-chrome-album.png` 为端到端自动截图，肉眼检查首页 hero、相册网格、最近影像与视频标识渲染正常。

## 与设计基线的对照

- 语义变量命名与 Penpot 一致（`color.*`、`space.*`、`radius.*`、`motion.*`、`mediaViewer.*`），颜色取值与设计 Token 完全相同，因此设计阶段实测的对比度（主文本 11.31–12.12:1、次文本 5.65–6.26:1、主操作文字 4.81–5.92:1、强边界 3.63–3.74:1、媒体控制栏白字 9.88–18.54:1）在运行时同样成立。
- 两套主题共用同一组件与布局，差异只出现在 Token 值、装饰 Slot、背景层与动效节奏。
- 移动端 390 与横屏规则按设计标注实现：媒体优先居中、控制栏贴底、44×44 触控、safe-area、reduced-motion。

## 未验证或受限

- 未做真机 iOS/Android 与 WebView 套壳验证：本地只有桌面 Chrome 与 Playwright 移动模拟（360×800），真机结论需另立变更。
- 自动幻灯片、背景音乐未实现（本次非目标，需求基线保留）。
- 视频演示素材为 CC0 短片，真实家庭视频的编码、体积与字幕流程需在内容维护时按 `SOURCES.md` 规则替换。
- 横屏验证为 CSS 规则与 Playwright 视口模拟，未使用真实手机横屏拍摄验证。

## 视觉对齐修订（2026-09-17，复核设计稿后）

第一次交付与本仓库设计稿（`docs/design-assets/*-v2.png`）差距明显，复核后做了针对性修订，本记录同步更新：

- 默认外观为**海边沙滩**：`THEMES` 只保留海边与草原，中性默认主题被移除，`:root` 直接使用海边取值以便首屏就是默认主题；`docs/requirements.md` §4.4 同步。
- 首页改为设计稿的**整幅环境插画 + 左侧内容卡**结构：眉标胶囊、主题标题与副标题、主次按钮、内容统计；文案作为主题语气 Slot（`THEME_COPY`），相册数据仍全部来自 content。
- 影像卡片改为设计稿的**说明条内嵌在卡片底部**（深色条 + 白字），首页与浏览页为 16:7 宽卡、相册详情为 4:3 高卡，视频保留右上播放圆标与时长。
- 影像浏览页改为 **hero 带 + 悬浮筛选胶囊 + 左侧"按时间定位"卡（年份与相册列表）**，小屏隐藏侧栏并回退为横向年份按钮。
- 相册详情改为设计稿的右对齐"从这里播放"主按钮，并把相邻相册区改为"接下来的影像 + 下一本相册 →"预告。
- 页眉标识改为 `站点名 · FAMILY ARCHIVE`，主题切换器改为设计稿的"◐ 海边主题 ⌄"胶囊；页脚改为主题脚注 + "示例内容 · 非真实影像"。
- 运行时背景插画由设计资产导出为 `public/media/theme/{beach,grassland}-hero.webp`（约 108 KB / 101 KB），来源与许可见 `public/media/SOURCES.md`。

修订后复跑：`npm run check` 98 项单测通过、`npm run build` 通过、`npm run test:e2e` 29 passed / 3 skipped；桌面 1440 与移动 360 截图肉眼对照设计稿，hero、卡片说明条、浏览页侧栏与相册预告结构一致。
