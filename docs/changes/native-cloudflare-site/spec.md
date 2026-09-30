# 原生 App 切换 Cloudflare Pages 站点

## 问题与目标

家庭 App 当前固定加载 GitHub Pages 仓库子路径，大陆网络可能无法连接。用户已部署并验证 `https://wangleyou.pages.dev/`，要求从最新 `origin/main` 建分支，让原生壳默认加载该地址，重新打包 Android App，上传 GitHub 并提供可扫码下载的二维码。

## 范围与边界

- Android WebView 与 iOS WKWebView 的初始、重试及站内顶层导航改为 Cloudflare Pages 的 HTTPS 根路径与 Hash 路由。
- Android 版本升为 1.0.10（versionCode 11），继续使用本机现有家庭私钥签名，允许覆盖安装 v1.0.9。
- 本次明确授权把签名 APK 上传到 GitHub Release 并提供下载二维码；私钥、密码和设备标识不得上传。分发链接公开可访问。
- 网站本身、媒体配置、播放和开屏视频不在本次修改范围；GitHub Pages 仍可作为浏览器备用站点。
- iOS 安装此前已暂缓，且本机缺完整 Xcode 与签名资料；只同步 iOS 源码和基线，不把 IPA 或 iOS 设备验收记为完成。

## 验收

- A1：Android 与 iOS 初始 URL 为 `https://wangleyou.pages.dev/`；仅该 HTTPS host 的根路径与站内 Hash 导航由 WebView 保持，其他顶层地址按现有规则处理。
- A2：Cloudflare 首页和关键静态资源可从公网读取；Android APK 不内置网站构建产物或媒体。
- A3：Android v1.0.10 Release APK 由现有家庭签名生成，签名、包名、versionCode、versionName 与下载文件哈希核对通过；可覆盖 v1.0.9 的版本号。
- A4：Android 模拟器核对开屏后加载 Cloudflare 首页、站内浏览和错误/返回路径；真机未运行时如实记录。
- A5：GitHub Release 的 APK 与本机验证产物一致；二维码指向实际下载链接且可解码。GitHub 下载在大陆的可达性仍需用户真机网络核对。
- A6：相关需求、架构、原生 module.md、ADR、README 和 change.json 同步真实状态，SDD 检查通过。
