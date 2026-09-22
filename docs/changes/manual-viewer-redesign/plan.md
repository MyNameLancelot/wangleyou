# 手动媒体查看器重构实施计划

## 影响模块与文件

- `src/playback/session.ts`、`src/playback/index.ts`、`src/playback/session.test.ts`、`src/playback/module.md`：删除连续播放状态/命令，使结束事件停在当前视频。
- `src/app/App.tsx`、`src/app/module.md`、`src/themes/contracts.ts`：移除连续播放装配命令，保留 App 对唯一会话的所有权。
- `src/themes/beach/ThemeViewer.tsx`、`src/themes/beach/ThemeViewer.module.css`：实现 Beach 私有图片静默舞台和视频影院舞台。
- `src/themes/grassland/ThemeViewer.tsx`、`src/themes/grassland/ThemeViewer.module.css`：独立实现 Grassland 对应查看器，不引用 Beach。
- `tests/browsing.spec.ts`：验证入口、手动边界、结束不前进、图片/视频控制分离、错误恢复、焦点、手势、响应式和主题隔离结果。
- `docs/requirements.md`、`docs/architecture.md`、`src/themes/module.md`、`README.md`、本变更目录：同步当前基线和真实验证记录。

## 实施顺序

1. 先修改 playback 单元测试：将连续推进预期替换为结束停留，并新增 `openSession()` 不暴露连续状态的断言；运行该测试确认旧行为失败。
2. 从 `Session`、公开出口、App 和主题契约移除 `continuous`/`setContinuous`/`toggleContinuous`；使 `handleEnded()` 永远停留当前项，重新运行 playback 测试。
3. 逐主题替换查看器 JSX。保留 dialog、焦点、滚动锁、全屏、媒体 URL、会话命令和相邻照片预加载；将图片与视频渲染分为不同私有舞台，删除旧常驻控制栏、自动隐藏计时器与连续播放开关。
4. 逐主题重写私有 CSS：桌面将图片静默舞台与视频影院舞台分离，平板折叠信息密度，390px 保证 44px 命中区和无横向溢出。保留 reduced-motion 回退。
5. 调整手势：使用 media-stage 的 pointer 起止坐标；从交互元素或视频元素启动则拒绝；只在单指、横移大于 56px、横移大于纵移 1.5 倍时调用 `step`。
6. 扩充 Playwright：定位任意相册 tile、验证位置/首尾/键盘/Esc/焦点/滚动释放；验证图片不显示视频工具、视频显示影院工具与进度；向视频触发 `ended` 后索引不变；验证图片/视频错误重试与移动手势不会触发于控制区。
7. 运行检查与构建；启动 `npm run preview`，在构建产物的子路径上以 Chrome 桌面 1440×1000、平板 768×1024、Playwright Chromium mobile 390×844 记录 Beach/Grassland 浏览器结果。真机未验证则明确写入任务记录。
8. 依据实际结果同步基线、模块文档、README、`tasks.md` 与 `change.json`；运行 SDD 差异检查，不提交 `dist/`、`playwright-report/`、`test-results/` 或 `.superpowers/`。

## 验证与回退

- 单元测试锁定会话结束与队列边界；E2E 锁定主题私有 UI 和浏览器生命周期；静态预览锁定子路径与 Hash 深链。
- 回退仅需恢复本次 playback、App/contract、两个主题查看器及文档的变更；内容、路由、相册排序和背景音乐均未改变。
