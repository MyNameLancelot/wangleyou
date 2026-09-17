# themes 模块

## 目的

运行时主题设计变量与主题选择：把 Penpot 已确认的三套模式（Default、Beach、Grassland）映射为语义 CSS 自定义属性，并提供读取、切换与偏好持久化。

## 职责

- `tokens.css` 提供跨主题稳定的 Token（字体、间距、形状、高度、动效、布局、媒体查看器）与三套颜色模式。
- `index.ts` 提供 `THEMES`、`isThemeName`、`readTheme`、`applyTheme`、`nextTheme`、`initTheme` 与主题标签。
- 通过 `document.documentElement` 的 `data-theme` 切换模式，偏好写入 `localStorage` 的 `wangleyou.theme`。

## 非职责

不承载任何业务 UI、路由或播放状态；不实现主题专属的业务组件；不保存除主题名以外的偏好。

## 公开接口

- 变量契约：颜色 `--color-*`、字体 `--font-*`、间距 `--space-*`、形状 `--radius-*`、高度 `--shadow-*`、动效 `--motion-*`、媒体查看器 `--media-viewer-*`。
- 函数契约：`applyTheme(name, root?, storage?)` 返回实际生效主题；`readTheme(storage?)` 缺省与非法值回退 `default`；`nextTheme(current)` 按 `THEMES` 顺序循环。
- `THEME_LABELS` / `THEME_SHORT_LABELS` 供界面显示名称。

## 允许依赖

无业务模块依赖。

## 状态与资源生命周期

状态只有"当前主题名"一项，来源是 `localStorage`，由 `App` 在渲染前调用 `initTheme()` 应用。存储不可用（隐私模式或禁用）时静默降级为无持久化，不创建监听或计时器。

## 主要文件

- `tokens.css`：三套模式与稳定 Token。
- `index.ts`：主题读写与切换。
- `theme.test.ts`：默认回退、非法值、持久化、存储异常与循环切换。

## 扩展与验证

新增主题：先在 Penpot 建立 mode 集合并映射全部语义 Token，再在 `tokens.css` 增加一个 `[data-theme='<name>']` 块并加入 `THEMES`，最后补一条 `theme.test.ts` 用例。变量名不得引入主题专属语义，业务组件不得出现主题条件分支。

验证至少覆盖：默认与非法值回退、存储异常、切换后路由/媒体/播放上下文保持、1440 与 390 视口、对比度、焦点可见、reduced-motion。
