# 0001：纯静态相册的工程基础

日期：2026-09-15。状态：采纳。

## 背景

公开的家庭相册需要模块化界面、后续音视频状态协调及 GitHub Pages 托管；运行时没有服务端。

## 备选方案

- React + TypeScript + Vite：具备组件生命周期和状态更新能力，适合后续媒体交互；增加框架运行时依赖。
- Vite + 原生 TypeScript：依赖更少，但需要自行维护 DOM、视图更新和复杂状态同步。

## 决定

用户确认采用 React + TypeScript + Vite；npm 管理依赖，CSS Modules 隔离样式，CSS 变量承载主题。不引入状态库或组件库。

实际安装：React 19.3.0、Vite 8.3.0、TypeScript 6.0.3、Vitest 5.0.0、Playwright 1.63.0；可复现依赖以 package-lock.json 为准，Node 24 为运行环境基线。

使用 Hash 路由：`#/` 与 `#/albums/<id>`。默认 Vite base `/wangleyou/`，通过 SITE_BASE 覆盖。无需 Pages 服务器重写，代价是地址包含 #。

配置以 JSON 保存在 src/content/albums.json；发布图片位于 public/media。维护者保留仓库外原素材，仓库提交发布大图与生成缩略图。sharp 从发布图片生成最长边 640px 的 WebP（质量 78，不放大），构建只校验资源，不生成或覆盖图片。

## 模块影响

content 负责规范化与校验，app 装配，albums 呈现；playback 拥有唯一队列和索引，media-viewer 拥有 DOM 和焦点。依赖契约见总架构及各 module.md。

卡片图片失败只提供占位，点击卡片仍可进入大图查看器并重试；避免嵌套按钮造成不可访问的 HTML。查看器使用原生 dialog，内部 div 是全屏目标，禁止直接对 dialog 调用 requestFullscreen。

## 验证与限制

以静态构建与浏览器测试验证子路径、刷新、图片和查看器行为。移动端模拟不代表真机及 WebView；完整自动播放与主题切换另建变更。当前工作流只检查、不发布。

## 参考

- [React 官方起步](https://react.dev/learn/build-a-react-app-from-scratch)
- [Vite 静态部署](https://vite.dev/guide/static-deploy)
