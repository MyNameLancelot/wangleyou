# media-viewer 模块

## 目的

全站唯一的媒体查看器：相册详情页与全部影像页的大图查看与视频播放。

## 职责

- 用 `yet-another-react-lightbox` + Captions、Fullscreen、Slideshow、Thumbnails、Video、Zoom 插件渲染当前会话，外观与交互对齐该库官方 Full-blown 示例（库默认样式、中文可访问名称）。
- 工具栏只保留幻灯片与全屏：放大、缩小与关闭按钮在全端都不渲染（`render.buttonZoom`/`render.buttonClose` 返回 `null`，`thumbnails.showToggle` 关闭），退出靠 Esc 与点击黑色背景；上一项/下一项只在桌面（≥1200px）显示，手机与平板隐藏并改用触摸滑动。
- 缩略图上方渲染一条与屏幕同宽的自有收起条（`render.controls` + `lucide-react` 的 ChevronDown/ChevronUp），点击通过 `ThumbnailsRef` 收起或展开缩略图带；寄语条固定在画面左下角（深色半透明 + 背景模糊的小玻璃条）。
- 全屏只展示影像（工具栏、导航、缩略图带、收起条与寄语由 CSS 隐藏），并在进入/退出全屏后把焦点交回查看器容器，保证全屏下键盘方向键与触摸滑动都能切图。
- 平台不支持元素级 Fullscreen API 时（例如 iPhone Safari），库会直接不渲染全屏按钮，本模块不做替代实现：查看器本身已是覆盖视口的沉浸层，视频仍可用原生控件全屏；真机核对见 README 的 `npm run dev:lan`。
- 受控渲染：`open` 恒为真（调用方只在会话存在时挂载本组件），`index` 来自 `session.index`；库的 `view` 事件通过 `MediaViewerCommands.stepTo` 回写会话索引，本模块不保存第二份索引或播放状态。
- 把原生 video 事件（play/pause/waiting/timeupdate/ended/error）与打开时的自动播放尝试翻译成 playback 命令；被浏览器拒绝时携带发起播放的队列与索引回报 blocked，视频停留在当前项。
- 维护查看器打开期间的键盘契约：Esc 关闭、方向键与缩略图切换、Tab 焦点在查看器内部循环（库把其余页面标记为 inert）。
- 只提供受控渲染与命令转发，不修改会话、不写存储、不改变路由。

## 非职责

- 不拥有播放状态与队列（归 `playback`）、不解析内容与资源地址（归 `content`）。
- 不提供主题切换、不读取主题偏好、不参与页面布局；首页主回忆不接入查看器。
- 不实现主题化样式：本模块的类名、样式与功能都不可被主题定制或复制。

## 公开接口与输入输出

- `MediaViewer({ session, commands })`：`session` 是 `playback` 的只读会话快照，`commands` 是 `MediaViewerCommands`。会话为 `null` 时调用方不渲染本组件。
- `MediaViewerCommands`：`stepTo(index)`、`close()`、`reportProgress(progress, duration)`、`reportStatus(status)`、`reportEnded()`、`reportError()`、`reportBlocked(media, index)`；调用方只接受当前队列与索引匹配的 blocked 回报。

## 允许依赖

`content`（`mediaUrl` 与媒体类型）、`playback`（`Session`、`currentMedia`），以及 `yet-another-react-lightbox` 及其官方插件；不依赖 `themes`、`app` 或 `albums`，也不被主题复制或包装。

## 状态与资源生命周期

组件自身只持有“最新播放意图”的引用与一次性的 DOM 监听：

- 挂载时由库创建 portal、记录打开触发元素、给其余页面加 inert 并锁定页面滚动；卸载时 portal 与其中的 media 元素一起销毁，滚动锁与 inert 恢复，焦点回到触发元素。
- 视频监听在媒体为视频时建立，切换媒体、关闭或卸载时解绑并让未完成的自动播放请求回调失效；调用方还会核对回调来源，避免旧请求改写后来打开的会话。关闭后不残留 video/audio 元素与计时任务。
- 键盘监听在挂载期间注册、卸载时移除；查看器不创建业务计时器（幻灯片计时由库的 Slideshow 插件在用户显式启动后管理，关闭即清理）。

## 主要文件

- `MediaViewer.tsx`：受控 lightbox、插件装配、标签、视频事件桥与 Tab 焦点环。
- `MediaViewer.module.css`：共用样式（不引用主题变量），固定焦点环、寄语左下角位置、为收起条预留的底部留白与收起条外观。
- `index.ts`：模块公开入口。

## 扩展与验证方法

新增查看器能力时先更新本模块与需求基线，再让 `playback` 暴露对应状态或命令；不得把播放状态搬进本模块，也不得让主题分叉出第二份查看器实现。

验证至少覆盖：打开定位所点击媒体、照片不裁切、寄语显示、视频播放/暂停/拖动进度/结束后停留当前项、背景点击与 Esc 关闭、焦点回归触发元素、Tab 不逃逸、幻灯片需显式启动、缩略图与全屏可用、关闭后无残留媒体或计时器。相关用例在 `tests/viewer.spec.ts`。
