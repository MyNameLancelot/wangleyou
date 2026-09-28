# Android 透明状态栏实施计划

1. 调整 `native/android/app/src/main/java/com/mynamelancelot/wangleyou/MainActivity.java` 的系统栏配置：透明状态栏、WebView 绘制到顶部，保留侧边与底部安全区；叠加不拦截触摸的顶部渐隐保护层以维持白色状态图标可读，视频全屏时隐藏，退出时恢复。检查现有网页 `viewport-fit=cover`、主题顶部按钮的 `safe-area-inset-*` 处理，必要时做局部修正。
2. 将 Android `versionCode` 从 1 增到 2、`versionName` 从 1.0.0 增到 1.0.1，继续使用现有私有 keystore 签名。
3. 更新需求、Android 模块契约、README；运行 SDD、Android Release 构建、签名与包元数据检查，尽可能在模拟器核对页面、安全区、全屏及更新安装。
4. 将新 APK 放在本机局域网下载页供用户真机复验，记录用户反馈后再判定真机验收。

不改变网站部署及 iOS 工程。回退时恢复上一版 Android 系统栏配置和文档，旧版已安装 App 只能用更高 `versionCode` 的签名构建覆盖更新。
