# 修复验证证据

日期：2026-10-01；Node 24.18.0 / npm 11.16.0。当前分支 chore/docs-cleanup，保留之前文档整理与审查的未提交改动；本轮未提交、推送或发布。

## 检查与浏览器

| 验证 | 实际结果 |
| --- | --- |
| 最终 `npm run check` | SDD structure、生成/发布资源校验、typecheck、lint通过；13文件143项单测全部通过 |
| `SITE_BASE=/ npm run build`、默认 `npm run build` | 均通过；最终恢复 /wangleyou/，JS约343.11kB、CSS约41.69kB |
| 默认 `CI=1 npm run test:e2e` | 88通过、6按项目适用条件跳过；当时查看器行为已修复，内部hook尚未提取 |
| `SITE_BASE=/ CI=1 npm run test:e2e` | 提取hook之后88通过、6跳过；根路径URL断言已修复 |
| 恢复默认产物后 `CI=1 npx playwright test tests/viewer.spec.ts` | 44项全部通过，覆盖提取后播放/布局生命周期 |
| SDD主题定向 | 21项通过，包含book/未来主题/点号目录、动态字面量/重导出/require拒绝、contracts与同主题允许 |
| SDD worktree | 最终回填后通过，133个差异路径由三份记录共同覆盖；33份Markdown的97个本地链接及5个锚点均存在，git diff --check通过 |

浏览器：Chrome 154.0.8037.58；主项目1440×1000桌面、360×800手机模拟。布局专项包含390×300、390/820/1024及全屏/缩放；冷资源矩阵在首页和索引分别建立390/820/1440 × DPR1/2/3独立上下文。平台跳过包括只适用桌面控件/手机手势的用例，以及仅desktop调度、内部自行覆盖全部宽度与DPR的网络矩阵；不是失败忽略。

新增浏览器证据包括合成hidden下幻灯片/视频暂停、前台主动继续、隐藏挂载、迟到play成功/拒绝、关闭重开、raw正反Tab/Escape、窄图/短视口/缩放寄语、首页一键恢复与独立暂停、末页无live语义、卷页候选复用和失败布局保持。合成visibility getter与事件不能证明真实后台行为。

## 素材与发布完整性

- 压缩修前的叶子symlink、祖先逃逸、hardlink三项回归均失败；修后25项压缩测试全部通过。输出真实路径为任何输入链接别名时也拒绝，hardlink只替换输出目录项。编码失败保留已有输出，无关文件保留，dry-run原有零写入测试保留。
- 小照片/真实封面320×213、479×100、1×1、1200×1均可生成，尺寸来自编码结果且不放大；EXIF方向6的320×213源图派生为213×320、元数据清除、源字节不变，热缓存保持相同结果；定向22项通过。损坏JSON/结构/版本、缺产物、热缓存和删除图回归通过；伪造尺寸重新核对源geometry，不将任意缓存路径带入删除。
- 目录扫描改为内存返回；后续坏图、缓存替换失败、索引替换失败均保留旧索引/缓存和发布文件。最终22项媒体生成定向测试通过（包括全量check后补充的EXIF小图回归）；失败只清理本轮新建文件，最终发布后才清理旧哈希，暂存目录清理失败仅警告。
- 独立管线审查发现派生器仍直写最终WebP、可经链接改写源图的遗漏，已补安全临时编码/替换和目录检查；symlink、hardlink、祖先链接与缓存尺寸伪造4项回归通过。生成器CLI guard也改为明确入口匹配，作为模块导入不触发生成。
- 核对media-source的43个受控文件与HEAD逐文件SHA-256相同，未改家庭/演示源字节。当前生成配置7册、34媒体，发布引用由validate:content检查；生成JSON中的哈希变化来自profile v3，不手工编辑数据。
- MP4扩展名大小写、Unicode stem、孤立/重复封面与保留stem大小写测试通过；同stem多视频在扫描期报错。没有添加视频转码/抽帧。

## 传输与工具测量

