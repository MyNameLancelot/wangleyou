# themes 模块

## 目的

提供唯一的线缝相册主题与站点页面 UI

## 职责

`book/` 实现首页、留影、相册索引与详情、照片加载状态、字体和样式。首页从 content 接收显式主回忆队列，通过 albums 的纯契约处理手势、非循环末页和计时器；按进度渲染照片数加一的纸页，最后一页是文字。音乐组件保留但当前不挂载。浏览与相册继续使用 content 的排序与媒体路径。会话存在时只挂载全站共用的 `media-viewer`。

## 非职责

不保存查看器会话、背景音乐意图或音量，不实现主题切换、媒体索引生成、业务后端或查看器复制品。查看器样式不由主题覆盖。

## 公开接口与输入输出

`index.ts` 导出 `BookApp` 与 `ThemeAppProps` 等无 UI 装配契约。输入为路由、内容、主回忆、共用查看器会话及命令、背景音乐状态及命令、打开媒体回调和网络状态；输出为唯一主题页面 UI，不回写 playback 以外的媒体会话状态。

## 允许依赖

content、albums、playback、media-viewer、shared 的公开入口；不得反向依赖 app 或跨模块内部文件。

## 状态与资源生命周期

BookApp 按路由挂载页面：首页主回忆局部持有当前纸页、自动播放意图、悬停/焦点、可见性与翻页层；每次前翻减少一张右侧实体页，回翻恢复。翻页期间锁定重复动作，PageTurn 通过 requestAnimationFrame 推进 SVG 卷页，完成回调释放锁，卸载时取消动画帧；到文字末页、播放条件失效或卸载时清理 interval。空队列不启动 interval，单张照片可翻到收束页。音乐组件暂不挂载，因此不创建 audio 或播放 Promise；该组件原有卸载清理能力仍保留。查看器会话和背景音乐状态由 App/playback 唯一持有。

## 主要文件

`book/BookApp.tsx` 路由页面装配；`book/ThemeHome.tsx` 与 `ThemeHome.module.css` 为线缝首页，`book/PageTurn.tsx` 为局部卷页与动画帧生命周期；`book/ThemePages.tsx` 与 `ThemePages.module.css` 为内容页；`book/BookMusicToggle.tsx` 为保留但未挂载的音乐能力；`book/BookTokens.css` 为唯一主题 token；`contracts.ts` 为装配契约。

## 扩展与验证

调整首页先更新本模块与 `albums` 契约，再运行 `npm run check`、`npm run build` 和桌面/手机端到端验证。浏览与查看器仍需验证 Hash 子路径、媒体资源和键盘/触摸行为。
