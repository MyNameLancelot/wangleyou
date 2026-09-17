# app 模块

## 目的

应用装配与页面导航。

## 职责

应用入口、Hash 路由（`#/`、`#/browse`、`#/albums`、`#/albums/:id`）、页面装配、站点标题、主题切换入口、离线提示、配置异常页、查看器会话创建与销毁、把查看器命令转成 playback 状态更新、上次播放记录写入。

## 非职责

内容校验、媒体渲染细节、播放状态机本身（归 playback）。

## 公开接口

index.ts 导出 App；ThemeDecor 提供主题装饰 Slot；router.ts 的 parseRoute 为模块内部纯函数。

## 允许依赖

albums、content、media-viewer、playback、themes。

## 状态与资源生命周期

App 持有 route、唯一 Session 与当前主题；hashchange 关闭会话并回顶；会话写入 `localStorage` 的上次播放记录用于"继续浏览"；监听 online/offline；卸载时移除所有监听。

## 主要文件

App.tsx 应用装配；ThemeDecor.tsx 装饰层；router.ts 路由解析；App.module.css 布局；global.css 基础样式、焦点环与 reduced-motion。

## 扩展与验证

新增页面先扩展路由测试，再通过 App 装配。router.test.ts 与 tests/browsing.spec.ts 覆盖导航、主题保持上下文、离线与触控目标。
