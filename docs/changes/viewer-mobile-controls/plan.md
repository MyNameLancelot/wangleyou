# 查看器移动端修复实施计划

目标：修复用户已确认的 Android 状态栏重叠及缩略图横滑。
架构：media-viewer 内管理瞬时 Pointer Events 资源；ControllerRef 负责官方切换与 view 回写。Android WebView 布局消费真实系统 inset，无 JS 桥接。
技术：React / TypeScript / CSS / Android SDK；Node 24、npm；无新依赖。

## 步骤
- [x] 修改 MainActivity.java 的 insets 回调：现有左右/底部留白不变，WebView 增加 topMargin，向网页返回已消费的 inset；兼容 API26，全屏恢复重新计算。
- [x] MediaViewer.module.css 增加 env 安全区工具栏定位及缩略图底部留白；新增 useThumbnailSwipe.ts，委托触屏事件至官方 ControllerRef，忽略取消/纵滑/多指、抑制拖动后点击，卸载解绑。
- [x] MediaViewer.tsx 连接 ControllerRef 和手势 Hook，保留既有组件公开输入输出。
- [x] tests/viewer-mobile-controls.spec.ts 验证真实 CDP 触屏左右横滑、首尾、取消及点击，安全区受控模拟，横竖屏/平板、收起和重开。
- [x] Node24 下 check、local media build、查看器回归、SDD、diff检查；尝试 Android debug构建和模拟器验证，失败如实保留。
- [x] 同步 requirements/architecture/media-viewer/native模块基线及变更记录；审查事件清理、native布局和测试结果。

回退：删除手势 Hook 与 ref 装配，回退 CSS 与原生 inset 回调；无数据迁移、外部写入或发布。

## 局域网交付步骤
- [x] 提升原生版本1.0.12/code13，构建验证家庭签名普通APK。
- [x] 根路径构建前端；生成原生临时副本，替换SITE与导航白名单为Wi-Fi IP端口，临时manifest允许HTTP且标签标记本地测试；构建LAN签名包，生产源码无HTTP例外。
- [x] 静态产物/两个APK复制到独立私有下载目录，生成并解码二维码，校验APK签名/哈希；绑定Wi-Fi IP启动服务并验证下载。
- [x] 提供扫码链接与换回普通包说明，用户已确认真机测试通过。
