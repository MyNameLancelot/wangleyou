# 任务与验证

- [x] 检查现状，新建 fix/viewer-mobile-controls 分支，用户确认截图来自 Android 安装包。
- [x] 实现、需求/架构与两个模块基线同步；无新依赖、原生桥接、业务状态副本。
- [x] Node24.18.0 npm run check 最终通过230项；中途R2 SDK本地请求失败，单独17项及完整230项复跑通过，没有修改R2代码。
- [x] VITE_MEDIA_BASE_URL= npm run build 子路径构建通过；CI=1 npx playwright test tests/viewer-mobile-controls.spec.ts tests/viewer.spec.ts 共58项通过。
- [x] 增加多指取消后移动控件8项再次通过；SITE_BASE=/ VITE_MEDIA_BASE_URL= npm run build 与根路径同8项通过。
- [x] JDK17.0.20、Gradle离线正常debug构建及独立测试包构建通过，API34模拟器安装/启动通过。
- [x] API34模拟器320x640与640x320：工具栏位于24px状态栏下方、点击可进入照片元素全屏、系统返回与横竖屏恢复通过；原自动旋转设置已恢复。
- [x] 自审手势只命中缩略图区域，移动兼容click抑制，多指/取消/blur/resize失效，卸载清理；原生消费cutout避免CSS重复留白，保留满屏开场层。

## 证据范围
Chrome154.0.8037.99，视口390x844、844x390、820x1180；通过CDP注入真实触屏输入，安全区override为top48/right20/bottom24；模拟不等于真机。Android模拟器使用独立applicationId测试包，不覆盖原有安装，加载现有生产网站，因此原生模拟器验证的是容器修复，新缩略图代码由本地静态产物测试覆盖。用户于2026-10-10反馈局域网真机测试没问题，未提供设备版本或逐项记录；Android26–29/35+、实体开孔、iOS/Safari及视频原生全屏真机未测试。普通v1.0.12/code13家庭签名APK已构建并验签，用户授权公开正式Release；未上传媒体或发布网站。

## 本地复现
前端命令使用 Node24.18.0；原生构建设置 JAVA_HOME=/Users/wangyukun/.sdkman/candidates/java/17.0.20-tem 并运行 ./gradlew :app:assembleDebug --offline。独立模拟器包通过系统临时目录的 Gradle init script 增加 .viewertest applicationIdSuffix，无仓库配置改动；随后已重建正常debug产物。

收尾：默认npm run build、SDD工作区14个差异路径与git diff --check通过；本次模拟器已关闭。

## 真机与正式交付
- [x] 家庭签名普通包与同签名LAN包构建通过，二维码解码校验通过；下载服务仅绑定Wi-Fi IP，不暴露凭据。
- [x] 用户2026-10-10确认局域网真机测试没问题，授权提交、PR与正式Release。
- [x] 普通包保留生产HTTPS地址与明文禁用，版本1.0.12/code13；仅普通包进入正式Release，附下载二维码与SHA256。