- 冷Chrome390×844、DPR1：首页实际影像284px，选480w，文件body39,818B（Resource Timing含响应头40,118B）；修前1600w为320,208B。卷页复用currentSrc，矩阵断言没有重新请求该已显示图，DPR1不额外请求1600/2560w。
- 头图原尺寸1254×1254：PNG1,497,405B → lossless WebP1,132,128B（约减少24.4%），6,290,064 RGBA字节逐字节相等；主执行者视检两图一致，独立整体审查也复核像素相等。页面裁切CSS不变，原PNG保留。未采用q80/960w有损方案，不将先前26,920B试算当交付结果。
- 静态服务器5项测试涵盖两种base、GET/HEAD/首段/后缀/开放Range、416/空文件、symlink/编码穿越、100MiB文件和客户端断开后继续服务。HEAD不读body，GET按范围流，pipeline销毁资源。
- 独立100MiB稀疏合成文件：HEAD200/长度104,857,600/body0；32B Range206/Content-Range正确/body32。RSS初始60,964,864B、峰值63,422,464B、增量2,457,600B；同一修前脚本测得增量212,910,080B。这是本机工具测量，不是线上性能保证或固定内存测试阈值。

## 审查、拆分与真实状态

A1/A2经独立只读审查发现的问题已修复；最终整体审查和新增失败产物回收复审未发现确定Critical/Important。没有新增依赖；复用sharp、Node文件/流和库插件ref。查看器提取useViewerPlayback/useViewerCaptionLayout及命令类型，owner仍media-viewer；App持有唯一Session，playback纯函数转换。删七个全仓无调用旧导航函数和确定未使用CSS，保留有效循环边界测试、当前interval与明确预留音乐能力。CLI编码模块暂不拆，缺少频繁策略变更的收益证据。

上述为续验前状态；2026-10-02 的新增设备/浏览器证据与局部修复见下节。状态仍 awaiting_device_verification，真机和 macOS 旁白没有用自动化结果代替。


## 2026-10-02 剩余验收与补充修复

用户明确 iOS 不需要做，本次没有执行 iOS 工作；用户又确认“目前没有，保留真机待验收”。所有新增安装限于现有 wly34 模拟器和独立 `.verification` 包，家庭 App 保留，网站和 Release 未更新。

### 当前本地产物与浏览器

- 慢 portal 复现：延迟 body 插入 5.5 秒后原视频不播放；同项 video 替换后也不播放。修改前两项失败，修改后通过。此测试人为延迟 DOM 连接，验证适配器绑定，不冒充浏览器自然发生了 5.5 秒延迟。
- 原 3 秒 / 240 帧扫描改为平台 MutationObserver 观察当前 portal/slide/media 身份；DOM 替换解绑、暂停旧 video，使每个旧 play 请求与事件失效；寄语重绑尺寸/加载/transform 观察。没有新增依赖，业务状态仍归 playback。库未提供当前媒体 DOM ref；延长超时仍有遗漏，故选生命周期观察而非持续 RAF。
- 桌面/移动查看器最初 50 项通过；最终双 base 完整套件各 **94 通过、6 条件跳过**（100 定义，无重试）。之后只补延迟照片寄语断言及名称，默认子路径 6 项定向再次通过。根路径与默认 build 通过，最后恢复 `/wangleyou/` 产物。
- 独立 Chrome 154.0.8037.58，1440×1000：通过 CDP `noDefaults: true` 接入，未修改 visibility getter。实际切到另一标签页得到 hidden，幻灯片保持第1项；视频进入暂停，回来仍暂停。之前普通 Playwright 的主连接焦点模拟会强制 visible，新 CDP session 关闭模拟不足以覆盖主连接，故此前结果不能算真实后台证据。

### Android / TalkBack

环境：Android Emulator 37.1.11.0，wly34 / Android 14 API 34，320×640、横屏640×320，系统 WebView 113.0.5672.136，TalkBack 14.2.0.618048417；JDK17.0.20、SDK35。临时包只加 applicationId 后缀与 WebView 调试；之后另加仅临时 SDK Instrumentation 入口，项目未新增依赖或桥接。

