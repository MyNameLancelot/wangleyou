# 实施计划

## 影响范围

- 内容流水线：`public/media/photos/*/meta.json`、`scripts/generate-photo-index.ts`、`scripts/generate-photo-index.test.ts`
- 相册卡片：`src/themes/beach/ThemePages.tsx|module.css`、`src/themes/grassland/ThemePages.tsx|module.css`
- 测试：`tests/browsing.spec.ts`
- 基线文档：`docs/requirements.md`、`docs/architecture.md`、`src/content/module.md`、`README.md`

## 步骤

1. 内容流水线改成只读 `meta.json` 的 `album` 段：标题、说明和日期由配置提供，缺省回退到目录名；照片顺序与 ID 由脚本按文件名生成，出现其它键时报错。
2. 迁移三个现有相册的 `meta.json`，补写相册说明文案。
3. 两个主题的 `AlbumCard` 改为最多三张照片的右上错位层叠，日期取 `album.date`，说明取 `album.description`。
4. 更新单元测试与 E2E：层叠数量与错位、日期与说明文案、旧结构报错、无横向溢出。
5. 同步 README、requirements、architecture 与 content module.md 的内容格式说明。

## 验证方式

- `npm test`（生成器与内容校验单测）
- `npm run check`、`npm run build`
- `npm run test:e2e`（desktop-chrome 1440×1000、mobile-chrome 360×800）
- 浏览器人工核对相册页两个主题的层叠层次、日期说明与 360px 单列

## 回退方式

回退本次提交即可恢复单封面卡片与按文件名索引的 `meta.json`；内容文件与生成器同步回退，不涉及运行时状态或部署配置。
