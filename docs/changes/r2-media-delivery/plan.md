# 实施计划

目标：生产相册使用 R2 公开 URL，修复本机 Node 版本诊断。使用现有 content resolver、Vite 环境变量和 Node 标准能力；Node24、无新增依赖、主题同源、无自动发布。

- [x] 在 scripts/r2-sync/cli.test.ts 验证版本/参数分开诊断，仍在配置和构建前拒绝；在 cli.ts 分开预检，版本错误显示 process.execPath 和 nvm use。
- [x] 修复全量检查暴露的哈希取消竞态：用 Node 标准 stream pipeline 管理读取、摘要写入及取消错误，复用已有取消/句柄回归。
- [x] 用户确认公开域名后，修改 .env.production 和 src/content/index.ts；asset-url.test.ts 验证 themes同源、相册R2、编码及页面子路径。
- [x] 在 .github/workflows/check.yml 的check任务设置空媒体前缀，仅用于本提交的产物/浏览器验收，部署build保持R2；新增媒体浏览器测试兼容该覆盖。
- [x] 同步 README、content/R2 module.md、需求、架构、ADR0008。
- [x] Node24运行 check/build；只读检查公开图片、视频Range，静态浏览器核对根/子路径桌面与移动；运行 SDD 和 diff 检查，记录证据。

回退：撤回生产前缀和resolver修改，重新构建同源媒体；Node诊断可独立保留。不改秘密配置或现行上传/删除策略。公开域名缺失时媒体切换任务保持未完成。
