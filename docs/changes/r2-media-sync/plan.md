# 相册媒体 Cloudflare R2 同步实施计划

> 执行说明：用户已授权在 feat/r2-media-sync 实施；依据 executing-plans / subagent-driven-development 工作流并行实现独立文件并审查。实施阶段不自动提交或推送；用户现已追加明确授权，按当前分支提交、推送并创建 PR。

**目标：** 提供唯一无参数命令，先重新构建、再将相册图片/MP4 增量同步至 R2，上传成功后自动清理旧媒体。

**架构：** 工具完全位于 `scripts/r2-sync`，以现有 dist 相册产物为事实来源。普通对象通过大小与 MD5/ETag 比较，单次 PUT 和自动删除收敛远端状态；没有远端 JSON 清单，不改变运行时应用或媒体生成器。

**技术栈：** Node 24、npm、TypeScript、tsx、Vitest、AWS SDK v3、Node 标准流/crypto/子进程/文件系统。

关联：[完整规格](spec.md)、[任务状态](tasks.md)、[变更声明](change.json)。所有任务覆盖该规格，验收编号以规格为准。

## 全局约束与文件职责

- 只处理相册图片和 MP4；排除 MP3、themes、文档、其他前缀，不增加任何复制/播放规则。
- 只有 `npm run r2:sync`，不带参数或交互确认，启动即完整同步；构建失败不调用远端。原 `npm run build` 本身不触发 R2。
- 单次 PUT，选中单文件不超过 200 MiB；大小与 MD5/ETag 比较，分片/未知 ETag 有独立核实路径。
- 上传并发固定 4，哈希并发固定 2，单次请求最多 3 次尝试，调用截止 10 分钟。
- 不读取/打印凭据值到工具输出，不变更 `.env.production`、CI、原生壳、Pages、域名或线上前缀。
- 先完成所有上传与校验，才自动删除；合法空集合自动同步为空，源目录缺失或产物不完整不能当作合法空集合。
- 保护已存在用户改动；提交或线上操作按用户后续授权执行，不由本计划自动触发。

| 拟新增/修改文件 | 职责 |
| --- | --- |
| `scripts/r2-sync/types.ts` | 仅工具的文件/远端对象、计划与结果类型 |
| `scripts/r2-sync/local.ts` | 目录范围判断、链接边界、流式 MD5、本地快照与报告 |
| `scripts/r2-sync/config.ts` | 项目根路径、配置和本机凭据加载；拒绝额外参数，不承担传输 |
| `scripts/r2-sync/r2.ts` | SDK 适配：分页列表、少量 HEAD、单次上传、批量删除、有限重试与取消 |
| `scripts/r2-sync/sync.ts` | 纯差异计划与固定执行顺序；有界并发、自动清理、结果汇总 |
| `scripts/r2-sync/cli.ts` | 入口、锁、强制构建子进程、信号、日志和退出码 |
| `scripts/r2-sync/local.test.ts` | 真实临时目录/文件的范围、内容与快照边界 |
| `scripts/r2-sync/sync.test.ts` | 操作计划、顺序、失败及重跑状态，不为每个 SDK 参数写重复测试 |
| `scripts/r2-sync/cli.test.ts` | 构建门禁、锁、参数、退出/中断与敏感信息过滤 |
| `scripts/r2-sync/config.example.json` | 无密钥的目标配置字段示例 |
| `scripts/r2-sync/module.md` | 实际工具模块职责、接口、依赖和资源生命周期 |
| `package.json`、`package-lock.json` | 新命令、工具 SDK 依赖及精确安装版本 |
| `README.md`、`docs/requirements.md`、`docs/architecture.md` | 工具已实现的命令/契约，线上迁移仍未执行 |
| `docs/decisions/0008-r2-media-sync.md`、`docs/decisions/README.md` | 采纳后的传输/校验选择与分片取舍 |

不修改 `scripts/generate-media.ts`、`scripts/generate-photo-index.ts` 或应用模块。测试适配器定义在测试文件附近，不新增业务共享层或第二套媒体状态。

## 工具内部接口

实际类型以 [types.ts](../../../scripts/r2-sync/types.ts) 为准，边界与资源契约见 [module.md](../../../scripts/r2-sync/module.md)。FileStamp 使用 bigint size/mtimeNs/ctimeNs/ino/dev；报告仅序列化安全字段。local 导出共享 key 边界、流式扫描、快照与祖先链接校验；R2Store 将 SDK 信息转为完整规范映射、安全 ETag 和逐项删除失败。取消令牌、构建进程组和运行锁由入口持有，没有运行模式或用户参数。

## 任务 1：确认配置并建立可验证的本地比较

影响文件：types、config、local、local.test、config.example，按需要增加官方凭据 provider 工具依赖。覆盖 AC02、AC03、AC04 的本地比较部分、AC09、AC13。

