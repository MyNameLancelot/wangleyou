# 全模块审查结果

> 本文是修前审查证据，保留失败样本与原位置。用户随后要求实施，当前修复状态和实际结果见 [模块修复](../module-repairs/tasks.md) 与 [验证证据](../module-repairs/verification.md)；原始失败不代表修后结果。


2026-10-01，审查基线 `0f0747116c9da35177d23503b3385af82bac08be`，分支 `chore/docs-cleanup`。使用当前工作区已清理的文档基线，保留上一任务未提交改动。审查及行动清单已完成，修复尚未实施；本文的“通过”仅对应实际运行项。

## 结论

先修素材保护、内容生成和后台播放边界，再处理输入一致性、验证缺口与有实测收益的图片优化。当前模块依赖没有环，playback 的业务状态归属正确；不建议全仓重新分层或按文件长度拆分。

最高风险是离线压缩工具可通过既有输出符号链接覆盖源照片。该问题仅在隔离临时目录复现，真实家庭素材没有参与复现。现有全部单元测试通过，仍未覆盖这一边界及若干构建故障。

## 环境与实际检查

| 检查 | 实际结果 |
| --- | --- |
| Node / npm | 24.18.0 / 11.16.0；默认 PATH 的 Node 26 不用于本次检查 |
| `npm run check` | 通过：SDD structure、内容校验、TypeScript、ESLint；12 个测试文件、102 项单元测试通过 |
| 默认 `/wangleyou/` build | 通过；JS 340.51kB、gzip 106.68kB；CSS 44.53kB、gzip 9.60kB |
| `/wangleyou/` E2E（`CI=1`，禁用服务复用） | 67 通过、5 按项目条件跳过；没有失败 |
| `/` build | 通过，HTML 入口使用 `/assets/...` |
| `/` E2E（`SITE_BASE=/ CI=1`） | **65 通过、5 跳过、2 失败**；两项均为 home-memory 用例写死子路径，见 F11，不能记成全部通过 |
| Chrome | 154.0.8037.58；套件 1440×1000、360×800；专项 390×844、820×390、390×300，布局另测 820/1024×844 |
| 临时管线复现 | 小图、小封面、失败索引、大小写 MP4、重复封面、畸形缓存均取得实际结果；EXIF6、缺产物补建、无效 JSON 缓存重建、占位↔真实封面切换通过 |
| 静态产物 | 108 文件，14,695,404 字节；136 个相册媒体引用均存在；未发现源素材目录、原生工程或签名文件进入 dist |
| Android | JDK17、Gradle8.11.1，`:app:assembleDebug --offline --no-daemon` 增量构建通过（32 项 up-to-date）；APK 5,758,467 字节，含一段开屏 MP4，无网站 HTML/JS/CSS/JSON |
| Android 设备 | ADB 可运行，设备列表为空；未安装、启动或测试原生包，没有现版本模拟器/真机行为证据 |
| iOS | Swift/工程/scheme 静态核对；Info.plist、project.pbxproj 的 `plutil -lint` 通过；按暂缓指令未编译、签名或运行 |
| 工作流 | 静态核对触发、提交、权限、缓存和失败依赖；actionlint 不可用，未安装；没有运行远程 CI 或发布 |

最终恢复默认 `/wangleyou/` dist。所有合成素材在 `/private/tmp` 下生成并清理；诊断脚本不成为应用实现或长期测试。原生签名凭据未读取。

## 模块覆盖与取舍

