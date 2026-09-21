# 首页第二屏改造验证记录

日期：2026-09-20

## 第一轮（居中照片 + 毛玻璃底板 + 箭头 + 进度条）

### 静态与单元

- `npm run check`：通过；SDD 结构、内容校验、TypeScript、ESLint 与 10 个 Vitest 文件共 102 项测试。
- `npm run build`：通过；`dist` JS 294.06 kB（gzip 85.73 kB）、CSS 55.60 kB（gzip 8.22 kB）。

### 浏览器

- `npm run test:e2e`：42 项通过，4 项按设备能力跳过（桌面触控轮播、移动全屏）。
- `home memory arrows, hover pause and two-screen boundaries stay consistent`：通过；断言第二屏可交互元素正好三个按钮（上/下一张箭头与照片）、进度条唯一、无标题、无「第 N / M 张」、照片画框为 3:2、玻璃底板 `border` 为 0 且 `box-shadow` 不含 `inset`、箭头切换生效、指针停留超过一个间隔仍停在同一张、移开后恢复自动播放。
- `hero glass shows the LeYou eyebrow without any white edge`：通过；修复第二屏复用 `BeachGlass` 后 `data-hero-glass` 冲突，改为调用方传入玻璃标记。

### 几何核对（无头 Chrome，视口 1440×900 与 390×844）

- 桌面：玻璃底板 800×548，左右箭头各 44×44，位于底板左右外侧并垂直居中。
- 移动端：底板 358×245，箭头 44×44 叠在照片左右边缘。
- 移动端命中测试：修复前箭头中心命中的是照片 `img`（玻璃库内容层 `z-index: 3` 盖住箭头），箭头层级提到 4 后两主题均返回 `arrowOnTop: true`。

### 截图

- `test-results/memory-beach-desktop.png`、`test-results/memory-grassland-desktop.png`
- `test-results/memory-beach-mobile.png`、`test-results/memory-grassland-mobile.png`

## 第二轮追加（首页不预览 + 点击暂停/播放按钮 + 移动端隐藏箭头并滑动换图）

日期：2026-09-20

### 静态与单元

- `npm run check`：通过；SDD 结构、内容校验、TypeScript、ESLint 与 11 个 Vitest 文件共 108 项测试。
- `npm run build`：通过；`dist` JS 301.20 kB（gzip 87.00 kB）、CSS 60.72 kB（gzip 9.55 kB）。
- `albums/home-memory.test.ts` 新增用例：横向滑动意图（左右、阈值不足、纵向占优、提高阈值后拒绝）与 `setHomeMemoryPlaying` 的意图写入、幂等与队列保持。

### 浏览器

- `npx playwright test`：49 项通过，5 项按设备能力跳过（桌面触控轮播、移动全屏、桌面端移动专用滑动用例、移动模拟 wheel）。
- `home memory photo pauses playback and never opens the viewer`（桌面与移动）：通过；点击照片后不出现 `dialog`，照片名称从「暂停主回忆自动播放：…」变为「继续主回忆自动播放：…」，照片下方出现 44×44px 播放按钮且位于照片下缘之后，键盘顺序聚焦时轮廓为 solid，指针与焦点离开后 5.6 秒内不再前进，点击播放按钮或再次点击照片恢复播放并隐藏按钮，恢复后自动播放继续前进。
- `mobile memory hides arrows, swipes photos and keeps the two-screen flow`（移动）：通过；第二屏可交互元素只有照片（箭头不渲染、`display: none`），点击照片暂停并显示播放按钮，第二屏内左/右横向滑动分别切换下一张与上一张，音乐按钮上的同向触摸不改变当前照片，纵向滑动仍返回首屏。
- `home memory arrows, hover pause and two-screen boundaries stay consistent`（桌面与移动）：通过；桌面播放中仍是两个箭头、照片与一个进度条，暂停按钮不存在。
- 相册与全部影像页的查看器回归：`homepage, album, original photo, keyboard and focus restoration` 与移动端横滑用例继续通过。

