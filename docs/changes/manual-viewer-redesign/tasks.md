# 手动媒体查看器重构任务

- [x] 调研 `ThemeViewer`、`ThemePages`、App 装配、playback 会话、现有测试与模块边界。
- [x] 使用 Visual Brainstorming Companion 确认图片静默舞台与视频影院舞台；确认 Beach 视觉方向、关闭/进度/静音语义。
- [x] 编写规格、计划、依赖评估和可编号验收条件。
- [x] 以测试驱动方式收敛 playback 的连续播放契约，确保视频结束不推进。
- [x] 移除 App 与主题契约中的连续播放命令。
- [x] 独立重做 Beach 查看器 JSX/CSS、状态与手势。
- [ ] 独立重做 Grassland 查看器 JSX/CSS、状态与手势。
- [x] 补充并更新单元与 Playwright 用例。
- [x] 同步 requirements、architecture、app/playback/themes/content module.md 与 README。
- [x] 执行 check、build、e2e 与 SDD 检查，记录实际浏览器/模拟器结果。
- [x] 更新 `change.json` 的实际文档影响与验证证据；确认无 dist、报告、结果目录或 `.superpowers/` 被纳入变更。

## 复看反馈轮次（2026-09-22）

- [x] 查看器移除主题切换入口与可见计数器；关闭入口只留图标。
- [x] 查看器背景改为纯黑不透明层，移除 `::backdrop` 背景模糊。
- [x] 修复 Chrome 媒体框发亮：移除媒体元素的 opacity 过渡与 `filter` 合成。
- [x] 桌面加入滚轮切换，移动端隐藏导航按钮、只保留滑动。
- [x] 照片寄语落到 `meta.json.photos_meta.captions`，渲染在画面正下方并随媒体居中。
- [x] 打开查看器时聚焦对话框本身，Tab 焦点环只统计真正渲染出来的控件。
- [x] 审查修正：预加载只依赖下一张照片地址；触摸设备按输入能力判断（含手机横屏）；alt 不再重复寄语；清理过期注释与死样式。