| 范围 | 核对结果及建议 |
| --- | --- |
| app | 实际依赖 content/playback/themes/media-viewer/shared，全部走公开入口；Hash/网络监听卸载清理，路由变化关闭会话。非法编码、无效路由/相册、localStorage getter 抛错、离线提示专项通过。保留装配，修正文档 F15；暂不拆命令 hook |
| shared | 仅 Route 纯类型，无反向依赖或业务状态。保留，不增加通用杂项目录 |
| playback | Session 转换、非循环、ended 留当前项、进度归一化及音乐偏好有有效单测。保留纯状态机；F04 的后台状态需要明确适配，不能把状态迁进主题 |
| media-viewer | 插件装配与状态回写方向正确，稳定 commands/current 引用不会因每次进度回报重绑 effect。现有焦点、滚动锁、全屏、切换、视频结束测试通过。处理 F04/F07；DOM 测量和视频绑定可有限内部提取，见行动清单 |
| content runtime | ID/日期/路径/重复引用/比例校验与安全空内容回退合理；媒体 URL 逐段编码且支持两种 base。保留，无排序模块可拆；文档/注释纠正 F15 |
| 索引生成 | 排序、显式主回忆、寄语、非法容器与缺失引用有单测；大小写封面关联 F05 有缺陷，重复封面选择未显式规定，不擅自定新规则 |
| 派生与缓存 | EXIF、内容哈希、视频去重、失效产物与封面切换正常；F02/F03/F06 有实际失败证据。先修完整性，再决定提取发布/缓存内部边界 |
| 发布校验 | realpath/文件约束、资源存在与 MP4 100/200MiB 阈值有测试。保留。`validateFiles` 不独立检查 homeMemory，其正常入口由生成器提前校验；若以后单独消费外来索引再扩充，当前不据此宣称生产 bug |
| albums | 现行横滑、非循环末页、interval restart/dispose 合理；七个旧导航/滚轮函数没有生产或测试调用。清理 F14，保留显式预留音乐能力，不把两者混同 |
| book 首页/动效 | PageTurn RAF、interval 与 visibility 监听均有清理，末页与路由卸载用例通过。F08 恢复语义和 F09 ARIA 冲突需处理；F12 图片有实际优化空间 |
| book 内容页/样式 | 留影筛选与年月/序号、Masonry sizes/比例、封面栈有行为测试；390/820/1024 的首页/留影/索引/详情均无横向溢出。索引封面响应式缺口 F12，旧 CSS F14；暂不拆三个页面文件 |
| 保留音乐 | 当前没有 audio、入口或播放；纯偏好与可见性逻辑有单测。组件请求失效、事件解绑和长按计时器清理静态合理；不恢复挂载，不因未使用删除 |
| 离线压缩 | 参数、命名、EXIF、dry-run、逐文件失败、HEIC 解码路径/临时文件、并发报告已有多边界测试；F01 破坏输入只读保证。先修写入安全，再考虑内部编码职责提取 |
| 静态验收服务器 | 路径 realpath/symlink 拒绝、GET/HEAD/Range/416 的临时样本通过；F13 有内存测量，属于验收工具，不是线上服务 |
| SDD | full/light、文件链接、Git range/staged/worktree 隔离、公开入口规则有测试；F10 主题规则过时。别名/非字面量动态导入仍按“不支持”契约，不扩大规则范围 |
| 工程配置/依赖 | Node24、npm 锁文件一致；五个生产依赖均在源码使用，无新增依赖理由；打包体积尚不构成必须懒加载或重新分包的证据 |
| 网站工作流 | main-only 发布、validate→build→deploy、最小权限、同运行提交合理；重复 main 检查是已定取舍。缓存只保存清单不保存 public 产物，冷 runner 仍需派生，是性能候选而非正确性故障；先计时再扩大缓存 |
| Android | URI 的 scheme/host/port/user-info/root 检查、子资源错误不覆盖、返回优先级、全屏 View 与开屏播放器/光条归属静态清晰；未发现需要立即整体重构的证据，运行时疑点列待验证矩阵 |
| iOS / 原生工作流 | 保留当前静态壳和手动构建入口；ATS、安全区、主框架 HTTP 错误、KVO 弱引用/失效静态合理。暂缓构建/设备验收；不能用 plist 语法通过代替 Xcode 编译 |
| 测试体系 | 已有 102 单测与 72 E2E 用例覆盖正常路径和若干有效边界。补已确认遗漏及 F11；无需为所有小函数增加机械测试或删除正常边界测试 |

## 问题与证据

### F01：压缩输出符号链接可覆盖输入照片（P0，已复现）

- 位置：`scripts/compress-photos.ts:464–499, 549–568`；只检查输出根路径，编码直接写最终目标，`stat` 跟随既有文件链接。
- 复现：临时 input/photo.jpg 为1000×800，output/photo.jpg 符号链接指向该源图；执行 `runCompress(parseArgs([input,'--out',output,'--max-edge','500','--concurrency','1']))`。
- 实际：succeeded=1、failed=0，源图 SHA256 改变，源图变成500×400。预期输入字节不变或拒绝危险目标。真实素材没有参与。
- 建议：校验每项输出祖先与目标；拒绝出界链接，临时编码成功后替换目标，避免跟随 symlink/hardlink 写原 inode。回归覆盖文件链接、目录链接、硬链接与正常重复覆盖。优先于文件拆分。

### F02：合法小照片/封面被当作无效图片（P1，R02 已复现）