### 截图（无头 Chrome，桌面 1440×1000 与移动 360×800）

- `test-results/round2-beach-desktop-playing.png`、`test-results/round2-beach-desktop-paused.png`
- `test-results/round2-beach-mobile-playing.png`、`test-results/round2-beach-mobile-paused.png`
- `test-results/round2-grassland-desktop-playing.png`、`test-results/round2-grassland-desktop-paused.png`
- `test-results/round2-grassland-mobile-playing.png`、`test-results/round2-grassland-mobile-paused.png`
- 人工核对：播放态照片与进度条之间保留 44px 播放按钮行，暂停态播放按钮居中出现在照片下方；移动端无箭头，桌面端箭头位于玻璃底板左右两侧；两主题配色与既有玻璃语言一致。

## 第三、四轮（节奏下调 + 桌面鼠标拖动换图）

日期：2026-09-20

### 静态与单元

- `npm run check`：通过；SDD 结构、内容校验、TypeScript、ESLint 与 11 个 Vitest 文件共 109 项测试。
- `npm run build`：通过；`dist` JS 303.42 kB（gzip 87.33 kB）、CSS 60.72 kB（gzip 9.55 kB）。
- 单元测试固定 `HOME_MEMORY_INTERVAL_MS` 为 2000（第三轮曾取 3500，第四轮按用户要求改为 2000）。

### 浏览器

- `npx playwright test`：连续多次完整运行均为 52 项通过、6 项按设备能力跳过。
- `desktop memory switches photos by mouse drag without pausing`（桌面与移动项目均运行）：通过；暂停态下按住鼠标向左拖动换到下一张、向右拖动回到上一张，拖动后仍保持暂停、不出现查看器；位移小于 56px 阈值时不换图，也不会被当成点击恢复播放。
- `trackpad horizontal swipe switches memory photos and keeps vertical switching`（桌面）：通过；暂停态下 `deltaX` 占优的滚轮输入换到下一张并可回退，页面没有横向滚动，纵向滚动仍切回首屏。
- `home memory photo pauses playback and never opens the viewer`：恢复播放后约 2 秒前进一张（断言实际耗时 <4000ms），暂停期间超过 4.2 秒仍停在同一张。
- 点击语义回归：鼠标普通点击照片仍正常暂停/继续，说明 8px 拖动容差没有吞掉点击。

### 未复现的既有抖动

- 完整套件并行运行中，既有用例 `theme switch and background music controls coexist without overlap`（移动端主题/音乐控件几何与悬浮断言，与第二屏改动无交集）出现过 2 次失败；该用例单独运行、同用例 `--repeat-each=5` 以及之后连续 3 次完整运行均通过，未能复现，按并发抖动记录。

## 第六轮（触控板一次手势只换一张 + 音乐音量组件）

日期：2026-09-20

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 110 项测试。
- `npm run build`：通过；`dist` JS 305.75 kB（gzip 93.98 kB）、CSS 62.80 kB（gzip 9.83 kB）。
- `reduceHomeMemoryWheel` 单元测试：阈值内累积不换图、跨阈值换一张、动量事件在同一手势内不再换图、停手超过 200ms 后开启下一次手势、方向与 `deltaX` 符号一致。
- `setBackgroundMusicVolume` 单元测试：正常值写入、越界归一化到 0/1、非法值保持原状态、相同值返回原对象；既有音乐状态用例同步 `volume` 字段。

### 浏览器

