# 测试判定与证据

本表只记录治理时的判定依据；执行的是当前 `origin/main`（a646d69）工作区。所有 Playwright 用例均在 Chrome 静态构建套件中通过，因此没有依据判定任何断言目标已失效。判定按用例主要能力域归类，跨域集成用例保留在“导航与集成”。

## 判定规则

- **删除**：目标控件、文案、路由或属性在 `src` 当前实现中不存在，且 Git 历史能证明移除或改名。
- **更新**：行为仍存在，但选择器、文案或结构变化；测试改为当前契约。
- **保留**：断言目标仍在、测试仍通过或按设备条件合理跳过。
- 行数、耗时或表面重复不作为删除理由。

## tests/browsing.spec.ts

| 用例 | 断言目标 | 目标是否仍存在 | 判定 | 证据 | 处置 |
|---|---|---|---|---|---|
| homepage, album, original photo, keyboard and focus restoration | 首页两屏、相册导航、查看器键盘边界、焦点恢复；确认不读取/清除遗留 `lastPlayed` | 是 | 保留 | `src/app/App.tsx` 装配会话；`src/themes/*/ThemePages.tsx` 渲染首页/相册；`ThemeViewer.tsx` 渲染 dialog 与媒体 | 迁入导航与集成 |
| subpath refresh and invalid routes | 仓库子路径静态 404、相册刷新、非法 hash | 是 | 保留 | `scripts/serve-built.mjs` 无 SPA fallback；`src/app/router.ts` 解析 not-found | 迁入导航与集成 |
| display text and images cannot be selected or natively dragged | 全局 user-select 与图片 drag 限制 | 是 | 保留 | `src/app/global.css` 与两主题样式 | 迁入主题切换与隔离 |
| image failure can be retried without leaving the viewer | 图片失败态、重试按钮、dialog 保持 | 是 | 保留 | 两主题 `ThemeViewer.tsx` 的 loading/error/reload 舞台 | 迁入查看器 |
| rapid switching isolates slow image errors, close/reopen resets session | 快速切换隔离旧媒体请求，重开会话重置 | 是 | 保留 | `App.tsx` 唯一 Session；`ThemeViewer.tsx` 按 attempt 重挂载 | 迁入查看器 |
| dialog focus stays modal and route navigation disposes it | dialog 焦点圈闭、hash 变化释放会话 | 是 | 保留 | `App.tsx` hashchange 关闭 Session；`ThemeViewer.tsx` dialog 生命周期 | 迁入查看器 |
| viewer background closes while media and controls remain interactive in both themes | 背景关闭但图片、控件不误关 | 是 | 保留 | `ThemeViewer.tsx` 点击过滤与媒体舞台 | 迁入查看器 |
| responsive layout and real image loading | 主题头图资源加载、真实图片解码、无横向溢出 | 是 | 保留 | `mediaUrl()`、`PhotoImage.tsx`、构建媒体 | 迁入响应式与无障碍 |
| horizontal swipe navigates, vertical swipe does not | 查看器触屏横滑切换、纵滑不切换 | 是 | 保留 | `ThemeViewer.tsx` touch 处理 | 迁入查看器 |
| fullscreen enters and is released on close | 视频全屏建立与释放 | 是 | 保留 | `ThemeViewer.tsx` Fullscreen API | 迁入查看器 |
| fullscreen rejection leaves normal viewing usable | 全屏拒绝后查看器可用 | 是 | 保留 | `ThemeViewer.tsx` catch 后不终止会话 | 迁入查看器 |
| viewer has no theme switch and page theme switching keeps route and media | 查看器无主题切换；切主题保持路由与媒体 | 是 | 保留 | `ThemeViewer.tsx` 不渲染 switch；`App.tsx` 保持 Session | 迁入主题切换与隔离 |
| desktop wheel switches media, stays in bounds and keeps photo controls minimal | 桌面滚轮切换、边界与照片无视频控件 | 是 | 保留 | `ThemeViewer.tsx` wheel/cooldown；photo stage | 迁入查看器 |
| photo captions come from album metadata and stay optional | 相册寄语渲染、可点击不关闭、缺省不渲染 | 是 | 保留 | `public/media/photos/**/meta.json` 与 `ThemeViewer.tsx` caption | 迁入查看器 |
| phone and tablet viewers hide step buttons and give the photo the full width | 手机/平板隐藏上一项/下一项并全宽显示照片 | 是 | 保留 | 主题 CSS 与媒体查询 | 迁入查看器 |
| phone browse list opens the album and its viewer without horizontal overflow | 手机留影列表导航与查看器 | 是 | 保留 | `ThemePages.tsx` Browse/Album 页 | 迁入浏览列表 |
| phone browse album cards show only the album name with a text-hugging chip | 手机卡片只显示相册名、说明隐藏、底框贴合文字 | 是 | 保留 | `ThemePages.tsx` 与主题 CSS | 迁入浏览列表 |
| album detail hero shrinks to two thirds and shows at least four photos on phone and pad | 平板/手机相册 hero 与图集布局 | 是 | 保留 | `ThemePages.tsx` AlbumPage/CSS | 迁入浏览列表 |
| photo viewer has no close button at phone, tablet and desktop widths in both themes | 三端不渲染关闭按钮，Esc/背景退出 | 是 | 保留 | `ThemeViewer.tsx` 条件渲染关闭按钮 | 迁入查看器 |
| year navigation and type filter work on the browse page | 年份定位与类型筛选 | 是 | 保留 | `ThemePages.tsx` BrowsePage | 迁入浏览列表 |
| browse hero returns home in both isolated themes | 浏览页头图返回首页 | 是 | 保留 | `ThemePages.tsx` hero link | 迁入导航与集成 |
| phone hides the back links while tablet and desktop keep them | 返回入口响应式显示 | 是 | 保留 | `ThemePages.tsx` 与 CSS | 迁入导航与集成 |
| browse album cards stack top covers with depth in both themes | 相册卡三层错位封面 | 是 | 保留 | `ThemePages.tsx` AlbumCard/CSS | 迁入浏览列表 |
| album cards stack up to three photos and show album level metadata | 最多三层照片和相册元信息 | 是 | 保留 | content 数据与 `AlbumCard` | 迁入浏览列表 |
| interactive targets are at least 44px and pages never scroll horizontally | 交互目标尺寸与无横向溢出 | 是 | 保留 | 主题 CSS 与布局 | 迁入响应式与无障碍 |
| reduced motion collapses durations and focus ring stays visible | reduced-motion 下时长收敛、焦点环可见 | 是 | 保留 | app/global.css 与主题 CSS | 迁入响应式与无障碍 |
| thumbnail focus has no outline in either theme while keyboard opening remains available | 缩略图无外描边且键盘可用 | 是 | 保留 | `ThemePages.tsx` 样式/键盘行为 | 迁入响应式与无障碍 |
| media skeletons resolve into real images | 图片骨架解码后移除 | 是 | 保留 | 两主题 `PhotoImage.tsx` | 迁入响应式与无障碍 |
| theme decoration stays decorative and switchable | 主题切换控件装饰性图标与可达性 | 是 | 保留 | 两主题 ThemeSwitch | 迁入主题切换与隔离 |
| theme switch and background music controls coexist without overlap | 主题与音乐控件空间共存 | 是 | 保留 | `ThemePages.tsx`、`*MusicToggle.tsx`、CSS | 迁入背景音乐 |
| two-screen music controls share one audio while theme stays on the first screen | 两屏音乐入口共享同一 audio，切屏不切主题 | 是 | 保留 | `BeachMusicToggle.tsx`/`GrasslandMusicToggle.tsx`；`albums` 滚轮逻辑 | 迁入背景音乐 |
| page theme control scrolls with browse content and the viewer carries no theme switch | 浏览页主题控件随内容，查看器无切换 | 是 | 保留 | `ThemePages.tsx`、`ThemeViewer.tsx`、CSS | 迁入主题切换与隔离 |
| theme switch stays fixed only on phone-width browse pages | 手机浏览页 fixed，其他宽度不 fixed | 是 | 保留 | 主题 CSS | 迁入主题切换与隔离 |
| hero glass shows the LeYou eyebrow without any white edge | 首屏玻璃卡内容与无边框 | 是 | 保留 | `BeachApp.tsx`、`BeachGlass.tsx`、CSS | 迁入主题切换与隔离 |
| grassland independently renders every route and its viewer | 草原主题独立渲染全部路由和查看器 | 是 | 保留 | `GrasslandApp.tsx` 及草原文件 | 迁入主题切换与隔离 |
| both themes fill the approved desktop and mobile viewports | 两主题在批准视口铺满 | 是 | 保留 | 根布局与主题 CSS | 迁入主题切换与隔离 |
| home memory arrows, hover pause and two-screen boundaries stay consistent | 主回忆边界、悬停暂停和两屏切换 | 是 | 保留 | `src/albums/home-memory.ts` 与主题 HomePage | 迁入主回忆 |
| home screens meet without a divider and memory controls stay frosted | 两屏交界无分隔线，控件毛玻璃 | 是 | 保留 | `data-home-seam` 与 CSS | 迁入主回忆 |
| home memory photo pauses playback and never opens the viewer | 照片暂停主回忆且不打开查看器 | 是 | 保留 | `ThemePages.tsx` 播放按钮 | 迁入主回忆 |
| mobile memory hides arrows, swipes photos and keeps the two-screen flow | 手机主回忆滑动与两屏流 | 是 | 保留 | albums 纯逻辑 + HomePage | 迁入主回忆 |
| tablet memory hides arrows and changes photos by horizontal swipe | 平板主回忆横滑换图 | 是 | 保留 | albums 纯逻辑 + HomePage | 迁入主回忆 |
| desktop memory switches photos by mouse drag without pausing | 桌面拖动换图不暂停 | 是 | 保留 | albums 纯逻辑 + HomePage | 迁入主回忆 |
| trackpad horizontal swipe switches memory photos and keeps vertical switching | 触控板横向一次手势换图 | 是 | 保留 | `reduceHomeMemoryWheel` | 迁入主回忆 |
| music icon reveals a right-aligned volume control on hover and focus | 音乐按钮 hover/focus 展开音量 | 是 | 保留 | `*MusicToggle.tsx` 与 CSS | 迁入背景音乐 |
| mobile long press opens the volume control without toggling playback | 手机长按只固定音量 | 是 | 保留 | `*MusicToggle.tsx` 指针逻辑 | 迁入背景音乐 |
| background music preference survives reload and resumes on first interaction | 音乐偏好刷新恢复、首次交互播放 | 是 | 保留 | playback 偏好与 App effect | 迁入背景音乐 |
| review: returning to the foreground waits for explicit resumes | 前后台不自动恢复音乐 | 是 | 保留 | `setBackgroundMusicVisibility`、主题 effect | 迁入背景音乐 |
| review: <theme> unavailable localStorage still allows music controls | 存储禁用降级，音乐控件可用 | 是 | 保留 | App/playback/themes 的安全 storage | 迁入背景音乐 |
| review: <theme> skip link keeps the current route | 跳到主内容不改 hash | 是 | 保留 | 主题 skip link | 迁入响应式与无障碍 |
| review: <theme> focus and hover independently pause memory | 焦点与悬停独立暂停主回忆 | 是 | 保留 | HomePage 悬停/焦点状态 | 迁入主回忆 |
| review: <theme> explicit memory resume overrides the current hover | 显式恢复覆盖悬停暂停 | 是 | 保留 | HomePage override 生命周期 | 迁入主回忆 |
| review: <theme> theme switch does not isolate backdrop blur with a wrapper filter | 主题切换不破坏 backdrop-filter | 是 | 保留 | 主题容器与 CSS filter 层级 | 迁入主题切换与隔离 |

## 残留项处理

- 顶部常量与 `setTheme`、`enterAlbum`、`openFirst`、`viewerAt` 均被现存用例继续使用；拆分时迁入测试支撑文件，不删除断言。
- `localStorage.setItem('wangleyou.lastPlayed', 'legacy-value')` 不是旧功能残留：该用例随后断言其值保持不变，验证当前实现不再消费或清除“上次播放”。
- 桌面项目中 14 个条件跳过是设备能力边界（触屏、悬停、滚轮或全屏），不属于失效；移动项目对应的实现仍在验证。

## 覆盖衔接

本轮没有删除失效用例，因此无需为被删行为指定替代用例；拆分只迁移用例，不合并、不删除断言。

