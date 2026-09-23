# 网站整体细节修复计划

本计划持续追加“网站整体细节修复”的已确认条目；不覆盖或删除既有条目。

## SD-001 全站默认禁止选择展示文字与图片

### 影响模块

- `src/app/global.css`：全站基础选择与图片拖拽规则。
- `src/app/module.md`：app 全局样式职责说明。
- `docs/requirements.md`：产品级视觉与交互基线。

### 依赖顺序

1. 记录已确认行为、例外与验收条件。
2. 在全局样式实现 CSS 规则。
3. 同步产品与模块基线。
4. 运行静态检查、构建和浏览器行为核对，并记录真实结果。

### 实施步骤

1. 在 `body` 添加默认文字不可选择规则。
2. 为 `img` 添加不可选择和 `-webkit-user-drag: none`。
3. 为 `input`、`textarea` 与 `[contenteditable="true"]` 恢复文字选择。
4. 更新 app 模块职责和需求基线；不更改主题文件。

### 验证方式

- `npm run check`
- `npm run build`
- 使用静态构建产物，在 Chromium 桌面与 360px 移动视口核对文字选择、图片原生拖拽、焦点环和主题切换。

### 回退方式

移除本条在 `global.css` 的三组规则并还原本条基线文字即可；不会影响主题文件、内容配置或运行时状态。

## SD-002 留影页返回首页入口

### 影响模块

- `src/themes/beach/ThemePages.tsx`、`src/themes/beach/ThemePages.module.css`：海边主题的独立链接与样式。
- `src/themes/grassland/ThemePages.tsx`、`src/themes/grassland/ThemePages.module.css`：草原主题的独立链接与样式。
- `tests/browsing.spec.ts`：两个主题的链接存在、路由跳转、尺寸与移动端无溢出断言。
- `docs/requirements.md`、`src/themes/module.md`：页面导航基线与主题职责。

### 依赖顺序

1. 追加已确认的交互语义与验收条件。
2. 分别在两个主题的 `BrowsePage` hero 内容层增加 Hash 链接。
3. 分别在两个主题 CSS 定义链接尺寸、位置与可读性。
4. 扩展 E2E 并运行检查、构建与浏览器验证。

### 实施步骤

1. 在每个 `BrowsePage` 的 `.browseHeroCopy` 内、`h1` 前插入 `<a href="#/">← 返回首页</a>`。
2. 在两个主题各自的 `.browseBack` 中声明 `inline-flex`、44px 最小高度、主题前景色与标题间距；不引用另一主题样式。
3. 使用 Playwright 在两个主题验证名称、位置、Hash 跳转、最小高度与 360px 无横向溢出。
4. 同步需求和 themes 模块基线，并将实际验证结果写入 `change.json`。

### 验证方式

- `npm run check`
- `npm run build`
- `npm run test:e2e`

### 回退方式

删除两个主题的链接与 `.browseBack` 规则，并还原本条 E2E 与基线文字；Hash 路由和其他页面不受影响。

## SD-003 查看器仅允许显式关闭

### 影响模块

- `src/themes/beach/ThemeViewer.tsx`：海边原生 dialog 取消处理。
- `src/themes/grassland/ThemeViewer.tsx`：草原原生 dialog 取消处理。
- `tests/browsing.spec.ts`：两套主题的空白点击、导航按钮与显式关闭断言。
- `docs/requirements.md`、`src/themes/module.md`：查看器关闭语义基线。

### 依赖顺序

1. 记录用户确认的唯一关闭入口。
2. 分别在两个主题查看器生命周期内注册原生 `cancel` 监听器阻止默认关闭，并在卸载时清理；不依赖 React 合成事件。
3. 在 E2E 覆盖空白、导航、按钮和 Esc 的关闭/不关闭边界。
4. 同步基线并运行检查、构建与浏览器验证。

### 实施步骤

