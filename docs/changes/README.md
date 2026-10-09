# 活动变更

此目录保留当前修改及本次尚未完成的实施/验收记录。

| 记录 | 状态与范围 |
| --- | --- |
| [删除独立照片压缩工具](remove-photo-compression/spec.md) | 按用户要求移除旧 JPEG 预处理命令、脚本、专属测试和 README 用法；保留构建自动 WebP 派生；删除及 check/build/SDD 验证完成，随本次 PR 交付 |
| [本机私有目录清理](private-cleanup/change.json) | 清理旧下载产物、二维码、视频中间文件、预览与草稿；保留 R2 配置和 Android 签名材料；17 个临时/重复文件已清理 |
| [相册媒体 R2 同步方案](r2-media-sync/spec.md) / [实施计划](r2-media-sync/plan.md) | 工具已实现；唯一无参数命令自动构建、增量上传和清理，相册图片/MP4 排除 themes/MP3；本地/隔离 R2/静态产物验收完成，随本次 PR 交付；正式相册未同步 |
| [文档清理](docs-cleanup/change.json) | 清理已完成，随本次 PR 交付；覆盖历史记录和基线整理 |
| [全模块审查](module-review/findings.md) / [行动清单](module-review/action-plan.md) | 审查已完成，实际失败及未验证范围已记录；原始审查证据保留，修复状态由独立修复记录维护 |
| [模块修复](module-repairs/tasks.md) / [验证证据](module-repairs/verification.md) | A1–A7 与慢挂载/DOM 替换、Android 错误遮罩修复已落地；真实后台与 API 34/TalkBack 已有证据，Android 真机已获用户通过反馈；macOS 旁白仍未验证，保留记录随 PR 交付 |
| [Android 测试包](android-test-package/change.json) | v1.0.11 同家庭签名测试 APK 与下载二维码已公开交付；用户已确认真机没问题；原生源码随 PR 交付，网页修复未部署 |

各项独立维护；模块修复记录同时覆盖验收中发现的 Android 错误遮罩可访问性局部修复，不新增原生功能或桥接。测试包记录只覆盖版本、产物校验与用户授权的分发。

原生 Android 功能已合并并交付 v1.0.10；旧版本记录已清理。iOS 按用户决定暂缓，完整构建和设备交付未完成；Android v1.0.11 已获用户真机通过反馈，但未提供设备版本或逐项专项记录。状态和未验证范围见 [需求基线](../requirements.md#交付状态与验收)，不因目录删除而标记验收通过。

当前架构与契约见 [总架构](../architecture.md)，长期技术取舍见 [决策索引](../decisions/README.md)。历史过程可从 Git 查阅；恢复开发/验证时按 [SDD 指南](../sdd.md) 建立对应记录，不重新执行过时版本计划。
