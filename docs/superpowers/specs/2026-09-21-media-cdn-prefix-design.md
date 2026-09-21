# 构建期媒体 CDN 前缀设计

## 目标

让所有发布到 `public/media/` 的图片、视频、海报、字幕和主题私有音乐可在构建期改用 jsDelivr，同时让内容配置继续只保存 `media/...` 相对路径。默认构建和本地开发不设置 CDN 时，资源地址仍使用 Vite 的 `import.meta.env.BASE_URL`。

## 方案比较

1. 扩展 `assetUrl()` 的默认前缀：改动最少，但其名称无法表达“仅用于媒体”的边界。
2. 新增 `mediaUrl()` 并保留 `assetUrl()`：推荐。媒体调用有明确统一入口，现有通用资产 API 不被破坏。
3. 在主题中维护 jsDelivr 字符串：会分散配置、绕过校验，且无法保证所有媒体统一迁移。

## 已确认设计

- `mediaUrl(path, base?)` 使用构建期常量 `import.meta.env.VITE_MEDIA_BASE_URL || import.meta.env.BASE_URL` 作为默认前缀；生产环境变量为 `https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/` 时，`media/a.webp` 解析为 `https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/media/a.webp`。jsDelivr 暴露仓库根目录，故需保留仓库内的 `public/` 段。
- resolver 只接受已经由 `assertAssetPath()` 定义的安全相对路径：拒绝协议、绝对路径、反斜杠、查询、片段、空/`.`/`..` 段以及编码后的等价形式；逐段 `encodeURIComponent`，保持中文文件名编码。
- resolver 去除前缀全部末尾 `/` 后补一个 `/`，不会产生双斜杠或漏斜杠。
- `assetUrl()` 保留原有签名及以站点 `BASE_URL` 为默认值，作为兼容 API；媒体消费者全部改用 `mediaUrl()`。
- 两个主题不得拼接 CDN 字符串。相册封面、缩略图、主回忆、查看器照片、视频 `src`、`poster`、`track`、hero/第二屏背景、主题装饰媒体和背景音乐均经 `mediaUrl()`。
- 不修改 `vite.config.ts` 的页面 `base`、Hash 路由或 GitHub Pages 部署路径，也不新增依赖、后端或运行时配置。

## 错误处理与验证

配置内容仍由既有构建期校验阻止非法路径；CDN 网络加载失败继续走已有图片/查看器媒体失败界面。单元测试覆盖前缀优先级对应的显式前缀、末尾斜杠、BASE_URL 回退、中文编码与危险路径；构建验证分别检查默认和 jsDelivr 前缀产物。
