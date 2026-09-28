# 家庭原生 App 实施计划

1. 核实远端基线、部署地址、官方平台文档与本机工具；从最新 origin/main 创建分支。
2. 建立原生 iOS 与 Android 独立目录，统一生产 URL 和导航限制；实现加载、进度、错误、重试、系统返回和媒体全屏。
3. 用平台原生构建工具输出 iOS 工程和 Android APK；签名只从本机环境或人工 Xcode 流程取得。
4. 增加仅手动触发的原生 CI 校验/构建，保持现有 Pages 工作流不变。
5. 同步 requirements、architecture、module.md、ADR 和 README；运行网站与可用原生检查，按验收项记录证据。

影响模块：新建 `native/ios`、`native/android`；扩展 `.github/workflows`。网站 `src/`、内容管线和部署配置无接口变化。回退时删除两个原生目录、原生 workflow 和对应文档增量；现有网站可继续部署。