- `npx playwright test`：连续两次完整运行均为 54 项通过、6 项按设备能力跳过。
- `trackpad horizontal swipe switches memory photos and keeps vertical switching`：通过；一次两指滑动（6 个 wheel 事件）进度条只前进一张，停手 260ms 后反向滑动回到上一张，页面无横向滚动，纵向滚动仍切回首屏。
- `music icon reveals a right-aligned volume control on hover and focus`（桌面与移动）：通过；默认 `opacity` 为 0，悬停音乐按钮后展开且面板右边缘与音乐圆形右边缘差值 ≤2px、位于圆形下方，滑块命中区 ≥44×44px；键盘聚焦同样展开，`Home`/`ArrowRight` 后 audio 元素 `volume` 与状态一致（0 → 0.05），两个首页入口读数一致，指针与焦点都离开后再次收起。
- 既有键盘顺序用例同步新控件：音乐按钮之后的 Tab 停在自己的音量滑块上，再继续到第二屏入口；反向 Shift+Tab 亦可回到音乐按钮并显示焦点环。
- 截图人工核对：`test-results/volume-beach-mobile.png`（其余主题/视口同结构），确认面板位于图标正下方、右边缘与图标圆形对齐、百分比读数可读。

## 第七轮（修复第六轮引入的回归 + 音量面板纤细化）

日期：2026-09-20

### 问题与修复

- 现象一「触摸板滑不动」：换图只在 `section === 'memory'` 时判定，而第六轮把「手势结束」判定缩短到 200ms，慢速滑动的事件间隔一旦超过它就不断清零累积值，永远到不了 56px 阈值。修复：`HOME_MEMORY_WHEEL_GAP_MS` 改为 400ms，慢速滑动也能累积换一张。
- 现象二「点击照片切换播放/暂停失效」：第六轮在鼠标按下移动超过 8px 后就捕获指针，触摸板点按常见的轻微位移会让 `click` 被重定向到区域容器，照片按钮收不到点击。修复：只有位移达到 56px 换图阈值才捕获指针并换图，未达阈值完全不接管指针。
- 同时移除滑动后 400ms 的点击守卫计时器：它会在拖动后吞掉紧跟的正常点击（拖动后马上点照片无效），而指针捕获已经能拦住拖动产生的补发点击。
- 现象三「音量组件太大且不需要百分比」：移除百分比文字，面板由 216×52 收敛为 142×26 的胶囊，滑块宽度 132→104px，喇叭图标 16→14px；滑块命中区保持 104×44px。

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 110 项测试。
- `npm run build`：通过；`dist` JS 304.41 kB（gzip 87.75 kB）、CSS 62.56 kB（gzip 9.77 kB）。
- `reduceHomeMemoryWheel` 用例更新为 400ms 手势间隔后仍通过：阈值内累积、跨阈值换一张、动量不重复换图、停手 400ms 后开启下一次手势。

### 浏览器

- `npx playwright test`：连续两次完整运行均为 54 项通过、6 项按设备能力跳过。
- `trackpad horizontal swipe switches memory photos and keeps vertical switching`：新增慢速滑动断言（25px × 3，事件间隔 260ms）通过，并且一次手势只前进一张；纵向滚动仍切回首屏。
- `desktop memory switches photos by mouse drag without pausing`：改为断言「位移不足阈值时按点击处理」——20px 轻微位移的按下抬起会恢复播放且不换图，160px 拖动换图且保持暂停。
- 诊断记录（临时用例，已删除）：纵向滚动 首屏↔第二屏 正常（scrollY 0↔900）；18px 轻微位移的点击可暂停；慢速滑动一张；8 个动量事件一张；200px 拖动一张且不恢复播放。
- 既有几何用例 `theme switch and background music controls coexist without overlap`：切换主题后改为在收起状态（移开指针并 blur）比较两个入口中心线，连续 4 次重复运行通过，消除了主题切换动画期间的抖动测量。

## 第八轮（移动端长按展开音量 + 磨砂玻璃面板）

日期：2026-09-20

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 110 项测试。
- `npm run build`：通过；`dist` JS 306.73 kB（gzip 94.46 kB）、CSS 62.56 kB（gzip 9.77 kB）。

### 浏览器