- [x] 以 Node 24 确认运行时及 SDK 当前兼容/许可证；初版静态 INI 已按用户追加指令合并为唯一 JSON 配置，将最终结论回填规格。
- [x] 在临时目录构造合法相册、themes、MP3/MD、中文/空格、大写 MP4、嵌套目录和目录/文件 symlink，定义期望的 key 集合；链接场景只指向夹具外部的另一临时目录。
- [x] 定义同路径、同长度、同 mtime 但不同字节的夹具，断言 MD5 不同；读中变化与超过 200 MiB 的文件被拒绝。超限使用稀疏夹具，不读取完整超限视频。
- [x] 运行 `npx vitest run scripts/r2-sync/local.test.ts`，先确认边界用例针对尚不存在行为失败，再实现扫描/哈希/范围判断；测试断言结果，不复写 MD5 算法。
- [x] 实现额外参数拒绝、根目录定位、配置解析和秘密字段过滤；不执行 credentials，不将路径任意化为生产删除能力。
- [x] 运行该测试直到通过，记录测试数和具体 AC；未写代码前不勾选完成。

## 任务 2：实现 R2 适配及差异计划

影响文件：r2、sync、sync.test、package.json/package-lock。消费任务 1 的 LocalMedia，提供完整 RemoteMedia 和 SyncPlan。覆盖 AC04–AC07、AC10、AC12、AC13。

- [x] 定义 2501 个远端对象、短分页、异常 continuation token、单 key 冲突和第二页网络失败的夹具，确认无漏项、不进入写入。
- [x] 定义普通 MD5 ETag、分片 ETag、合法未知 ETag（列表缺 ETag 拒绝）、metadata 可确认/缺失、大写与引号规范化的差异场景；只有异常 ETag 才允许 HEAD。
- [x] 以真实 SDK client + 本地 HTTP 服务测试列表解析与 Put 请求体/ContentMD5；本地服务记录实际 body，回应已知 MD5，不能只断言替身调用参数。
- [x] 用 SDK 完成分页 ListObjectsV2、HeadObject、PutObject 和 DeleteObjects。SDK 默认流重试不能替代重新打开文件；将失败后新流及最多 3 次尝试列为行为测试。
- [x] 实现 createPlan：只做 O(N+M) 映射比较；输出 uploads/skipped/removals；异常对象无法核实则重传，全部上传成功后自动清理 removals。
- [x] 定义新增/变化/旧文件、相册整个移除、排除主题与音频的计划验收；至少验证 10000 个对象比较不产生逐文件 HEAD，准确报告页数。
- [x] 运行 `npx vitest run scripts/r2-sync/local.test.ts scripts/r2-sync/sync.test.ts`，确认新增比较和协议场景通过。

## 任务 3：完成构建门禁和可重跑执行

影响文件：cli、sync、cli.test、sync.test、package.json。依赖前两任务。覆盖 AC01、AC05、AC08–AC13。

- [x] 定义构建替身返回 1、尚未结束、0 后目录缺失三个场景，确认任何失败/未完成时远端调用次数为 0；正常构建成功则自动继续上传与删除。
- [x] 获得项目锁后，通过子进程等待 `npm run build`；只新增 r2:sync 一个 package script，原 build 命令保持不含 R2。
- [x] 在 R2Store Map 替身中定义一个上传成功、一个失败；断言新文件保留，remove 为 0；重跑只补失败项。
- [x] 定义上传成功但 ETag 错误、文件读中变化、删除前本地新文件出现、远端被改写等场景，全部拒绝删除；并发测试用可控 promise 验证固定上传上限 4、哈希上限 2。
- [x] 实现无参数完整同步；复用 `scripts/validate-content.ts` 的 validateFiles 校验本轮 `src/content/generated-photo-index.json` 在 dist 下的实际资源。构建确认的合法空集合自动清空，内容仍引用媒体但产物缺失、目录缺失或扫描失败时拒绝清理，不引入空集合绕过参数。
- [x] 删除前校验本地快照并重列远端；按预计上传结果建立预期远端状态，变化则停止。批量删除逐项检查，部分错误非零，结束时核对目标集合。
- [x] 定义锁冲突、遗留锁、信号中断、定时器与流清理；不因超时抢占另一个活进程的锁，也不提供跨机器锁承诺。
- [x] 输出阶段耗时与安全报告；故意让报告写入失败及 SDK 错误含秘密样本，确认失败状态准确且报告/终端不泄漏敏感字段。
- [x] 运行 `npx vitest run scripts/r2-sync`，再运行 `npm run typecheck` 与 `npm run lint`；结果填到 tasks 验证证据，不宣称真实 R2 已通过。

## 任务 4：真实目标验证及静态产物核对

