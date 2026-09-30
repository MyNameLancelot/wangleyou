# 0007：家庭设备原生 WebView 壳

日期：2026-09-24
状态：采纳

## 背景

现有 React/Vite 网站经 GitHub Pages 发布，内容与媒体地址已经独立于客户端。家庭设备需要可私下安装的原生 App，且网站更新不应强制重发安装包。

## 候选与决定

- 系统 `WKWebView` / Android `WebView`：都直接支持加载 HTTPS URL、导航委托、故障回调和视频；本次选择。两个小工程需要分别维护，但无需引入额外运行时。
- Capacitor：成熟且方便跨平台插件，但此项目不需插件或 JS 桥接；其配置与原生同步流程增加依赖和维护面。若未来确需桥接再重新评估。
- 把 Vite 产物打进安装包：可离线显示页面，但每次网站更新需要新包，违背本次确认的在线加载方向。

平台依据：[Apple WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)、[Apple 内联媒体配置](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/allowsinlinemediaplayback)、[Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview)、[Android Gradle Plugin 8.9 兼容表](https://developer.android.com/build/releases/agp-8-9-0-release-notes)、[Gradle Wrapper](https://docs.gradle.org/current/userguide/gradle_wrapper.html)。

原生壳最初使用 `https://mynamelancelot.github.io/wangleyou/`。2026-09-30 用户部署并确认 Cloudflare Pages 镜像可用后，将默认 URL 改为 `https://wangleyou.pages.dev/`；该站点在根路径构建，顶层导航只允许其 HTTPS host 的根路径，Hash 导航仍留在 WebView。GitHub Pages 保留浏览器备用；外部 HTTPS 用户链接交系统浏览器，拒绝其他 scheme。子资源按网页 URL 加载，不做原生地址替换。iOS 保持默认 ATS；Android 仅申请 INTERNET 并禁用明文流量。

## 构建与分发

原生 CI 仅 `workflow_dispatch`，只验证 unsigned iOS 模拟器构建和 Android debug APK，不上传安装包。Android Release APK 由本地 keystore 签名；用户本次明确要求把 v1.0.10 上传公开 GitHub Release 并提供二维码，签名材料仍只留本机。iOS Ad Hoc IPA 需要 Apple Developer Program、证书、App ID、登记设备及 provisioning profile，当前未交付。网站 main 更新分别触发 GitHub Pages 工作流与 Cloudflare Pages Git 集成。

分发依据：[Apple 登记设备分发](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)、[Android APK 签名](https://developer.android.com/studio/publish/app-signing)、[Android 非商店分发](https://developer.android.com/distribute/marketing-tools/alternative-distribution)。

关联变更：[family-native-webview](../changes/family-native-webview/spec.md)。