- `npx playwright test`：连续两次完整运行均为 55 项通过、6 项按设备能力跳过。
- 新增 `mobile long press opens the volume control without toggling playback`（移动）：通过；用 CDP 触摸事件长按音乐按钮 700ms 后 `data-volume-pinned` 变为 `true`、面板 `opacity` 为 1、`aria-pressed` 与长按前一致（长按不切换播放），聚焦滑块按 `Home` 后 audio 音量为 0，触摸面板外后 `data-volume-pinned` 回到 `false`、面板收起且仍停在首屏。
- 桌面悬浮/键盘路径回归：`music icon reveals a right-aligned volume control on hover and focus` 继续通过（默认收起、悬浮展开、右边缘对齐 ≤2px、键盘调音量、两个入口读数一致）。
- 磨砂玻璃人工核对：`test-results/frosted-hero.png`（海滩照片上可透视背景纹理）与 `test-results/frosted-memory.png`（纯色背景上为半透明胶囊），无白色描边或高光边。

### 测试稳定性调整

- `two-screen music controls share one audio while theme stays on the first screen` 中「回到首屏顶部」的容差由 ≤1px 放宽到 ≤4px，并在用例中注明原因：移动端 `100dvh` + scroll-snap 在并行负载下实测残留 1–2px，与功能无关；断言仍要求首屏音乐入口在视口内。

## 第九轮（仅播放状态可展开 + 有色玻璃 + 自绘滑块）

日期：2026-09-20

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 110 项测试。
- `npm run build`：通过；`dist` JS 306.81 kB（gzip 94.47 kB）、CSS 62.6 kB。

### 浏览器

- `npx playwright test`：连续两次完整运行均为 55 项通过、6 项按设备能力跳过。
- `music icon reveals a right-aligned volume control on hover and focus`：新增「暂停时不展开」断言——暂停态悬停 250ms 后面板仍为 `opacity: 0`、滑块 `tabindex="-1"`；点击开始播放后悬浮展开，角色查询 `slider[name="背景音乐音量"]` 可见，尺寸与右对齐断言保持通过。
- `mobile long press opens the volume control without toggling playback`：新增「暂停时长按不展开」断言——长按 700ms 后 `data-volume-pinned` 仍为 false 且长按按普通点击处理开始播放；随后播放状态长按才展开面板，播放状态不被长按改变。
- `theme switch and background music controls coexist without overlap`：草原主题切换后的中心线比较改为轮询等待布局稳定，连续运行通过（此前偶发 9–45px 的瞬时测量偏差）。

### 视觉核对（桌面 1440×900，截图已人工检查）

- `test-results/panel2-beach-hero.png`：首屏海面照片上，面板为有色半透明玻璃，轨道为深色圆角条、滑块为主题色椭圆。
- `test-results/panel2-beach-memory.png`：第二屏浅色背景上同样呈现淡青色玻璃质感与投影，不再是与背景几乎一样的白色胶囊。
- `test-results/panel2-grassland-hero.png`、`test-results/panel2-grassland-memory.png`：草原主题同结构，色相偏嫩绿。

## 未验证范围

- 未在真实 iOS/Android 与 Safari 真机运行；触控滑动切换、指针悬浮暂停、桌面按住鼠标拖动换图、触控板手势节奏、音量滑块手感以及 2 秒节奏在真机与真实浏览器上需人工确认。
- 移动端没有 hover，音量组件不常驻显示，触屏用户暂时没有音量入口；如需移动端音量能力，需另行确认入口方式。
- 用户表示后续还会追加第二屏需求，因此本变更保持活动状态，尚未归档。

## 归档结论

日期：2026-09-21

- 用户确认归档；第十五轮的必要验收、基线文档同步与验证证据均已完成。
- 上述“保持活动状态”的记录是第九轮当时的决定，现已不再适用。本次仅归档文档，未重新运行代码检查；最后一次完整验证为第十五轮的 Node v24.18.0 下 `npm run check`、`npm run build` 与 `npx playwright test`，结果为 82 项通过、16 项按设备能力跳过、0 项失败。