- 位置：`scripts/generate-media.ts:51–59`。
- 复现：320×213 JPEG 或 MP4 的320×180封面；调用生成器。
- 实际：均抛“图片宽度无效”。文件可解码，失败源于所有候选宽度都被过滤。当前需求没有480px源图下限。
- 建议：无预设候选时保留源宽 WebP，不放大；尺寸、srcSet、封面和缓存版本一起明确。小图还需考虑四舍五入后的比例阈值，不能只修一个320px样本。

### F03：派生失败覆盖最后有效发布索引（P1，R03 已复现）

- 位置：`scripts/generate-media.ts:108–109, 153–165`；`generate-photo-index.ts:156–157`。
- 复现：先生成有效相册；追加不能解码的 top02.jpg，再生成并捕获失败。
- 实际：索引未保留，已有 top01 的 `.960.webp` 发布地址变回 `.jpg` 源地址；缓存/旧产物在该失败点保持不变，源 jpg 并不在 public。这会使工作区内容与发布资源不一致，虽构建已正确停止，不代表曾经发布坏站。
- 建议：扫描返回数据，派生在内存处理，全部成功才提交发布索引；处理缓存/索引写失败及旧产物清理顺序，不新增数据库或复杂事务系统。

### F04：查看器没有执行隐藏暂停契约（P1，R01 合成事件已复现，真实后台待验证）

- 位置：`src/media-viewer/MediaViewer.tsx:142–196`，`src/app/App.tsx`；安装版 Slideshow 只有播放/定时控制，无 visibilitychange。
- 复现：Chrome 中启动幻灯片，将 document.visibilityState/hidden getter 设为hidden/true并派发visibilitychange，等待3500ms，再恢复visible并等待3500ms。当前项1→2→3，暂停按钮始终在。视频同操作，隐藏1800ms后仍 paused=false，时间到1.48s，返回后继续到2.09s。
- 预期：接收到隐藏状态时暂停；回来等待用户主动继续。合成事件证明应用适配遗漏，**不等于真机/真实后台证据**。
- 额外尝试：独立有界面Chrome标签切换及CDP窗口最小化后，此环境仍报告visible，因此两次尝试均不能核验真实后台；没有把自然ended暂停误算作后台暂停。
- 建议：复用库 SlideshowRef.pause()，集中可见性适配，取消/失效迟到的play请求；视频暂停仍回写playback。无需自建另一套幻灯片计时器。

### F05：大小写 MP4 与封面匹配不一致（P1，R06 已复现）

- 位置：`scripts/generate-photo-index.ts:29–31, 122–134`。
- 复现：clip.MP4 + clip.poster.jpg；实际报“找不到同名的视频源文件 clip.mp4”，虽然入口接受 `.MP4`。
- 建议：对视频扩展名按既有不区分大小写规则匹配，保留实际源文件名；不要把整个文件名强制小写，避免 Linux 上不同 stem 冲突。
- 附带事实：同 stem 的 `.poster.jpg` 和 `.poster.png` 同时存在时静默选择PNG。当前未规定重复候选策略，应在实施规格选择“拒绝歧义”或显式优先级；不单凭此把合法素材判成错误。

### F06：可解析但结构损坏的缓存不能重建（P2，已复现）

- 位置：`scripts/generate-media.ts:25–33, 153–160`。
- 复现：清单 entries 中某条只保留 hash，缺 variants；重新生成时最终清理抛 `Cannot read properties of undefined (reading 'filter')`。相比之下，完全无效 JSON 和缺派生文件都能重建。
- 建议：缓存边界检查 version/entries/videos/variants，非法条目不作为可清理文件清单；局部或全量回退重建，不能根据损坏字段删除任意路径。

### F07：短视口寄语超出影像（P2，R04 已复现）

- 位置：`src/media-viewer/MediaViewer.tsx:83` 与 caption CSS。
- 复现：周岁第1张带寄语照片，390×300视口；影像宽141px、寄语160px，右侧超出31.5px。390×844和820×390分别满足边界。
- 建议：移除160px下限，控制内容盒/padding相对媒体宽度；保留12px内距，补极窄竖图、缩略图折叠、缩放/平移与全屏恢复测试。慢挂载/DOM替换仍是待验证风险，不能据240帧/3秒扫描期限直接宣称真实丢事件。

### F08：首页后台恢复后的控件表达不符实际暂停（P2，合成事件已复现）

- 位置：`src/themes/book/ThemeHome.tsx:79–109, 146, 161`。
- 隐藏/返回后影像确实保持不动；但按钮仍标“暂停主回忆自动播放”。第一次点击把 playing 从true切false，变“继续”；需要再点才真正继续。
- 建议：resumeRequired 时显示继续并由一次主动动作恢复；普通手动暂停仍切换意图。不能破坏悬停/焦点覆盖、翻页锁与末页停止。

