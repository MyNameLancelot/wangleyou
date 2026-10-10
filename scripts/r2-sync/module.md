# R2 相册媒体同步工具

## 目的与职责

将本轮成功构建的相册图片与 MP4 增量同步到 Cloudflare R2，全部上传及校验成功后清理多余的受管理对象。维护者只执行 `npm run r2:sync`，不接受参数。

职责包括本机配置预检、构建和产物校验、流式 MD5、完整分页列表、内容差异计划、上传/删除顺序、运行锁、取消和安全报告。范围为 `media/YYYY-MM-sequenceNN-相册名/**` 下的 JPG/JPEG/PNG/WebP/AVIF/GIF/SVG/MP4；识别已从本地移除的历史相册。

## 非职责

不处理 themes、MP3、JSON/MD、其他前缀或远端清单；不改生成器、前端 URL、CI、网站发布、桶设置或 CDN 缓存。无业务后端、分布式锁、远端历史备份或跨站点版本事务。

## 公开接口与输入输出

- CLI：`npm run r2:sync`；固定从脚本位置定位项目，先执行并等待 `npm run build`。配置/运行时/参数错误返回 2，构建/同步失败返回 1，完整镜像成功返回 0，中断返回 130。
- 输入：唯一配置 `.private/r2/config.json` 的 bucket/官方 HTTPS endpoint、credentials（必填 accessKeyId/secretAccessKey，可选 sessionToken）；本轮生成内容索引与 `dist/index.html`、`dist/media`。JSON 严格拒绝未知字段和空密钥，不读取旧 INI 文件、不使用环境默认凭据链、不执行 credential_process。
- 输出：受管理 R2 对象、终端摘要及 `.cache/r2-sync/latest-report.json`；报告仅包含 key、大小、数量、阶段耗时、请求/内存统计及白名单错误码，不序列化密钥或 SDK 对象。
- `local.ts`：`isManagedKey` 共用操作边界；`scanMedia` 计算 MD5 和 bigint 文件快照；`assertSnapshotUnchanged` 删除前复查；`assertSafeMediaStats` 为扫描和 PUT 提供祖先链接/普通文件检查。
- `sync.ts`：纯函数 `createPlan`；`synchronize` 消费完整 LocalMedia/RemoteMedia 映射、R2Store、AbortSignal 与报告钩子。没有模式选项。
- `r2.ts`：`R2Store` 提供 list/headMd5/put/remove/close；SDK 返回安全类型。remove 返回失败或未确认的 key；此前批次确认成功的对象不丢失。测试专用的程序化隔离前缀映射不由正式 CLI 暴露。

## 允许依赖

Node 24 标准 fs/crypto/stream/child_process/JSON，现有 tsx，官方 AWS SDK v3 client-s3，既有 `scripts/validate-content.ts` 的内容/资源校验。JSON 配置足够使用标准平台解析，静态凭据对象直接传 SDK，不再需要直接 credential-providers 依赖。不从主题、查看器或 playback 导入状态；SDK 只在工具使用，不进入浏览器构建。

## 状态及资源生命周期

运行锁通过 `.cache/r2-sync/run.lock` 的 exclusive create 在构建前获得，写本机 PID/host/token；结束只释放自己的 token。任何已有锁均保守拒绝，维护者核对 PID 已退出后手动清理遗留锁，不按年龄抢占。

CLI 持有 AbortController、构建进程和 SDK 生命周期。macOS/POSIX 构建中断先 TERM，必要时 5 秒后 KILL 同组子孙进程，等待清理后释放锁；Windows 仅终止直接子进程，未验证完整子孙进程清理。扫描/上传工人全部 settle 后再退出。哈希并发 2，上传/异常对象核实并发 4，上传流每次重试重新创建。适配器最多 3 次有限尝试、一次调用截止 10 分钟，销毁流、句柄、计时器及客户端。

没有远端 JSON 清单或本地哈希缓存。内存保存本轮差异和统计快照。比较为全量本地 MD5 + 远端大小/普通 ETag；异常 ETag 只信任 HEAD 的 sync-version=1 和合法 sync-md5。单次 PUT 使用 ContentMD5，并复查本地字节与返回 ETag；选中文件上限 200 MiB。

全部上传确认成功、删除前本地集合/快照和远端集合/大小/ETag/LastModified 复查后才清理；合法空构建可自动清空。删除逐批最多 1000 项，失败/中断保留前批结果，当前未知及未尝试对象明确失败。结束再列远端确认集合。远端复查不能提供分布式事务，运行期间须避免其他写入者。

## 主要文件、扩展与验证

config.ts 负责配置；local.ts 负责文件；r2.ts 负责 S3 协议；sync.ts 负责计划和顺序；cli.ts 负责进程、锁、报告和退出。types.ts 不持有状态。config.example.json 仅含普通目标配置。

`npx vitest run scripts/r2-sync` 覆盖真实文件、构建门禁与进程组、10,000 对象比较、本地 HTTP SDK 请求、重试和部分删除。正常项目 `npm run check`、`npm run build` 仍不连接 R2。实际服务验证须用隔离前缀并清理测试对象；正式相册同步与站点迁移分别授权。扩展分片或命令行为时同步规格及 [ADR 0008](../../docs/decisions/0008-r2-media-sync.md)，不隐式放宽删除范围。

Node 预检在配置/锁/构建/远端操作前执行：非24报告实际版本和可执行文件路径，提示项目根目录 `nvm use` 与 `node -v`，退出2；Node24时额外参数单独报告并退出2。工具不自动改动 shell 或放宽运行时约束。

哈希读取使用标准 `stream/promises.pipeline` 将文件读取流写入摘要累积器，pipeline统一管理错误、背压及取消；settle后才在finally关闭文件句柄，包含stat返回与stream消费之间取消的竞态。
