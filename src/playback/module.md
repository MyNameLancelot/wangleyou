# playback 模块

## 目的

播放领域的唯一事实来源：播放队列、当前媒体、播放意图、实际播放状态、连续播放开关、进度与调度。

## 职责

- 用同一条队列承载照片与视频：`openSession(media, id)`、`stepSession(session, delta)`、`currentMedia(session)`。
- 区分用户意图（`intent`）与实际状态（`status`），真实暂停、缓冲或失败不改写意图。
- 管理连续播放（`continuous`）、进度与时长（`progress`、`duration`），并在视频自然结束时按意图推进（`handleEnded`）。
- 提供失败标记（`markPlaybackError`）供界面展示重试或跳到下一项。

## 非职责

DOM、媒体元素、字幕渲染、控制栏显隐、手势与全屏；主题与样式；内容校验。查看器只转发命令，不维护第二套业务状态。

## 公开接口

`index.ts` 导出 `openSession`、`stepSession`、`currentMedia`、`isVideo`、`setIntent`、`setStatus`、`setContinuous`、`setProgress`、`handleEnded`、`markPlaybackError` 与类型 `Session`、`PlaybackIntent`、`PlaybackStatus`。

约定：`openSession` 找不到 id 或队列为空时返回 `null`；`stepSession` 越界或非法 delta 保持原会话，不循环；所有 setter 返回新对象，不修改入参；`progress` 限定在 0–1，非法时长归零。

## 允许依赖

`content` 的 `Media`/`Video` 类型。不依赖 DOM 或 React，纯函数便于单测。

## 状态与资源生命周期

会话由 `App` 持有，模块本身不创建监听或计时器。媒体元素与计时器由当前主题的查看器创建并在卸载时清理；`ended`、`timeupdate` 等事件通过无 UI 命令契约更新会话。

## 主要文件

- `session.ts`：会话模型与纯函数。
- `session.test.ts`：队列推进、边界、意图与状态分离、连续播放、进度边界、失败标记。

## 扩展与验证

新增播放能力（例如自动幻灯片、背景音乐）时，先扩展本模块的状态与命令，再让 viewer 转发；不得把播放状态放进 viewer 或页面组件。验证至少覆盖：混合队列推进、队尾行为、连续播放开关、进度边界、失败与重试。