### F09：自动末页带主动朗读语义（P2，静态确认，未测试屏幕阅读器）

- 位置：`src/themes/book/ThemeHome.tsx:148`；需求“自动翻页不引入朗读”。
- 末页动态挂载 `role="status" aria-live="polite"`，具有自动播报语义，与要求冲突。未运行VoiceOver/TalkBack，不能声称听到了播报。
- 建议：末页保留可读取文本，移除自动live语义，验证页面其他错误状态仍可通知。

### F10：SDD 主题隔离检查漏掉 book（P2，R07 已复现）

- 位置：`scripts/sdd/check.ts:81–83`。
- 临时Map：book/a.ts 导入 future/b，validateModules返回[]；beach导入grassland则正确拒绝。规则仍硬编码已删除主题。
- 建议：从真实主题目录/约定识别主题，允许无UI contracts/index但拒绝跨UI树；补正反例。实际仓库未发现跨主题UI导入，这不是现有视觉串用证据。

### F11：根路径端到端测试有硬编码（P2，已复现）

- 位置：`tests/home-memory.spec.ts:24`。
- 根路径两项目都走完主回忆步骤，最终仅因期望 `/wangleyou/` 而失败，实际URL正确为 `/`。因此不能靠更长timeout或重试解决。
- 建议：保存操作前URL并断言未变化，或者由 testInfo/baseURL 推导；根/子路径分别独立构建与启服务。`reuseExistingServer` 可误连旧base服务器是测试配置风险，本次通过CI=1排除，无误测证据。

### F12：首屏图片有明确可减少的传输（P2，实测）

- 位置：`ThemeHome.tsx:147`、`ThemePages.tsx:75–90, 153–174`、`PageTurn.tsx`、`BookApp.tsx`。
- 390×844、DPR1、每页新浏览器上下文：首页影像显示284px却请求1600w，源字节320,208；已有480w仅39,818，960w132,072。索引封面也无srcSet，约374/382px框请求1600w，样本单图545,280传输字节。留影/详情网格已有srcSet并实际选择480w，应保留。
- 留影主题头图每次冷请求1,497,705字节（含响应开销）；源PNG1,497,405字节。只在内存试编码：原尺寸1254×1254 WebP q80为26,920字节，960w为17,350；未替换资产、未做视觉验收，不能宣称无损等价。
- 建议：首页/索引复用现有候选与真实sizes，翻页SVG也避免再取最大src；头图另做视觉对比后换优化版本。不得牺牲高DPR清晰度，不删除保留音乐资产。

### F13：验收服务器 HEAD/Range 整文件读取（P2，R10 实测）

- 位置：`scripts/serve-built.mjs:37–48`。
- 临时100MiB稀疏文件：HEAD正确无响应体；32字节Range正确206，但均readFile全文件。该进程RSS从60,997,632到峰值273,907,712，增加212,910,080字节（约203MiB）。这是本机单次工具测量，不代表线上服务或普遍性能数据。
- 建议：HEAD只读stat；GET/Range用Node流按start/end传输。保持类型、416、realpath、缓存头及客户端断开清理。小文件首段/后缀/越界、空文件416、symlink/编码穿越404均已通过。

### F14：旧首页纯逻辑与CSS残留（P3，R05 静态确认）

- 七个函数：getHomeWheelIntent、canChangeHomeSection、getHomeKeyIntent、getHomeTouchIntent、createHomeMemoryWheelState、reduceHomeMemoryWheel、nextHomeSection，除定义外在src/tests/scripts无调用；module.md“供既有测试使用”不准确。
- `ThemePages.module.css` 的旧homeMemory/hero/recent、detailArchive/detailFacts、sectionHeader/sectionLink等18组候选不被当前JSX引用。须按完整选择器依赖和CSS模块导出再确认后删除，不能把注释或全局库类当死CSS。
- 保留 stepHomeMemory 的旧循环测试具有边界价值；是否缩小接口应与非循环调用迁移一起评估，不直接删测试。保留音乐是用户明确预留，不能一并清理。

### F15：模块契约/注释与实现漂移（P2，R08 静态确认）