1. 在两个主题的 `<dialog>` 所属组件中以 `useEffect` 注册原生 `cancel` 监听器，调用 `event.preventDefault()` 并在 cleanup 中移除；删除 React `onCancel`。
2. 增加 Playwright 用例：打开首张图片后点击舞台上方空白处仍打开，点击下一项仍打开且位置为 2，Esc 关闭；在两个主题重复。
3. 更新 requirements、themes module、任务状态与实际验证记录。

### 验证方式

- `npm run check`
- `npm run build`
- `npm run test:e2e`

### 回退方式

恢复两个主题 `onCancel` 的关闭命令及本条测试与基线文字即可；不影响查看器会话、媒体或路由。

### SD-003 更正实施步骤：背景点击关闭

1. 两个主题的 `<dialog>` 添加点击分流：事件源位于 `img`、`video` 或任一交互控件内时保留原操作，其他背景点击调用 `commands.close()`。
2. E2E 改为断言背景点击关闭；重新打开后断言图片与“下一项”不关闭，Esc 继续关闭。
3. 同步 requirements 和 themes module 的关闭入口基线，并追加真实验证结果。

## SD-004 缩略图卡片移除红色外焦点框

### 影响模块

- `src/themes/beach/ThemePages.module.css`：海边缩略图焦点视觉。
- `src/themes/grassland/ThemePages.module.css`：草原缩略图焦点视觉。
- `tests/browsing.spec.ts`：两个主题的外框移除与内部焦点提示断言。

### 实施步骤

1. 两个主题分别关闭 `.mediaTile:focus-visible` 的默认 outline，不添加替代描边。
2. 验证外框与图片内部描边均不存在，且原有查看器入口仍可用。

### 验证方式

- `npm run check`
- `npm run build`
- `npm run test:e2e`

### 回退方式

移除两个主题 `.mediaTile:focus-visible` 的局部规则，即回到原全局焦点环；不影响交互逻辑。

## SD-005 移动端留影页顶部固定

在两个主题的 ≤600px 私有 CSS 中固定 hero 与年份导航，并为列表添加相应顶部留白；以 Playwright 360px 滚动验证位置、可用性和无溢出。

补充实施：将年份标签与按钮滚动区拆分为主题私有的两个子元素；外层保持标签可见，内层只承载按钮并横向滚动，避免标签背景覆盖首个年份。

补充实施：在 ≤600px 的固定年份导航外层使用主题画布底色，建立不透明遮罩层；标签和按钮滚动区不再各自设置底色。

更正实施：遮罩改用各主题私有 App shell 底色，并将其上缘对齐 hero 底部；以顶部内边距保持年份按钮原来的视觉纵坐标，避免 hero 与导航之间出现透明缝隙。

补充实施：提高固定 hero 的层级，使其承载的筛选胶囊绘制于年份导航遮罩之上；年份遮罩仍高于可滚动列表。

补充实施：仅在 ≤600px 为 `.yearGroup` 设置等于完整固定区高度的 `scroll-margin-top`，使原生 `scrollIntoView` 定位到可见区域；通过点击 2028 后核对其标题顶部位置验证。

## SD-009 首页主回忆手动换图重置自动轮播

在 albums 无 UI interval 控制器中增加“仅运行中才重启”的公开操作：清理旧 interval 后登记新 interval。两个主题各自以私有 `changeMemory` 回调统一所有手动换图入口，在更新图片前调用该操作；自动 tick 仍直接推进状态，不重置自身周期。补充纯逻辑测试验证运行/暂停两种情况，并运行类型检查、单元测试与构建。

## SD-010 手机与平板查看器隐藏切换按钮并使用全部宽度

