# app 模块

## 目的

应用装配与页面导航。

## 职责

应用入口、Hash 路由（`#/`、`#/browse`、`#/albums`、`#/albums/:id`）、站点标题、主题选择、唯一查看器会话与背景音乐状态及 playback 命令装配（`stepTo` 回写查看器翻页、`close`、进度/状态/结束回报）。App 把无 UI 主题契约传给当前主题的完整站点应用。

## 非职责

内容校验、媒体渲染细节、播放状态机本身（归 playback）。

## 公开接口

index.ts 导出 App；router.ts 的 parseRoute 为模块内部纯函数。

## 允许依赖

content、playback、themes。

## 状态与资源生命周期

App 持有 route、唯一 Session、背景音乐状态与当前主题；hashchange 关闭会话并回顶；背景音乐意图和音量只在用户显式切换或调整时写入偏好，初始化时读回；页面隐藏造成的待恢复状态只由 `setBackgroundMusicVisibility` 表达，不写偏好。获取 localStorage 属性以及读写失败均静默降级。已移除上次播放记录与“继续浏览”。监听 online/offline，卸载时移除所有监听。

## 主要文件

App.tsx 应用装配；router.ts 路由解析；global.css 基础样式、焦点环、默认禁止展示文字和图片选择（可编辑字段除外）、图片原生拖拽禁用与 reduced-motion。

## 扩展与验证

新增页面先扩展路由测试，再通过 App 装配。router.test.ts 与 tests/browsing.spec.ts 覆盖导航、主题保持上下文、离线与触控目标。