- app/module.md 允许依赖未列media-viewer/shared，且指向不存在的tests/browsing.spec.ts。
- playback/module.md仍写查看器DOM由主题包装；content/module.md仍描述runtime排序/稳定排序文件和测试；albums/module.md称旧函数仍供测试；model.ts注释仍为photos/home-memory.json与照片下方寄语。
- README仍称6张照片/2个非空册/1个空册、压缩后加入public/media；当前实际为7个非空册、33照片+1视频，源应加入media-source。public/media/SOURCES.md仍列已删除的beach/grassland资源和640px thumbs，缺当前book头图/音乐路径对应说明；纠正路径和已知来源，不推断尚未登记的素材许可。
- 建议：同步真实公开接口/依赖/测试入口，属于文档修正；不因文档错误倒改正确实现或复制查看器。

## 生命周期与依赖核对

实际生产跨模块边：app→content/playback/themes/media-viewer/shared；themes→content/albums/playback/media-viewer/shared；albums→content；playback→content；media-viewer→content/playback；content/shared无反向边。`main.tsx`→app。未发现循环、跨模块内部import或主题对查看器CSS的覆盖。

| 资源 | 当前创建/失效/清理 | 结论 |
| --- | --- | --- |
| App Hash/网络监听 | 挂载创建，卸载解绑；Hash清Session ref/state | 保留 |
| video监听/play Promise | 每项视频创建，换项解绑/取消扫描，active=false拒绝旧Promise回报；blocked又核对queue/index | 正常方向；隐藏暂停遗漏F04，慢DOM/迟到成功仍需定向回归 |
| 寄语ResizeObserver/RAF/load | 按index/slides创建，cleanup断开/取消/解绑/清变量 | 可提取布局适配，但不是另一个业务状态机 |
| Tab/document与全屏焦点RAF | Tab卸载移除；全屏一次RAF未持有取消句柄 | raw Escape与回触发焦点专项通过；极快关闭后的RAF属于低风险待复验，非已确认缺陷 |
| Slideshow插件timeout | 库使用useTimeouts管理，关闭清理 | 无visibility适配；应调用插件ref，不复制调度 |
| 首页interval/visibility/PageTurn | controller.dispose、visibility解绑、RAF取消；末页停止/离路由测试通过 | F08/F09局部语义修复，不搬入playback |
| 压缩并发/HEIC子进程 | Promise池汇总，子进程错误/退出回报，临时文件finally清理 | 测试有覆盖；外部命令无超时仅为潜在卡住风险，未复现，不先加抽象 |
| Android Surface/player/光条 | surface release，player identity guard/release，动画与延时取消 | 设备缺口保持；popup临时WebView只有导航销毁路径、restoreState空返回缺回退需设备故障复验 |
| iOS KVO/WebView | weak self，deinit invalidate；WebKit拥有媒体进程 | 静态合理，后台/全屏/导航需恢复iOS后验证 |

## 验证质量与未验证范围

- 5个E2E跳过来自首页用例明确限定桌面/移动项目，未把跳过写成通过。触屏滑动部分为合成TouchEvent，不能证明真实手势取消或厂商行为。
- viewer helper 的pressViewerKey先强制focus，不能独立证明打开焦点；本次增加不强制focus的原始Escape操作，库容器获焦且关闭回触发元素通过。快速反复开关/迟到play成功/慢挂载仍建议补独立回归。
- 临时Git测试确实覆盖range/staged/worktree、删除链接和导出/动态字面量import；临时管线process.cwd在afterEach恢复。不要把这些有效隔离测试删除或改为并发cwd切换。
- 根路径失败是F11；不修改测试掩盖，报告保留真实失败。目录/字段坏输入、EXIF和缓存场景用合成素材验证，不用真照片做破坏性实验。
- **仍未验证：** 浏览器真实hidden状态与真机后台；VoiceOver/TalkBack；极窄竖图/缩放后寄语、慢portal挂载；Android首尾/弱网/重建/popup/Android15与API26–29安全区；iOS编译和设备；线上托管、远程工作流/权限。以上各项有明确下一阶段方法，不视为功能验收通过。

## 初步线索闭环与验收映射

R01→F04；R02→F02；R03→F03；R04→F07及DOM待验证；R05→F14；R06→F05；R07→F10；R08→F15；R09→F01并保留有限拆分候选；R10→F13及服务复用风险。没有悬空的“肯定要重构”结论。

AC1：全覆盖矩阵；AC2：每项注明实测/静态/待验证；AC3：生命周期表与根/子路径、错误输入证据；AC4/AC5：见 [行动清单](action-plan.md) 的选择、文件、归类、依赖和回退；AC6：明确原生与浏览器环境差异；AC7：计划阶段及本次审查未改应用/测试/配置代码，任务和实际证据已更新。审查完成不等于这些修复或设备验收已完成。