两套主题各自在其私有查看器 CSS 中处理：≤1199px 隐藏上一项/下一项按钮，去掉查看器与照片舞台的横向内边距，并让照片占满可用宽度。窄屏与触摸设备规则只保留上下安全区，不再回写横向留白。验证方式为 360×800 与 1024×768 两个视口的 Playwright 用例：断言按钮数量为 0、舞台左右边界与查看器一致、舞台横向内边距为 0、手机竖屏下照片宽度等于舞台宽度、图片仍为 `object-fit: contain`，并断言横滑仍能切到下一项。回退方式为删除上述媒体查询规则并还原用例。

## SD-011 照片查看模式移除关闭按钮

### 影响模块

- `src/themes/beach/ThemeViewer.tsx`：海边查看器的关闭按钮渲染条件与 Tab 焦点兜底。
- `src/themes/grassland/ThemeViewer.tsx`：草原查看器的同名两处。
- `tests/browsing.spec.ts`：三端无按钮、Esc 与背景关闭、焦点留在模态内的断言。

### 依赖顺序

1. 按媒体类型收窄关闭按钮的渲染条件。
2. 在 Tab 处理中为“没有可聚焦控件”补充就地保留焦点的分支。
3. 调整依赖该按钮的既有用例，并新增三端专项用例。
4. 运行构建与完整 Playwright 套件，记录真实结果。

### 实施步骤

1. 两个主题各自把关闭按钮改为 `{!photo && <button …/>}`，视频与空状态保持原样。
2. 两个主题的文档级 Tab 分支在 `focusables.length === 0` 时 `preventDefault()` 并聚焦查看器本身。
3. 既有用例中依赖照片模式关闭按钮的三处改为 Esc 或黑色背景点击。
4. 新增用例覆盖海边、草原 × 360/1024/1440 三种宽度。

### 验证方式

- `npm run build`
- `npx playwright test tests/browsing.spec.ts`

### 回退方式

恢复关闭按钮的无条件渲染并移除 Tab 兜底分支即可；其余查看器行为不受影响。

## SD-012 手机与平板相册详情压缩首幅并缩小图集

### 影响模块

- `src/themes/beach/ThemePages.module.css`：海边详情页首幅与图集的移动/平板样式。
- `src/themes/grassland/ThemePages.module.css`：草原主题的同名样式。
- `tests/browsing.spec.ts`：三视口首幅高度、列数、首屏可见张数与字号断言。

### 实施步骤

1. 新增 `@media (min-width:601px) and (max-width:1199px)` 私有块：首幅 `min-height: clamp(253px,33dvh,333px)`、首幅内边距与字号收紧、图集三列。
2. 在既有 ≤600px 块内把首幅改为 `min-height: 280px`，收紧首幅间距与字号，并把图集设为两列。
3. 把 ≤390px 块的图集列数从 1 改为 2，避免极窄手机退回单列大图。
4. 以 390×844、820×1180、1024×768、1440×900 四个视口测量首幅高度、列数与首屏完整可见张数，并人工核对截图。

### 验证方式

- `npm run build`
- `npx playwright test tests/browsing.spec.ts`

### 回退方式

删除新增的平板媒体块、还原 ≤600px 与 ≤390px 的首幅与图集声明即可；不涉及数据与交互逻辑。

### SD-012 更正实施

1. 两个主题的详情页缩略图容器把 `min-height: 150px` 改为 `0`，让容器高度由图片自身比例决定。
2. 平板媒体块首幅改 `clamp(202px,26.4dvh,266px)`，手机首幅改 `224px`，两级断点的标题、副标题、引言与返回入口字号整体乘 0.8。
3. 手机（≤600px）与 ≤390px 的图集列数从 2 改为 3。
4. 追加断言：容器高度与图片高度差 ≤1px。

## SD-013 手机端隐藏返回入口并重新居中 hero 文案

### 影响模块

- `src/themes/beach/ThemePages.module.css`、`src/themes/grassland/ThemePages.module.css`：≤600px 私有块中的两处入口隐藏与 hero 文案偏移。
- `tests/browsing.spec.ts`：手机隐藏、平板/桌面保留与文案边界断言。
- `docs/requirements.md`、`src/themes/module.md`：页面导航基线与主题职责同步。

