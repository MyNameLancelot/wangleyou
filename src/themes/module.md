# themes 模块

## 目的

运行时主题选择和完整主题应用装配：提供 Beach、Grassland 两个互不依赖的站点 UI、主题读取、切换与偏好持久化。

## 职责

- `index.ts` 提供 `THEMES`、`DEFAULT_THEME`、`isThemeName`、`readTheme`、`applyTheme`、`nextTheme`、`initTheme` 与主题标签。
- `beach/`、`grassland/` 各自拥有完整 JSX、CSS、装饰与资产引用；目录间禁止导入，也不得消费共享 React UI。
- 两套主题均不渲染常驻全局顶部导航；各自在右下角实现毛玻璃主题开关：默认只显示 `lucide-react` 的循环图标，毛玻璃圆形仅包住图标（20px 图标配 32px 圆形），命中区域保持 44×44px，悬浮或键盘聚焦时展开为约 112px 胶囊并显示“主题切换”；玻璃表面不使用白色描边或高光边。
- 通过 `document.documentElement` 的 `data-theme` 切换模式，偏好写入 `localStorage` 的 `wangleyou.theme`。

## 非职责

不持有路由或播放状态，不保存除主题名以外的偏好；主题间不共享 UI 实现。

## 公开接口

- 函数契约：`applyTheme(name, root?, storage?)` 返回实际生效主题；`readTheme(storage?)` 缺省与非法值回退 `DEFAULT_THEME`（海边沙滩）；`nextTheme(current)` 在 `THEMES` 之间循环（海边 ↔ 草原）。
- `contracts.ts` 只定义无 UI 的主题应用输入和回调；各主题入口实现该契约。

## 允许依赖

可依赖 content、playback、albums 的公开无 UI 契约和 app 导出的路由类型；可依赖 `react-liquid-glass-svg`、`lucide-react` 等无状态展示库；不得依赖另一主题目录或共享 React UI。

## 状态与资源生命周期

状态只有"当前主题名"一项，来源是 `localStorage`，由 `App` 在渲染前调用 `initTheme()` 应用。存储不可用（隐私模式或禁用）时静默降级为无持久化，不创建监听或计时器。

## 主要文件

- `index.ts`：主题读写与切换；`contracts.ts`：无 UI 装配契约。
- `beach/`、`grassland/`：完全隔离的主题应用、悬浮主题开关、页面、查看器、图片状态、Token 与样式。
- `theme.test.ts`：默认回退、非法值、持久化、存储异常与循环切换。

## 扩展与验证

新增主题：创建独立主题目录，独立实现其站点 UI、CSS 与资产引用，再加入 `THEMES` 和标签并补齐主题及浏览器测试。只能导入无 UI 的公开领域契约，不能导入既有主题或共享 React UI。

验证至少覆盖：默认与非法值回退、存储异常、切换后路由/媒体/播放上下文保持、1440 与 390 视口、对比度、焦点可见、reduced-motion。
