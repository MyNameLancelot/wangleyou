# media-viewer 模块

## 目的

影像查看器的 DOM 与交互层：把 `playback` 的会话状态渲染成可见界面，并把用户操作转发为命令。

## 职责

- 渲染照片与视频：照片的加载中/失败/重试，视频的海报、加载、播放失败与重试退路。
- 控制栏：播放暂停、进度、静音、连续播放开关、上一项/下一项、全屏；无操作 3 秒自动隐藏，指针移动、触摸、键盘与聚焦时恢复。
- 键盘（`←/→`、`Space`、`M`、`F`、`Esc`）、触控水平滑动、对话框模态与焦点归还、全屏 DOM、横竖屏与安全区适配。
- 字幕轨：视频配置 `captions` 时挂载 `<track kind="captions">`。

## 非职责

播放队列、当前媒体、播放意图、连续播放与进度等业务状态；主题变量定义；内容校验；路由。

## 公开接口

`MediaViewer` 组件接收 `session`、`commands`、`themeLabel`：

- `commands.step/close/toggleIntent/toggleContinuous/reportProgress/reportStatus/reportEnded/reportError/reportBlocked/toggleTheme`；
- 浏览器拒绝自动播放时调用 `reportBlocked`，降级为暂停而不是失败。

## 允许依赖

`content`（媒体类型与资源地址）、`playback`（会话类型与 `isVideo`）。不直接读写 localStorage，不修改会话对象。

## 状态与资源生命周期

组件内部只保留 DOM 相关状态：控制栏显隐、静音、全屏提示与视频重试次数。挂载时 `showModal()` 并把焦点放到关闭按钮、锁定 body 滚动、记录并恢复触发元素；卸载时清理定时器、退出全屏、关闭对话框并恢复滚动。`focusin` 兜底保证焦点不会离开对话框。

## 主要文件

- `MediaViewer.tsx`：对话框、控制栏、键盘与触控。
- `MediaViewer.module.css`：查看器布局、控制栏、移动端与横屏规则。

## 扩展与验证

新增控件时保持"位置与操作含义在主题之间一致"，并同步更新开发交付标注。验证至少覆盖：照片失败重试与焦点归还、视频播放/暂停/连续播放/进度、字幕轨存在、控制栏显隐、键盘与触控、全屏成功与失败降级、横竖屏与安全区。
