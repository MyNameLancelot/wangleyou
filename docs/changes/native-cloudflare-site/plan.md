# 计划

1. 核对 `origin/main`、Cloudflare 站点、现有 v1.0.9 Release、本机签名与构建工具；建立本记录。
2. 同步 Android/iOS 初始 URL 与顶层导航白名单；只提升 Android 包版本。确认根路径、Hash 路由和外部链接语义。
3. 更新当前需求、架构、模块、ADR 和 README；注明 GitHub Pages 备用、Cloudflare Pages 主站，以及本次用户明确要求的公开 APK 分发例外。
4. 运行 SDD、静态检查与 Android Debug/签名 Release 构建；用签名工具、包元数据和模拟器验证。完整 Xcode/真机缺失时记录未验证项。
5. 审查差异与凭据排除，提交并推送功能分支，创建 PR；从同一提交发布 Android v1.0.10 GitHub Release，核对资源 SHA-256 和下载链接，生成并解码二维码。

回退代码时恢复原 URL 与版本配置；已安装 v1.0.10 不能用较低 versionCode 覆盖，须用更高版本重新签名分发。既有 v1.0.9 Release 保留。