### 实施步骤

1. 在 ≤600px 块中把 `.browseBack`、`.detailBack` 设为 `display: none`。
2. 同块内把留影页文案顶部偏移设为 46px、详情页首幅文案设为 36px，使其在剩余高度内居中。
3. 更新依赖该入口的既有用例：手机端改为断言入口隐藏并使用直接导航，平板与桌面保留 44px 命中区断言。
4. 以 360/390/820/1440 四视口核对可见性与文案边界。

### 验证方式

- `npm run build`
- `npx playwright test tests/browsing.spec.ts`

### 回退方式

删除两处 `display: none` 并把文案偏移还原为 16px 即可恢复入口与原始布局。

## SD-014 手机端留影页相册卡片只渲染相册名

### 影响模块

- `src/themes/beach/ThemePages.module.css`、`src/themes/grassland/ThemePages.module.css`：≤600px 相册卡片说明条。
- `tests/browsing.spec.ts`：手机端说明隐藏与底色框贴合的断言。
- `docs/requirements.md`、`src/themes/module.md`：留影页相册卡片基线。

### 实施步骤

1. 在 ≤600px 块内把 `.browseAlbumLayer .mediaBar` 改为 `right: auto; width: fit-content` 并给右上角圆角。
2. 同块内隐藏 `.browseAlbumLayer .mediaText`，并把 `.mediaAlbum` 的右外边距、分隔线与降低的不透明度去掉。
3. 追加断言：文字区域不可见、底色框宽度介于文字宽度与卡片宽度之间、相册名无右边框。

### 验证方式

- `npm run build`
- `npx playwright test tests/browsing.spec.ts`

### 回退方式

移除该三条手机端规则即可恢复铺满卡片的“相册名 + 说明”说明条。

## SD-015 评审修复

### 影响模块

- `src/themes/beach/ThemeViewer.tsx`、`src/themes/grassland/ThemeViewer.tsx`：影像展示文字的点击放行标注。
- `src/themes/beach/ThemePages.module.css`、`src/themes/grassland/ThemePages.module.css`：缩略图焦点替代指示与留影页固定高度变量。
- `src/themes/beach/ThemePages.tsx`、`src/themes/grassland/ThemePages.tsx`：`restart()` 同步原因注释。
- `tests/browsing.spec.ts`：状态面板与寄语点击不关闭、缩略图替代焦点指示断言。

### 实施步骤

1. 两个主题给状态面板、加载提示、结束/无封面提示与寄语文字加 `data-viewer-controls`（海岸视频元信息行同样处理）。
2. 缩略图 `:focus-visible` 用提亮加轻微上浮替代描边，并保留 `outline: none`。
3. 手机端留影页把 222px 与 84px 提取为 `--browse-hero-height`、`--browse-year-nav-height`，由它们推导 `yearNav` 顶边与 `browseBody` 顶部留白。
4. 在两个主题的 `changeMemory` 补注释，说明 `restart()` 必须在状态更新前同步执行。
5. 扩展用例：状态面板文字点击后仍打开、寄语点击后仍打开且位置不变；缩略图聚焦时断言 `filter` 与 `transform`。

### 验证方式

- `npm run check`
- `npm run build`
- `npx playwright test tests/browsing.spec.ts`

### 回退方式

移除新增的 `data-viewer-controls` 标注、还原 `:focus-visible` 规则与写死的 222px/84px 即可；不涉及状态与数据。

## SD-008 手机主题切换按钮固定

两个主题分别在其 App 私有 CSS 的 ≤600px 媒体查询中将现有主题按钮容器改为 fixed；复用既有 page/home 纵向定位类，保持 >600px 的 absolute 定位不变。以浏览器在 360px 与 900px 视口核对位置与滚动行为。
