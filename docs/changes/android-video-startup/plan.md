# 实施计划

1. 保留选定 MP4 的字节内容并复制到 Android `res/raw`，移除首尾静帧资源。
2. 将 StartupOverlay 的加载态改为平台 `TextureView` 与 `MediaPlayer`，在同一纹理层上中心裁切并保持首尾帧；保留跳过、错误和重试语义，管理播放结束、网页就绪、后台及销毁生命周期。加载文案下的静止短线改为细轨道与往返光条，动画由加载层持有并清理。
   冷启动创建开屏层后，首次 WebView `onPageStarted` 不再调用 `showLoading()`；重试或后续导航仍重启。
3. 提升 Android 版本号，更新需求、模块契约与 README。
4. 检查 MP4 与 APK 内资源、运行 SDD 检查、构建 Debug 和家庭签名 Release；在可用模拟器验证时记录设备、系统和结果。

回退：恢复旧 StartupOverlay 与版本配置，移除新增资源；不涉及数据迁移。

平台方案：用户真机反馈表明 `VideoView` 与 `ImageView` 的裁切不一致，切换时有明显缩放闪动，且视频底色没有铺满。使用 Android 平台 `TextureView` 的矩阵统一实现中心裁切，`MediaPlayer` 在完成时保留最后一帧；无需引入播放器依赖。失败与关闭动画时使用奶油白背景和文字，不使用静帧资源。