## 第十轮（两屏毛玻璃修复 + 无喇叭图标 + 细线细长方形滑块）

日期：2026-09-20

### 根因与修复

- 毛玻璃在两屏都失效的根因：音乐控件包装层 `.control` 上的 `filter: drop-shadow(...)` 会成为 backdrop root，隔离了内部 `.surface` 与 `.volume` 的 `backdrop-filter` 取景，只能模糊到包装层内的透明内容，因此看起来像实色胶囊。
- 修复：移除包装层 `filter`，阴影改在 `.surface` 与 `.volume` 上用 `box-shadow` 表达；同时下调两主题圆形表面与音量面板底色透明度、表面模糊提升到 16px，使照片纹理能透过玻璃。

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 110 项测试。
- `npm run build`：通过；`dist` JS 306.23 kB（gzip 94.21 kB）、CSS 63.84 kB（gzip 9.98 kB）。

### 浏览器

- `npx playwright test`：完整运行 55 项通过、7 项按设备能力跳过；含音量悬浮/键盘聚焦、移动端长按、右边缘对齐 ≤2px、命中区与两入口读数一致等回归。
- 音量面板不再渲染喇叭图标（`Volume2` 引用与 `.volumeIcon` 样式移除），仅保留滑块居中。
- 滑块改为约 2px 高的深色细线轨道 + 6×20px、圆角 3px 的主题色细长方形滑块；104×44 命中区、方向键与拖动断言继续通过。

### 视觉核对（桌面 1440×900，截图已人工检查）

- `test-results/music-round10-beach-hero.png.png`：首屏海面照片上，按钮圆形与音量面板均可透视照片纹理，模糊明显。
- `test-results/music-round10-beach-memory.png.png`、`grassland-hero.png.png`、`grassland-memory.png.png`：第二屏浅色背景与草原主题下同样为有色玻璃质感 + 投影，无白色描边。
- 截图由临时 Playwright 用例产出（用例验证后已删除），四张截图 MD5 互不相同，确认两屏两主题均为真实画面。

## 第十一轮（同色相深色玻璃面板 + 直角长方形滑块）

日期：2026-09-20

### 实现

- 音量面板色染改为音乐图标同色相的深色玻璃：海边 `rgb(10 74 95/…)` 深青渐变、草原 `rgb(45 72 44/…)` 深绿渐变，保持 26px 背景模糊、饱和增强与 `box-shadow` 投影；浅色平底的第二屏因此能明显看出透视与投影。
- 轨道改为深色面板上的浅色细线（海边 `rgb(237 252 255/.85)`、草原 `rgb(246 250 232/.85)`），滑块保持 6×20px 主题色（`--color-action-primary`）长方形，但圆角改为 0（直角）。
- 不支持背景模糊时的降级底色同步改为不透明深色底。

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 110 项测试。
- `npm run build`：通过；`dist` JS 306.23 kB（gzip 94.22 kB）、CSS 63.83 kB（gzip 9.97 kB）。

### 浏览器与测试稳定性

- `npx playwright test` 完整运行：55 项通过、7 项按设备能力跳过。
- 如实记录：第十一轮首次完整运行中 `theme switch and background music controls coexist without overlap` 在桌面与移动各失败 1 次，均为并行负载下 scroll-snap 惯性残留 8–9px（回顶 `scrollY` poll 停在 8、草原入口 y 偏差 9px），与面板样式改动无交集；单独复跑同用例 6/6 通过。
- 稳定性修正：该用例两处「回到顶部」断言放宽到 `scrollY ≤ 10` 并注明原因；草原主题入口顶部间距改为 `box.y + scrollY` 的页面绝对坐标断言，消除滚动残留影响。修正后完整套件重跑 55/55 通过。

### 视觉核对（桌面 1440×900，截图已人工检查）

