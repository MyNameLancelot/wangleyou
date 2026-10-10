# 任务与验证证据

日期：2026-10-10。分支：feat/r2-media-delivery。状态：AC01–AC04完成；随本次 PR 交付，网站未发布。

- [x] 检查现状，创建新分支并确认公开地址。
- [x] Node24版本和额外参数分开诊断，增加实际路径、nvm use提示及回归。
- [x] 配置生产公开R2根地址；相册图片、候选、封面及MP4统一解析，主题同源。
- [x] 修复全量检查发现的哈希取消竞态，标准pipeline管理错误与背压，stat之后补取消门禁；关闭句柄和未启动队列有回归。
- [x] CI验证显式空前缀，发布构建保持R2；新增浏览器测试兼容两者。
- [x] 同步README、需求、架构、模块与ADR。
- [x] SDD最终检查、差异核对与交付收尾。

## AC01：公开媒体与站点路径

用户确认公开地址 https://pub-61801102583343938a91e117b81957b9.r2.dev/。生产.env.production配置该根地址；对象key仍含media目录，生成索引未改。mediaUrl主题路径始终同源，其余媒体沿既有安全校验和分段编码。生产根/仓库子路径和CI空前缀构建均成功；最终dist恢复默认/wangleyou/的R2生产产物。

首次只读图片/视频均404；按已授权镜像范围运行Node24 npm run r2:sync成功：上传102、跳过0、删除0、失败0，共10346757字节，25100ms。取消修复后再次完整构建/哈希/比较：上传0、跳过102、删除0、失败0，4852ms。本轮实际写入正式media相册路径，没有改themes或其他范围。

公开图片HEAD返回200，Content-Type image/webp，Content-Length117318；浏览器自然宽度及实际解码通过。MP4 GET Range0-31返回206，Content-Type video/mp4，Content-Range bytes0-31/1128375，下载32字节，Accept-Ranges bytes。

## AC02：运行时和取消诊断

初始node -v为26.8.2，which node是~/.local/bin/node，nvm list箭头system；实际CLI报告解析后的可执行文件~/.hermes/node/bin/node，并在配置/构建/远端前退出2，明确提示nvm use。项目根目录source nvm.sh后执行nvm use，实际切到24.18.0/npm11.16.0，node路径位于.nvm/versions/node/v24.18.0/bin/node。不修改shell配置或项目Node24约束。

先添加诊断和主题边界回归，旧实现产生3项预期失败；实现后31项通过。全量检查暴露哈希取消的未处理AbortError，已用标准pipeline及stat后的取消门禁修复；新回归验证stat返回/stream消费之间取消、句柄关闭与排队任务停止。新增回归曾有重载类型声明和句柄时序断言失败，均已修正，未作为通过证据。

## AC03：项目及浏览器验证

Node24.18.0 npm run check最终通过17文件230测试，无未处理异常；typecheck/lint/结构及7相册34媒体校验通过。标准默认构建、SITE_BASE=/根构建、VITE_MEDIA_BASE_URL=同源构建均通过。

Chrome154.0.8037.99，桌面1440x1000与移动模拟360x800。静态产物命令：CI=1 SITE_BASE=<base> npx playwright test tests/media-delivery.spec.ts tests/navigation.spec.ts tests/viewer.spec.ts -g 'configured public base|hash routes|album grid shows|video plays, pauses'。真实R2的/wangleyou/8项、/8项通过，覆盖主题响应200、主题同源背景、R2图片srcSet/自然宽度、R2视频duration/currentSrc及播放暂停拖动。CI空前缀构建的media-delivery两端2项通过，共18项；不是原生或真机验收。

工具沙箱首次curl DNS失败、tsx IPC EPERM；必要同命令提升后通过。Node26只运行拒绝预检，没有重复远端同步。没有变更桶公开设置、CORS、域名、缓存规则，也未提交/推送/发布网站。本机Android/iOS与真实大量媒体吞吐未验证；r2.dev按用户给定地址接入，官方将其定位为有限流的开发入口。

## AC04：文档及边界

README、需求、架构、content/r2-sync/工作流module.md、ADR0008已同步；CI使用本提交的同源产物验证，避免素材尚未上传导致PR失败，发布build继续R2。沿用既有Vite resolver和Node标准pipeline，不新增依赖。密钥仅本机配置使用，不进入前端。线上地址待用户后续发布授权，不把本次本地构建当作线上生效。

最终SDD worktree检查通过（21个差异路径），git diff --check通过；真实凭据值未进入Git差异、未跟踪交付文件或前端bundle，秘密配置仍被忽略。生产bundle包含R2公开地址，同步锁已释放。
