# 实施计划

## 影响范围

- `src/themes/beach/ThemePages.tsx`、`src/themes/beach/ThemePages.module.css`
- `src/themes/grassland/ThemePages.tsx`、`src/themes/grassland/ThemePages.module.css`
- `tests/browsing.spec.ts`
- 基线文档：`docs/requirements.md`、`src/themes/module.md`

## 步骤

1. 两个主题的 `BrowsePage`：标题改为“留影”，删除 `counts` 统计、筛选按钮数量、年份数量、相册快捷区和底部提示文案。
2. 两个主题的 `ThemePages.module.css`：给 `.browseBody` 加上与 `.browseHero` 相同的 `padding-inline`（`max(--layout-gutter, 50vw - --layout-max-width / 2)`），使主体内容与 hero 文案同边；把 `.yearHeader` 改为左对齐；删除 `.browseHint`、`.railAlbum`、`.railCard h3` 等失效样式；移动端筛选胶囊改为使用 `--layout-gutter`，与 hero 文案对齐。
3. 更新 E2E：标题断言改为“留影”，筛选断言改为不带数量的可访问名称，补充无统计数字、无相册快捷区、无提示文案、主体与 hero 左边缘对齐、无横向溢出等检查。
4. 同步基线：`docs/requirements.md` 增加留影页行为描述，`src/themes/module.md` 记录留影页与相册页的差异。
5. 两个主题的 `AlbumTile`：直接使用构建期确定的 `album.media` 顺序选出前三个不重复缩略图（该顺序已将 `topNN` 排在前面），以前层、后两层的次序渲染；使用留影页本地的层叠结构和 CSS，使后层只向右上露出、不带白色描边或投影。
6. 扩展 E2E：验证留影页相册卡的三层结构、前层 `topNN` 来源、层间位置、无白边/无投影，以及 360px 下无横向溢出。
7. 明确并复用 `generate-photo-index` 的展示顺序契约（`topNN` 编号升序、其余自然序）；将每个相册该顺序下的前三张发布图片处理为 3:2，浏览页层叠封面改用 `object-fit: cover`，而相册详情保留完整显示。
8. 两个主题的年份定位栏 hover 使用 `--color-action-primary` 与 `--color-action-on-primary`，并扩展 E2E 覆盖封面铺满、展示顺序和 hover 颜色。
9. 仅覆盖留影页层叠相册卡继承的图片 hover 缩放，使封面在鼠标悬浮时保持原尺寸，并补充 E2E 断言。

## 验证方式

- `npm run check`（含 SDD 结构检查、内容校验、类型检查、Lint、单元测试）
- `npm run build`
- `npm run test:e2e`（desktop-chrome 1440×1000、mobile-chrome 360×800）
- 浏览器人工核对两个主题在 1440×1000 与 360×800 视口的留影页层叠卡片、无白边/无投影、封面优先级和布局

## 回退方式

改动集中在两个主题的留影页 JSX/CSS 与对应断言；如需回退，整体还原本次提交即可，不影响内容配置、媒体解析或路由。
