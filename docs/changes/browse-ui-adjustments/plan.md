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

## 验证方式

- `npm run check`（含 SDD 结构检查、内容校验、类型检查、Lint、单元测试）
- `npm run build`
- `npm run test:e2e`（desktop-chrome 1440×1000、mobile-chrome 360×800）
- 浏览器人工核对 1920×1080 宽视口的留影页布局

## 回退方式

改动集中在两个主题的留影页 JSX/CSS 与对应断言；如需回退，整体还原本次提交即可，不影响内容配置、媒体解析或路由。