影响文件：测试夹具与本次 tasks/change 的证据；生产 config/credentials 位于忽略目录，不加入差异。覆盖 AC04–AC14。

- [x] 真实写入只使用独立测试桶或隔离测试前缀，记录目标范围、Node/SDK 版本、开始时的对象集合；正式 CLI 的 media 边界不因测试而放宽。
- [x] 首个已知文件单次 PUT 携带 ContentMD5，验证 R2 ETag；不一致即停止该路径验收，修订规格后才能继续。
- [x] 验证首次上传、无变化重跑、同长度修改、缺失文件恢复、现有分片对象接管，以及中文 MP4 和新上传/覆盖的真实响应头；不要为比较下载全部媒体。
- [x] 测试自动删除、整册移除、上传失败不删、合法空集合自动清理、产物不完整拒绝、主题/MP3 排除；删除测试仅限夹具对象。
- [x] 用独立临时报告记录数量/字节、构建/哈希/列表/上传/清理耗时；真实大量对象费用及测试规模按目标额度确定，10000 数量边界可由本地协议夹具完成，不在真实桶制造大量无必要对象。
- [x] 清理本轮创建的测试对象；测试中断保留明确清单供恢复，不删除测试开始前已有对象。
- [x] 运行 `npm run check`；分别以 `SITE_BASE=/ npm run build` 和 `SITE_BASE=/wangleyou/ npm run build` 核对 dist 的照片/MP4 仍存在、根/子路径 URL 正确；最后保持与项目默认配置一致的产物。
- [x] 依据实际影响复用现有静态媒体浏览器用例，记录浏览器版本/视口；不需要对未改页面重复整套原生设备验收。任何未执行的必要 AC 保持未勾选，不以“已知限制”完成。

## 任务 5：同步文档和最终审查

影响文件：module、README、需求/架构、ADR 0008 与索引、本次 change/任务。所有代码与验收完成后才将真实实施状态写入基线。

- [x] 新增模块契约的目的、职责/非职责、公开 CLI、输入输出、允许依赖、资源生命周期、文件、扩展和验证；工具不得从前端主题/查看器导入状态。
- [x] README 方案阶段已记录命令；脚本验收后已更新为实际可运行状态，补齐配置放置方式、合法空集合、退出码及阶段耗时说明，核对已有自动构建/上传/清理和失败重跑文案。
- [x] 需求/架构记录本机同步工具已实现；明确正式媒体仍未切向 R2、themes 未上传，全局 media 前缀切换需要独立主题路径决策。
- [x] 写 ADR 0008，记录 SDK 与成熟 CLI 候选、单次 PUT/MD5、无远端清单、有限并发、分片取舍、费用/线上迁移边界；精确依赖版本由锁文件给出。
- [x] 回填 change.json 实际 scope、impacts 和验证；`npm run check:sdd -- --worktree --base origin/main`、`npm run check:sdd -- --structure` 与 `git diff --check` 均通过后复查排除规则和 AC 覆盖。
- [x] 全部必要验收完成才标记实施完成；交付未提交结果，后续提交、推送、真实生产同步及发布按用户明确指令执行。

## 回退和验证层级

方案阶段仅新增文档，可以独立撤回，不影响任何线上内容。工具实施回退移除工具入口及其依赖，保留现有生成器和页面；远端写入不作为代码回退的自动副作用。

若媒体已清理，恢复需 checkout/隔离检出对应素材版本后重建并先上传，再回退站点。没有对 R2 原始文件的历史备份承诺。

本轮文档验证为 SDD 结构/本地链接、JSON 和差异检查；工具实施需要本地协议测试和真实 R2 两层证据。线上迁移涉及公共域名缓存、CORS、Range、根/子路径、WebView 和主题资产，是后续独立工作，不与本工具验收混淆。

## 追加任务：统一本机JSON配置（用户明确要求）

范围：config.ts/config.test.ts/config.example.json、package.json/package-lock.json、README/module.md/ADR与当前记录；不改同步协议、CLI参数或生产R2对象。

- [x] 严格解析bucket/endpoint及嵌套静态credentials，拒绝未知字段、缺失/空密钥，所有解析错误不包含输入值；无INI或环境fallback。
- [x] 一次性安全合并本机INI密钥，原子写入0600 JSON并读回核对，完成后移除旧credentials文件；密钥不进入输出或Git。
- [x] 移除未使用的直接credential-providers依赖，同步锁文件；复用Node JSON和SDK静态对象，不新增依赖。
- [x] 更新配置边界/假密钥测试，运行工具测试、typecheck/lint/build及SDD；本机只验证加载，不执行正式同步或重复云端写入。
- [x] README、模块和ADR改为实际单文件契约，保留此前远端/浏览器验证的版本边界，回填本轮结果。
