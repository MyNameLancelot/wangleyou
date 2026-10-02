# 0007：独立原生 WebView 壳

日期：2026-09-24；生产地址于 2026-09-30 更新。状态：采纳。

## 背景与决定

家人需要独立安装的 App，网站内容更新不应要求重发安装包。采用 iPhone/iPad 的系统 WKWebView 和 Android WebView 两个独立工程，在线加载 `https://wangleyou.pages.dev/`；GitHub Pages 保留浏览器备用入口。

顶层仅允许该 HTTPS 站点根路径，Hash 导航留在 WebView；用户触发的外部 HTTPS 链接交系统浏览器，其他 scheme 拒绝。子资源按网页 URL 加载，不做原生替换；Android 只申请 INTERNET、禁用明文流量，iOS 保持默认 ATS。没有 JS 桥接或离线媒体库。

安装包不含网站 HTML/JS/CSS、相册配置或家庭媒体；Android 本地开屏视频属于原生界面资源。开屏、返回/视频全屏、加载/错误和系统安全区由平台工程维护，网页 playback 状态不移入原生容器。

## 候选与取舍

- 系统 WebView：已有 HTTPS、导航委托、故障回调和媒体支持，无额外运行时；代价是分别维护两个小工程。
- Capacitor：插件与跨平台同步成熟，但当前不需要桥接，其依赖和配置增加维护面；未来确需平台能力再评估。
- 把 Vite 产物打进包：离线可显示页面，但每次站点更新需要发包，与已确认的在线加载方向冲突。

网页和原生版本可以独立更新，代价是页面依赖网络；断网提供原生重试，而非隐式离线副本。平台媒体/全屏差异仍需逐设备验证。

## 构建、分发与验证

网站 main 触发两处静态部署；原生 CI 仅手动无凭据构建，不上传包。Android Release 在本机家庭密钥签名，iOS Ad Hoc 需要完整 Xcode、证书、登记设备和描述文件，敏感资料不入仓库。v1.0.10 的公开 GitHub Release 是用户单次授权，不自动延伸为后续发布许可；安装步骤由 [README](../../README.md) 维护。

Android 构建与 API 34 模拟器已有证据，现版本真机逐项结果待补；iOS 完整编译/签名/设备验收暂缓。当前交付与验证限制见 [需求基线](../requirements.md#交付状态与验收)，历史实施证据可从 Git 查阅，详细契约见 [Android](../../native/android/module.md) 和 [iOS](../../native/ios/module.md)。
