# 相册详情页沉浸式重构实施计划

## 影响范围

- 内容模型与校验：`src/content/model.ts`、`src/content/validate.ts`、`src/content/content.test.ts`、`scripts/generate-photo-index.ts`、`scripts/generate-photo-index.test.ts`、`public/media/photos/2025-05-sequence00-周岁/meta.json`、`src/content/generated-photo-index.json`。
- 主题私有页面与图片状态：`src/themes/beach/ThemePages.tsx`、`src/themes/beach/ThemePages.module.css`、`src/themes/beach/PhotoImage.tsx`、`src/themes/beach/PhotoImage.module.css`，以及草原主题对应文件。
- 主题装配：`src/themes/beach/BeachApp.tsx`、`src/themes/grassland/GrasslandApp.tsx`，仅将相册路由的缺失/配置异常转入主题私有状态页。
- 验证和基线：`tests/browsing.spec.ts`、`docs/requirements.md`、`docs/architecture.md`、`src/content/module.md`、`src/themes/module.md`、本变更目录。

## 实施步骤

1. 先为 `Album.opening?: string` 写内容验证与生成脚本测试：覆盖有效值、缺省值、首尾空白、空值、非字符串和第 21 个 Unicode 字符；再扩展模型、运行时校验和生成脚本，生成示例相册的开场引言并重建索引。
2. 两个主题各自为 `PhotoImage` 增加自然比例变体：普通媒体继续保留当前 `cover` 或调用处的既有布局，详情瀑布流变体输出宽度 100%、自动高度的图片、骨架与失败占位。为 video poster 复用该变体；无 poster 继续显示明确占位。
3. 两个主题各自替换 `AlbumPage`：删除旧详情头、固定 `photoGrid`、下一相册推荐；实现 B 风格的主题私有沉浸式开场，其中引言计算为 `album.opening ?? album.description`，首张入口只在有媒体时渲染；将 `album.media` 以原输入顺序映射到新的瀑布流 tile。
4. 两个主题各自编写瀑布流 CSS：桌面三列、`max-width: 900px` 两列、`max-width: 390px` 一列；自然比例图片不裁切，视频标记在 poster 上；loading/error/无 poster 的卡片具有最小可读高度。删除旧详情选择器及其移动端覆盖。
5. 在两主题的 `ThemePages` 中添加主题私有空相册、无效 ID 和相册路由配置错误状态；在各自 App 仅对 `route.kind === 'album'` 装配该状态。保持其他页面的错误处理、全局主题开关与 App 的 session/route 生命周期不变。
6. 扩展 Playwright：两个主题下验证沉浸开场、`opening`、回退、首张查看器入口、三档响应列数、无横向溢出、自然比例图片无 `cover`；覆盖空相册/无效 ID/缩略图网络失败并确认其他 tile 仍可打开查看器。更新旧详情布局断言，删除“下一本相册”相关断言。
7. 同步基线：需求文档记载 B/C 混合开场、原始比例瀑布流和 `opening` 维护规则；架构说明内容索引新增字段但 playback/路由边界不变；content 与 themes 的 module.md 记载字段校验、自然比例图片状态与主题隔离责任。
8. 运行 `npm run check`、`npm run build`、`npm run test:e2e`；以 `npm run preview` 或等价静态服务器加载 `dist/`，在 Chrome 桌面 1440×1000 和移动模拟 390×844 下验证 `/wangleyou/#/albums/2025-05-sequence00` 的两个主题、深链刷新、所有状态与无横向溢出。将实际命令、浏览器版本、结果与未验证项写回 `change.json` 和 `tasks.md`。

## 验证与回退

- 单元测试优先锁定字段规则与索引输出；E2E 锁定主题 UI、入口和响应布局；最终以构建产物而非开发服务器验证子路径 Hash 深链。
- 变更仅涉及内容字段与主题详情视图层；若需要回退，回退本次变更中的模型/索引、两主题页面/CSS和基线文档即可，App 的 playback 会话、Hash 解析、媒体地址解析与其他页面不受影响。
