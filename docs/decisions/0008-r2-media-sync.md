# 0008：本机相册媒体 R2 镜像同步

日期：2026-10-09。状态：采纳；工具实现，正式媒体同步与网站迁移未执行。

## 背景与候选

用户已准备 R2，要求先重新构建，再以一个无参数命令同步相册图片/MP4，并清理已删除媒体。媒体数量可能较多，不能逐项下载或对所有普通对象 HEAD。themes 和 MP3 排除，现有生成器无需改变。

项目已有 Node 24/TypeScript/tsx 和内容校验，标准 crypto/流足够处理扫描和 MD5。传输评估 AWS SDK、AWS CLI/rclone 与远端 SHA-256 JSON 清单。CLI 增加独立安装/配置，仍需定制构建门禁及删除边界；清单增加提交、修复及一致性成本，第一版不采用。

## 决定

新增工具专用 AWS SDK v3 client-s3（Apache-2.0，精确版本由 npm 锁文件维护），不进入前端 bundle。按用户最新指令，目标配置和静态密钥统一从忽略的 `.private/r2/config.json` 加载，credentials 包含 accessKeyId/secretAccessKey 和可选 sessionToken；严格校验结构，直接向 SDK 传入静态对象。撤销初版独立 INI/profile 文件，不读取默认凭据链，不需要直接 credential-providers 依赖；简单 JSON 使用 Node 标准解析，不机械增加库。

普通对象比较大小与本地 MD5/ETag，列表按 continuation token 完整分页；只有异常/分片 ETag 才 HEAD 可信 sync-version=1/sync-md5，否则重传。没有远端 JSON 清单，不下载远端媒体。MD5 仅做自有内容变化及传输校验，不承担恶意碰撞防护。

统一单次 PUT + ContentMD5，校验返回完整 MD5 ETag，选中文件最大 200 MiB。哈希并发 2、上传并发 4，最多 3 次尝试、单调用截止 10 分钟；关闭 SDK 隐式重试，由适配器在每次重试重建读取流。有限指数退避，不重试认证或完整性错误。

唯一命令 `npm run r2:sync`：预检/锁 → 构建 → 产物及引用校验 → 全量本地哈希/远端列表 → 增量上传 → 快照/远端复查 → 自动批量清理 → 最终集合核对。合法空构建自动清空；产物缺失、读中变化或上传失败阻止删除。部分删除无法回滚，保留已确认结果并非零退出，重跑收敛。

## 取舍与影响

每轮读取全部本地字节，不以 mtime 或文件名截断哈希替代校验；远端普通比较是分页请求而非每文件请求。变化视频失败重传整文件，未来若需要更大文件或弱网分片须重新评估，不能把分片 ETag 直接当完整 MD5。

运行锁是本机独占，遗留锁须人工核对后清理。远端复查检测观察到的变化，不是分布式事务。R2 media 前缀已由用户授权管理，实际操作仅覆盖合法相册图片/MP4；主题/音频和桶内其他内容保留。

自动清理与上传同轮完成，不等待网站发布。未来切向 R2 必须另行设计旧站版本引用窗口、固定 URL 的 CDN purge、CORS/Range 和原生验证；全局媒体前缀还影响未上传的 themes，不能直接宣称迁移完成。工具不配置公开访问或付费服务，不自动发布/推送。

## 验证与维护

真实文件、10,000 对象比较、SDK 本地 HTTP 协议、构建门禁/进程组取消及部分删除回归由 scripts/r2-sync 测试维护；实际 R2 的单次 PUT ETag 和隔离前缀行为证据由活动变更记录保存。长期契约见 [工具模块](../../scripts/r2-sync/module.md)，命令及配置步骤见 [README](../../README.md)。

接口依据 [Cloudflare R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/)、[R2 multipart ETag](https://developers.cloudflare.com/r2/objects/multipart-objects/)、[AWS SDK 凭据提供者](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrate-credential-providers.html) 与 [S3 DeleteObjects](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObjects.html)。接口文档不替代本桶实测。
