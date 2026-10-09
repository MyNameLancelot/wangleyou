# 相册媒体 R2 同步任务与验证

日期：2026-10-09。分支：`feat/r2-media-sync`。状态：主同步与单文件配置修订均已完成验收，随本次 PR 交付。关联：[规格](spec.md)、[实施计划](plan.md)、[变更声明](change.json)。

## 实施任务

- [x] 任务 1：静态凭据/目标配置（初版INI，后按用户要求改为单JSON）、共享范围、流式 MD5、bigint 快照、200 MiB/链接边界与真实文件测试。
- [x] 任务 2：SDK 分页/HEAD/PUT/删除、显式有限重试和流重建、完整性校验、本地 HTTP 协议及纯 Map 差异计划，无远端 JSON 清单。
- [x] 任务 3：构建前独占锁、强制构建/产物及引用校验、并发 4 上传、复查/自动清理、进程组/流/信号生命周期、安全报告与失败重跑。
- [x] 任务 4：隔离真实 R2 ETag、增量/分片接管/删除/失败/空集合/排除验证及新上传/覆盖响应头，完整清理测试对象；根/子路径静态产物及浏览器验证。
- [x] 任务 5：module.md、README、需求/架构、ADR 0008、变更声明与证据同步；两轮审查的必修项全部解决。

## 验收跟踪

| 验收 | 结果与证据 |
| --- | --- |
| AC01 | 通过：CLI 构建未完成/失败远端 0 调用；标准 npm build 真实成功；真实 npm 子孙进程取消回归通过 |
| AC02–AC03 | 通过：真实文件范围、中文/嵌套/大写扩展、symlink/FIFO；真实 R2 themes/MP3 保留 |
| AC04–AC05 | 通过：实际 PUT/MD5 ETag、重跑0上传、同大小同mtime变化、缺失恢复、历史整册与空镜像自动删除 |
| AC06 | 通过：SDK HTTP 2501对象4页（含17项短页）、token/conflict/第二页错误，不返回部分映射 |
| AC07 | 通过：metadata版本/哈希边界与实际R2单part multipart ETag，可信复用/不可信单次PUT接管 |
| AC08–AC09 | 通过：唯一无参数命令，构建/缺index/缺资源/链接/超限/文件变化失败阻止远端或删除；合法空构建清空 |
| AC10 | 通过：三次完整body重传、认证/校验不重试、并发4；2001对象后批断网/取消保留前批结果，重跑收敛 |
| AC11 | 通过：wx互斥/token所有权，已有锁拒绝、人工核实遗留锁；TERM-resistant子孙进程KILL后才settle；本地/远端变化阻止删除 |
| AC12 | 通过：真实新上传和同key覆盖后的图片/MP4 MIME、缓存、inline、大小、MD5 metadata与ETag；实际PUT ContentMD5及XML删除MD5由协议测试校验 |
| AC13 | 通过：10,000 Map比较、2501分页、阶段耗时/字节/请求/RSS快照与秘密样本过滤；不承诺大量视频吞吐 |
| AC14 | 通过：Node24 check249测试；默认/根/子路径build与两端Chrome共12项；SDD/差异通过，线上未迁移 |

## 可追溯证据

