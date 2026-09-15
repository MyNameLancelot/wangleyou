# media-viewer 模块

## 目的

照片大图查看器。

## 职责

modal、图片加载/错误/重试、焦点、键盘、触屏、全屏与背景滚动管理。

## 非职责

维护业务队列或索引、修改相册、自动播放。

## 公开接口

index.ts 导出 MediaViewer({session,onStep,onClose})，session 非 null；onStep 接收相对步长，onClose 关闭整个会话。

## 允许依赖

content 的类型与 assetUrl、playback 的 Session 类型。

## 状态与资源生命周期

dialog 与 DOM 监听归组件；卸载恢复滚动和焦点并退出自身全屏。FullPhoto keyed by id/src 隔离异步加载状态；相邻照片预加载在切换/卸载时清理。

## 主要文件

MediaViewer.tsx 控件与图片状态；MediaViewer.module.css 全屏布局。

## 扩展与验证

变更播放规则先更新 playback，视图只发命令。浏览器测试覆盖失败重试、快速切换、键盘、触屏和清理。
