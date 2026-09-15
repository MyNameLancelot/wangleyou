# app 模块

## 目的

应用装配与页面导航。

## 职责

应用入口、Hash 路由、页面装配、站点标题、查看器会话创建与销毁。

## 非职责

内容校验、照片渲染细节、自动播放。

## 公开接口

index.ts 导出 App；router.ts 的 parseRoute 为模块内部纯函数。

## 允许依赖

albums、content、media-viewer、playback、themes。

## 状态与资源生命周期

App 持有 route 和唯一 Session；hashchange 关闭会话；卸载时移除监听。

## 主要文件

App.tsx 应用装配；router.ts 路由解析；App.module.css 布局；global.css 基础样式。

## 扩展与验证

新增页面先扩展路由测试，再通过 App 装配。router.test.ts 与 tests/browsing.spec.ts 覆盖导航。
