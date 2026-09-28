# Android 原生壳模块

## 目的与职责

在 Android 中用系统 WebView 加载生产网站，管理透明状态栏和系统安全区域、旋转、站内和外部顶层导航、返回键、加载/错误/重试与视频全屏。

## 非职责

不保存相册、媒体、路由或播放业务状态，不注入 JS 桥接，不提供下载和离线媒体库。

## 公开接口与输入输出

`./gradlew :app:assembleDebug` 输出可装到测试设备的 debug APK；配置 `WANGLEYOU_ANDROID_KEYSTORE`、`WANGLEYOU_ANDROID_STORE_PASSWORD`、`WANGLEYOU_ANDROID_KEY_ALIAS`、`WANGLEYOU_ANDROID_KEY_PASSWORD` 后 `:app:assembleRelease` 输出本机签名的家用 Release APK。`python3 package_family_apk.py` 根据构建元数据生成 `乐悠时光-v<versionName>.apk` 交付副本。桌面应用标签为「乐悠时光」。输入固定生产 URL；修改时同步 iOS、需求与部署设置。

## 允许依赖

仅 Android SDK、Android Gradle Plugin 8.9.2、Gradle 8.11.1、JDK 17；不依赖站点 `src`、`dist` 或第三方运行时。构建从官方仓库获取 Gradle/AGP，系统 WebView 负责运行网页。

## 状态与资源生命周期

Activity 持有唯一 WebView、StartupOverlay 加载/故障层与视频全屏自定义 View。加载层在奶油白底上展示相册翻开动画和进度线：封面翻到接近摊平、书脊直立不折，过 90° 后换为内侧衬页，落影随开合变化；冷启动至少展示到完全翻开停稳，网页就绪后可点右上角毛玻璃「跳过」立即结束。错误时停在半开状态并显示重试入口，Activity 销毁时取消所有动画与延时任务。加载层期间用深色状态栏图标，网页显示后 WebView 绘制到透明状态栏后方，顶部渐隐暗色层保证白色系统图标可读且不拦截触摸，容器保留侧边和底部安全区，网页负责顶部交互的安全区；退出全屏释放 View 与回调并恢复状态栏布局，Activity 销毁时从父容器移除并 destroy WebView。仅主框架错误覆盖整屏，媒体子资源错误仍交网站处理。仅声明 INTERNET 权限，禁止明文流量。

## 主要文件与扩展

`MainActivity.java` 是容器逻辑；`StartupOverlay.java` 负责原生加载、动画与失败重试视图；`res/values*/styles.xml` 设置奶油白系统冷启动背景；`AndroidManifest.xml` 声明入口、权限、方向和应用标签；`app/build.gradle.kts` 固定 SDK、版本与签名输入；`package_family_apk.py` 生成交付文件名；`gradle/wrapper` 锁定构建工具；`res/drawable-nodpi/app_icon.png` 是用户选定的奶油白底无文字翻开相册图标，`res/mipmap-anydpi-v26/ic_launcher.xml` 提供自适应桌面裁切。

## 验证方法

安装 JDK 17、Android SDK 35 和 Build Tools 35.0.0 后运行 `cd native/android && ./gradlew :app:assembleDebug`；用模拟器与真机分别检查透明状态栏、顶部安全区、导航、系统返回、断网恢复、照片、视频、全屏及横竖屏。签名 Release APK 用 `apksigner verify --verbose` 验证，并在家庭 Android 设备测试安装和更新。