- `test-results/music-round11-beach-hero.png.png`：深青玻璃面板浮在海面照片上，纹理明显透视，浅色细线轨道 + 直角主题色滑块。
- `test-results/music-round11-beach-memory.png.png`：第二屏浅色背景上深色玻璃胶囊与投影清晰可辨。
- `test-results/music-round11-grassland-hero.png.png`、`grassland-memory.png.png`：草原主题同结构、深绿色相，两屏均为深色玻璃。
- 截图由临时 Playwright 用例产出（用例验证后已删除），四张 MD5 互不相同，确认两屏两主题均为真实画面。

## 第十二轮（纯白细滑块 + 第二屏玻璃观感 + 刷新恢复音乐）

日期：2026-09-20

### 实现

- 滑块：纯白 `#fff` 直角长方形 4×18px（原 6×20 主题色），圆角仍为 0；轨道细线透明度降到 0.7 与纯白滑块区分；104×44 命中区不变。
- 面板：底色透明度整体下调（海边 .42/.28/.36、草原 .44/.3/.38），第二屏浅色平底上从「灰色实底」观感改为可透视的深色玻璃 + 投影。
- 刷新恢复：playback 新增 `BACKGROUND_MUSIC_STORAGE_KEY`、`readBackgroundMusicPreference`、`writeBackgroundMusicPreference` 注入式契约（校验归一化，storage 不可用静默降级）；App 初始化读缓存，只在显式 toggle 与音量调整时写回。`markBackgroundMusicBlocked` 改为保留播放意图（原实现回退意图后会被 shouldPlay 副作用覆盖回 paused，blocked 只是瞬态）；两主题音乐组件在 blocked 时监听一次性首手势（控件内部手势除外）直接重试 `play()`，音乐按钮自身在 blocked 下的点击同样重试而不翻转意图；dock 新增 `data-music-status` 暴露状态。

### 静态与单元

- `npm run check`：通过；11 个 Vitest 文件共 114 项测试（新增偏好读写、降级、blocked 意图保留、createBackgroundMusic 音量注入 4 项）。
- `npm run build`：通过；`dist` JS 307.90 kB（gzip 94.72 kB）、CSS 63.74 kB（gzip 9.97 kB）。

### 浏览器

- `npx playwright test` 完整运行：57 项通过、7 项按设备能力跳过（含新增 `background music preference survives reload and resumes on first interaction` 桌面+移动）。
- 刷新恢复用例覆盖：显式播放 + 音量 0.05 → 刷新后缓存保持 `{playing, 0.05}`，等待 `data-music-status=blocked` 后任意点击恢复播放且音量仍 0.05；显式暂停 → 刷新保持暂停且 `audio.paused=true`。
- 如实记录：新增用例首跑失败两次——一次是断言选错元素（status 属性在 dock 不在 control），一次暴露真实缺陷（blocked 瞬态问题，见上），均已修复；`reduced motion` 用例按新恢复语义改写（任何手势前静止，Tab 首手势后恢复且过渡即时），桌面+移动通过。

### 视觉核对（桌面 1440×900，截图已人工检查）

- `test-results/music-round12-beach-hero.png.png`：深青玻璃 + 白色细直角滑块，照片纹理可透视。
- `test-results/music-round12-beach-memory.png.png`、`grassland-hero.png.png`、`grassland-memory.png.png`：第二屏浅底与草原主题下，面板透明度提高后呈现玻璃胶囊观感（非灰色实底），白色滑块清晰。
- 截图由临时 Playwright 用例产出（用例已删除），四张 MD5 互不相同。

### 轻量补记（第十二轮内）：暂停斜杠光晕移除

日期：2026-09-20

