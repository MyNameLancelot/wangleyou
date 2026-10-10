# themes 模块

## 目的

提供唯一的线缝相册主题与站点页面 UI

## 职责

`book/` 实现首页、留影、相册索引与详情、照片加载状态、字体和样式。首页从 content 接收显式主回忆队列，通过 albums 的纯契约处理手势、非循环末页和计时器；按进度渲染照片数加一的纸页，最后一页是文字且不创建自动 live 播报。首页待恢复时控件显示继续，一次点击继续；独立用户暂停不因前台恢复而改变。音乐组件保留但当前不挂载。浏览与相册继续使用 content 的排序与媒体路径。会话存在时只挂载全站共用的 `media-viewer`。

## 非职责

不保存查看器会话、背景音乐意图或音量，不实现主题切换、媒体索引生成、业务后端或查看器复制品。查看器样式不由主题覆盖。

## 公开接口与输入输出

`index.ts` 导出 `BookApp` 与 `ThemeAppProps` 等无 UI 装配契约。输入为路由、内容、主回忆、共用查看器会话及命令、背景音乐状态及命令、打开媒体回调和网络状态；输出为唯一主题页面 UI，不回写 playback 以外的媒体会话状态。

## 允许依赖

content、albums、playback、media-viewer、shared 的公开入口；不得反向依赖 app 或跨模块内部文件。

## 状态与资源生命周期

BookApp 按路由挂载页面：首页主回忆局部持有当前纸页、自动播放意图、悬停/焦点、可见性与翻页层；每次前翻减少一张右侧实体页，回翻恢复。切换期间锁定重复动作，PhotoTransition 用 Web Animations API 推进约 900ms 的动效，各端纸片连白边绕左上角旋出/转入，按视口左侧空间与纸片高度限制角度，最大28度。前后统一更新目标索引，旧层保留原图候选或收束文字；新图加载期间旧层保持，等待最多5秒，完成回调释放锁。组件收尾先隐藏旧快照，避免取消动画终态后旧片闪回，再统一清理动画、load/error/resize监听及等待定时器，页面隐藏/减少动态效果/窗口尺寸变化时收尾，卸载时取消；到文字末页、播放条件失效或卸载时清理 interval。空队列不启动 interval，单张照片可翻到收束页。音乐组件暂不挂载，因此不创建 audio 或播放 Promise；该组件原有卸载清理能力仍保留。查看器会话和背景音乐状态由 App/playback 唯一持有。

## 主要文件

`book/BookApp.tsx` 路由页面装配；`book/ThemeHome.tsx` 与 `ThemeHome.module.css` 为线缝首页，`book/PhotoTransition.tsx` 为跨端纸片旋转、共享收束文字与动画/加载生命周期；`book/ThemePages.tsx` 与 `ThemePages.module.css` 为内容页；`book/BookMusicToggle.tsx` 为保留但未挂载的音乐能力；`book/images.ts` 复用首页/索引的响应式候选及 sizes，PhotoTransition使用已显示currentSrc避免额外请求最大图，输入保持响应式候选；`book/BookTokens.css` 为唯一主题 token；`contracts.ts` 为装配契约。

## 扩展与验证

调整首页先更新本模块与 `albums` 契约，再运行 `npm run check`、`npm run build` 和桌面/手机/平板横竖屏端到端验证。浏览与查看器仍需验证 Hash 子路径、媒体资源和键盘/触摸行为。