- 主同步初版验收时：Node 24.18.0、Vitest 5.0.0、AWS SDK client-s3/credential-providers 3.1148.0（Apache-2.0）；锁文件同步，SDK不进入前端bundle。本机credentials仅加载使用，profile为r2；bucket/endpoint已按用户输入写忽略配置，不打印密钥。
- `npm run check` 最终通过：18文件、249测试；工具为local54、r2协议17、CLI22、config3、sync9。未修改应用源码或现有生成器。
- `npm run build`、`SITE_BASE=/ npm run build`、`SITE_BASE=/wangleyou/ npm run build` 最终均通过，校验7相册34媒体；最后保持默认 `/wangleyou/` dist。
- 静态浏览器命令：`CI=1 SITE_BASE=<base> npx playwright test tests/navigation.spec.ts tests/viewer.spec.ts -g 'hash routes|album grid shows|video plays, pauses'`；两种base分别6/6通过。Chrome154.0.8037.99，桌面1440×1000、移动模拟360×800，路由、图片/视频缩略图、视频播放/暂停/拖动通过；不是原生或真机验收。
- `npm run check:sdd -- --worktree --base origin/main`：25差异路径通过；check含structure通过；`git diff --check`通过。配置/凭据/报告的git check-ignore通过。
- 主R2前缀：`r2-sync-tests/2a149f25-590e-4d84-93ec-63f8cd085b7f/media/`，wangleyou-media桶；UTC11:57:32–11:58:02。初始无对象，最终清理并确认无对象；只用微小传输夹具，不把伪MP4当播放验证。
- 主R2结果：首次上传2/删除旧册1（20字节，3733ms），无变化上传0/跳过2（2162ms），同大小同mtime修改上传1（9字节，1896ms），缺失恢复1（11字节，1996ms），可信分片复用/不可信覆盖1（17字节，2695ms）。模拟上传失败未删除，修正重跑删除旧项1；整册移除/合法空镜像删除4（2161ms），themes/MP3两对象保留至夹具清理。
- 主R2适配器累计23列表页、36尝试；结束RSS快照84.41MB。原始忽略报告 `.cache/r2-sync/integration-report.json`；上文摘要不依赖缓存文件作为唯一证据。
- 响应头补验前缀：`r2-sync-tests/c2691321-8900-4d79-931d-a70ae9f4238f/media/`。图片/MP4分别新上传3字节和同key覆盖9字节，HEAD核对MIME、immutable/固定路径缓存策略、inline、长度、sync-md5/sync-version和ETag全部通过，完整清理。原始 `.cache/r2-sync/headers-report.json`。
- 第一次补验前缀 `r2-sync-tests/bed1bb07-5dd3-4464-8b1c-4daaf6a44c06/media/` 在初始只读列表ETIMEDOUT，未创建本地夹具或上传对象，后续确认无远端对象；按30秒测试截止补验通过。生产仍采用规格的10分钟调用截止，没有改成测试值。
- 10,000普通对象纯Map比较10.88ms，全部跳过，HEAD0/上传字节0；设置与真实产物扫描56.85ms、RSS快照109.84MB。原始 `.cache/r2-sync/benchmark-report.json`；不是峰值内存、完整同步耗时或真实10,000远端对象吞吐。
- 复审修正：缺dist/index门禁、后批删除失败丢失已确认结果、npm退出后子孙进程KILL丢失。真实TERM-resistant子孙进程回归通过，最终复审无剩余阻断项；细节在忽略 `.superpowers/sdd` 报告。
- npm安装/审计/R2最初受沙箱DNS限制，tsx构建/检查受IPC EPERM，本地HTTP/浏览器受端口限制；按工具要求提升后通过。临时验证脚本lint和新增回归类型声明曾失败，修正后最终check/build通过，不伪装为首轮通过。npm audit仅报告既有sharp/source-map-js两项high，不涉及新增SDK，未做无关升级。

## 保留边界

正式 `media/` 同步、媒体前缀切换及发布未执行；提交、推送和 PR 创建已获得用户后续明确授权。没有改桶/CORS/域名/purge或前端环境配置。未来迁移的旧站引用窗口、themes路径和公共缓存另行设计。Windows子孙进程清理、原生设备和真实大量视频吞吐未执行，不由macOS及小夹具结果代替。

## 追加：单文件JSON配置

- [x] 严格静态JSON解析与假密钥/错误脱敏测试；无旧INI或环境fallback。
- [x] 安全迁移本机密钥至config.json（0600），读回核对后移除旧credentials；不打印值。
- [x] 移除未用直接provider依赖、更新使用与契约文档、完成相关检查；不执行正式媒体同步。

追加阶段已确认：本机原子合并后读回一致、权限0600、旧credentials不存在，loadConfig本机成功且未连接R2；npm uninstall移除未用的直接provider依赖和锁条目。config/CLI共25项通过，缺文件/无效JSON/未知字段/空密钥不会从旧INI或环境回退，错误不包含假密钥。本轮npm run check（18文件249测试）与npm run build通过；前面的实际R2/浏览器证据属于主同步初版，不冒充本轮云端重测。

本轮收尾：无需重新写入R2或重跑前端浏览器，传输与UI未改；以配置/CLI、真实HTTP协议、全量check、构建和SDD覆盖本次输入契约与依赖调整。