- 当前未发布网页通过 CDP 在测试 WebView 内用本地 dist 响应原 HTTPS host 请求；URL/导航白名单不变。真实 Home 键后台得到 hidden，幻灯片第1项在后台/前台各3.5秒保持；视频时间0.390514秒保持暂停，主动播放后继续。照片全屏、系统返回先退出全屏再关闭查看器通过；视频元素全屏与返回仍保留查看器通过。横屏640×320无横向溢出，旋转设置恢复。
- 断网关闭真实 Wi-Fi/移动数据，原生显示中文错误及重新连接；不能用 CDP fulfil 503 证明 WebViewClient 的 HTTP 错误回调（该注入未触发原生错误层）。网络恢复后实际原生重试操作回到首页。
- TalkBack 实际发现底层 WebView 英文错误页仍会被访问；`MainActivity` 在主框架加载和失败时设 INVISIBLE，成功回调恢复。修后 SpeechControllerImpl 实际提交“暂时没能打开…检查网络后，再试一次…你的回忆还在这里等你”，而非底层英文 WebView 错误。临时 SDK Instrumentation 使用 `FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES` 验证重试标签“重新连接”、visible/enabled=true、ACTION_ACCESSIBILITY_FOCUS=true；这是实际平台焦点/标签证据，不等同于人为听感评价。
- 当前本地产物末页在等待翻页结束后的无输入观察区间未出现末页语音，DOM live/status 数量0；日志只有先前焦点标题/Webview。含主动导航的其他阶段可产生 WebView TYPE_ANNOUNCEMENT，不能将它与自动 live 混同。原生冷启动连到现有公网网站时网页仍是旧版本，旧首页语音不能作为当前未部署代码的结果。
- 冷启动开屏改用真实移动数据（关闭 Wi-Fi），仅清空本次测试包缓存，模拟器 GSM 限速加500ms延迟。3秒为本地视频进行中；12秒/13秒等待网页，视频中心区域280×390 RGB字节完全相同，光条仍移动；恢复 full/none 与 Wi-Fi 后进入网页。仅证实该模拟器尾帧等待及恢复，不将配置速率当实测吞吐。最初 CDP 延迟8.5秒的截图时序与原生加载不一致，已剔除“尾帧通过”的结论。
- 仓库实际 `native/android` 与独立临时包 `:app:assembleDebug --offline --no-daemon` 均通过。实际源修改只有 MainActivity 两处隐藏调用及模块契约，家庭签名 APK 未重发，当前版本号不代表局部修复已经发布。

临时证据均位于 `/private/tmp/`：`wangleyou-real-hidden-results.json`、`wangleyou-android-remaining-results.json`、`wangleyou-talkback-passive.log`、`wangleyou-talkback-instrument.log`、`wangleyou-android-accessibility-instrument.txt` 与 `wangleyou-android-cold-mobile-*.png`。长期基线不提交过程截图；本节保留环境、操作和结论，临时文件不保证永久存在。

macOS 旁白控制连接尝试超时，VoiceOver Utility 未找到运行应用，未实际验证阅读；检查旁白未在运行，没有留下开启状态。真机首次/覆盖安装、开孔/系统栏、厂商 WebView 与真实弱网差异保留待验收；iOS不执行。必要证据未齐，不标记整项完成。


### 最终收尾

Node24.18.0/npm11.16.0 最终 `npm run check` 通过：13 文件144单测、内容/结构/typecheck/lint 全部通过；`check:sdd -- --worktree --base origin/main` 通过（136 差异路径）。43 个受控源素材与 HEAD SHA-256 一致，`git diff --check` 通过。默认子路径 dist 保留。

辅助功能开关恢复原值（accessibility_enabled=0、services 未设置），测试日志/覆盖层开关移除；Wi-Fi/数据/旋转恢复（1/1/0/1），模拟器网络 full/none。独立验收包与本次安装的两个 Playwright Android 驱动包全部卸载；原家庭 App 仍安装；adbd 恢复非 root，本次模拟器关闭。旁白没有在运行。没有提交、推送、部署或重发家庭 APK。

## 用户真机验收与 PR 收尾（2026-10-02）

用户通过局域网下载 v1.0.11 家庭签名 APK 后明确反馈“真机没问题”，并授权“收尾然后 commit push pr”。Android 真机验收记为用户反馈通过；未提供机型、系统/WebView 版本和逐项日志，不虚构设备参数或专项结果。APK 仍加载当时的线上网站，所以此反馈不能证明未部署的网页修复已在真机上通过。

macOS 旁白实际阅读仍未验证，修复记录保持该项待验收；iOS 按用户要求排除。已完成的历史变更记录清理与本次独立声明一并提交，本次 PR 保留其变更记录，合并后再按 SDD 退役已完成记录。网站未部署，不合并 PR。

本次提交前再次执行 Node24.18.0 `npm run check`：13 文件144项单测、内容/结构/typecheck/lint全部通过。后续仅文档状态同步与版本交付记录变化，沿用此前双base各94通过6条件跳过及Release签名构建证据，不重复未变化的浏览器套件。用户验收后临时局域网下载服务已关闭。

完整暂存差异的 SDD 检查通过（138 个路径）；43 个受控源素材与分支基点 SHA-256 一致。暂存新增/修改共68文件，未包含私有目录、APK、签名材料或密钥/token模式；暂存 diff 空白检查通过。源码标签保持原基线，不修改测试发布标签；PR 提供完整修复源码。
