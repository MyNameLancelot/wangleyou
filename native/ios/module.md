# iOS 原生壳模块

## 目的与职责

在 iPhone/iPad 中用 WKWebView 加载生产网站，管理安全区域、旋转、站内和外部顶层导航、加载进度、站点失败与重试，并保留 WebKit 的内联媒体和系统视频全屏能力。

## 非职责

不保存相册、媒体、路由或播放业务状态，不提供 JS 桥接、离线库、登录或在线编辑。

## 公开接口与输入输出

`WangLeYou.xcodeproj` / `WangLeYou` scheme 是构建入口；输入固定生产 URL `https://mynamelancelot.github.io/wangleyou/`，输出未签名模拟器 `.app` 或经维护者 Ad Hoc 签名的 `.ipa`。修改 URL 时必须同步 Android、需求与部署设置。

## 允许依赖

仅 UIKit、WebKit 和 Apple 构建工具；不依赖站点 `src` 或网站 `dist`。媒体子资源由网页按原有配置加载。

## 状态与资源生命周期

ViewController 持有唯一 WKWebView、进度 KVO 和故障覆盖层；离开时 KVO 失效。WebKit 管理导航历史和媒体进程；顶层导航委托拦截非站内 URL。iOS 未放宽 ATS。

## 主要文件与扩展

`AppDelegate.swift` 启动窗口；`SiteViewController.swift` 管理容器；`Info.plist` 设备与方向配置；`Assets.xcassets` 图标。需要原生能力时先修改规格与模块契约。

## 验证方法

完整 Xcode 下运行 `xcodebuild -project native/ios/WangLeYou.xcodeproj -scheme WangLeYou -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build`，再分别在 iPhone/iPad 模拟器与已登记真机检查导航、断网恢复、照片、视频及全屏。Ad Hoc IPA 需人工签名和登记设备。
