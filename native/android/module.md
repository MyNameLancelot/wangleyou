# Android 原生壳模块

## 目的与职责

在 Android 中用系统 WebView 加载生产网站，管理透明状态栏和系统安全区域、旋转、站内和外部顶层导航、返回键、加载/错误/重试与视频全屏。

## 非职责

不保存相册、媒体、路由或播放业务状态，不注入 JS 桥接，不提供下载和离线媒体库。

## 公开接口与输入输出

`./gradlew :app:assembleDebug` 输出可装到测试设备的 debug APK；配置 `WANGLEYOU_ANDROID_KEYSTORE`、`WANGLEYOU_ANDROID_STORE_PASSWORD`、`WANGLEYOU_ANDROID_KEY_ALIAS`、`WANGLEYOU_ANDROID_KEY_PASSWORD` 后 `:app:assembleRelease` 输出本机签名的家用 Release APK。输入固定生产 URL；修改时同步 iOS、需求与部署设置。

## 允许依赖

仅 Android SDK、Android Gradle Plugin 8.9.2、Gradle 8.11.1、JDK 17；不依赖站点 `src`、`dist` 或第三方运行时。构建从官方仓库获取 Gradle/AGP，系统 WebView 负责运行网页。

## 状态与资源生命周期

Activity 持有唯一 WebView、加载指示、故障面板与视频全屏自定义 View；WebView 绘制到透明状态栏后方，顶部渐隐暗色层保证白色系统图标可读且不拦截触摸，容器保留侧边和底部安全区，网页负责顶部交互的安全区；退出全屏释放 View 与回调并恢复状态栏布局，Activity 销毁时从父容器移除并 destroy WebView。仅主框架错误覆盖整屏，媒体子资源错误仍交网站处理。仅声明 INTERNET 权限，禁止明文流量。

## 主要文件与扩展

`MainActivity.java` 是容器逻辑；`AndroidManifest.xml` 声明入口、权限和方向；`app/build.gradle.kts` 固定 SDK 与签名输入；`gradle/wrapper` 锁定构建工具；`app_icon.xml` 为图标。

## 验证方法

安装 JDK 17、Android SDK 35 和 Build Tools 35.0.0 后运行 `cd native/android && ./gradlew :app:assembleDebug`；用模拟器与真机分别检查透明状态栏、顶部安全区、导航、系统返回、断网恢复、照片、视频、全屏及横竖屏。签名 Release APK 用 `apksigner verify --verbose` 验证，并在家庭 Android 设备测试安装和更新。