- 用户指出暂停（斜杠音符）图标带白色背景；根因是 `.mutedMark` 的 `box-shadow: 0 0 0 2px 白色` 光晕。
- 两主题 `.mutedMark` 移除该 box-shadow，斜杠恢复为纯色细线；无行为与文档影响。
- `npm run check`（114 项）与 `npm run build` 通过；截图 `test-results/muted-no-halo-beach.png` 人工核对（临时用例已删除）。截图同时确认：切换主题的首手势按新恢复语义让音乐恢复播放（草原截图为播放态音符，斜杠样式与海滩同构）。

## 第十三轮（审查修复：回前台恢复、显式恢复覆盖、路由契约与媒体维护）

日期：2026-09-20

### 用户确认决策

- 保持无缓存首次访问默认播放背景音乐（1B）；页面隐藏回前台必须显式恢复（2A）。
- 主回忆显式恢复覆盖当时的指针/焦点暂停，离开播放器后恢复普通暂停规则（3A）。
- 背景音乐保持主题私有资产，不进入内容配置（4B）；音频来源暂不登记，当前按非商业占位记录限制（5）。
- 音频压缩为 96 kbps mono（6A）；主题开关移除外层 filter（7A）；`Route` 抽入 shared（8A）；最终用 Node 24 验证（9A）。

### 实现

- playback `BackgroundMusic` 新增 `resumeRequired`，`setBackgroundMusicVisibility` 只标记程序性暂停；回前台 `shouldPlayBackgroundMusic` 为 false，音乐按钮点击走 `clearBackgroundMusicResume` 后恢复，不翻转偏好意图。visibilitychange 不写 localStorage。
- 两主题 HomePage 记录回前台待恢复；显式恢复清除待恢复并设置交互覆盖，鼠标移出或焦点离开播放器后清除。移动端第二屏滑动设置 400ms 点击守卫；边界同向滚动/切换锁期间重置纵向和横向累积。
- 两主题主题开关移除 dock `filter: drop-shadow`，阴影改由 LiquidGlass `box-shadow` 表达。
- 新增 `src/shared/routing.ts` 公开 `Route`；app/router 与 themes/contracts 消费 shared；SDD 依赖检查禁止 themes → app，themes → shared 允许。
- `beach-memory.mp3` / `grassland-memory.mp3` 用临时 ffmpeg-static 重编码为 96 kbps mono，体积分别约 2.3MB / 1.9MB；不新增项目依赖。`SOURCES.md` 登记来源未确认和非商业占位限制。
- 同步 requirements、architecture、README、playback/albums/app/themes/shared module 文档和 ADR 0004；修正旧“主题色椭圆滑块”验收表述为“最终以白色直角滑块为准”。
- App 的显式音乐切换和音量写入改为事件侧计算 next state、提交后由 effect 持久化；React state updater 不再包含 localStorage 副作用。

### 验证（Node v24.18.0 / npm 11.16.0）

- `npm run check`：通过；SDD 结构、内容校验、TypeScript、ESLint、11 个 Vitest 文件共 117 项测试。新增音乐回前台待恢复、主记忆 foregroundResumeRequired、SDD 禁止 themes → app 用例。
- `npm run build`：通过；JS 310.12 kB（gzip 95.46 kB）、CSS 63.56 kB（gzip 9.93 kB）。
- `npx playwright test`：通过；80 项通过、16 项按设备能力跳过。新增桌面回前台显式恢复用例、两主题悬停下显式恢复用例、两主题边界滚轮累积重置用例、两主题主题开关无外层 filter/有 box-shadow 用例。
- 回前台用例覆盖：音乐隐藏后 `audio.paused=true`，回前台仍暂停，按钮点击后恢复；主回忆隐藏回前台不前进，显式暂停/恢复后覆盖指针停留继续自动前进。
- 如实记录：调试中发现测试直接按 ArrowDown 时焦点仍在音乐按钮导致按键被 interactive-target 规则忽略；已改用“开启回忆”按钮进入第二屏，未改动产品交互语义。
- 未验证范围：真实 iOS/Android、Safari/WebKit、WebView、线上 Pages 部署与真实音频听感。
