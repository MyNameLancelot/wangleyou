# 0001：纯静态相册的工程基础

日期：2026-09-15。状态：采纳；媒体管线由 [0005](0005-responsive-media-pipeline.md)、查看器由 [0006](0006-lightbox-viewer.md) 补充。

## 背景与决定

公开家庭相册需要组件生命周期、可追踪的媒体状态及静态托管，不需要运行时服务端。采用 React + TypeScript + Vite，Node 24/npm 与提交的锁文件保证安装可复现；精确包版本以 `package-lock.json` 为准，不在 ADR 维护安装快照。

样式使用 CSS Modules 和语义 CSS 变量。业务状态通过纯领域逻辑与 React 装配，不额外引入全局状态库。路由使用 Hash（首页、留影、相册索引/详情），Vite base 默认 `/wangleyou/`，由 `SITE_BASE` 支持根路径部署；运行产物仅静态文件。

## 候选与取舍

- React + TypeScript + Vite：复用组件与资源生命周期，适合媒体交互；承担框架运行时成本。
- Vite + 原生 TypeScript：依赖更少，但要自行维护 DOM、视图更新和复杂状态同步。
- History 路由：地址更简洁，但需要服务器回退重写；Hash 可直接用于静态托管和仓库子路径，代价是 URL 含 `#`。

## 影响与验证

app 装配路由和状态实例，领域状态、内容、UI 与查看器按模块拆分，边界见 [总架构](../architecture.md)。原始素材归仓库、派生资源归构建，不沿用早期直接发布原图的方案；不再使用自写 dialog 查看器。

通过静态构建验证根路径/子路径、相册直达、刷新和资源 URL；浏览器模拟不代表真机或 WebView。
