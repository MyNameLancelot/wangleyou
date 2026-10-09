# 全模块审查执行计划

> 2026-10-09：用户已要求删除独立 JPEG 压缩工具及专属测试。本记录中该工具的审查/修复/测试为历史证据，不再作为现行命令或待实施拆分任务；其他模块结论与验证状态保持。见 [退役变更](../remove-photo-compression/spec.md)。

> **For agentic workers:** 执行时使用 `executing-plans` 按任务推进。写计划已完成，2026-10-01 用户已授权执行全面审查；候选修复仍不自动实施。未获得用户的并行工作指示时不委派子代理。

执行结果见 [findings](findings.md)，实施建议见 [action-plan](action-plan.md)，实际阶段状态以 [tasks](tasks.md) 为准。下方保留执行前检查步骤；设备依赖和真实后台等缺口在结果中明确列出，不表示所有功能验收通过。

**Goal:** 全面核对模块与工程能力，形成有复现证据、优先级和取舍的 bug 修复、优化与结构调整建议。

**Architecture:** 保持现有模块公开入口和状态归属。先做基线与行为核对，再逐模块审查，最后按证据选择最小改动；拟议的新文件不是已批准的架构变更。

**Tech Stack:** React + TypeScript + Vite，Node 24/npm，Vitest、Playwright，sharp；Android JDK 17/SDK 35/Gradle 8.11.1；iOS UIKit/WebKit，仅静态审查。

## 全局约束

- 当前交付审查证据与行动清单；实际完成状态由 tasks/change.json 与 findings 记录，修复尚未实施。
- 保持公开纯静态站、唯一 book 主题、共用 media-viewer、playback 唯一业务状态；不新增原生桥接或恢复音乐入口。
- 不按行数机械拆分，不以跑分或测试数量代替质量，不随手删除有验收价值的测试。
- 保护 chore/docs-cleanup 的未提交文档，独立维护两项记录，不提交/推送/发布，不改家庭源素材和本机签名资料。
- 用户已暂缓 iOS：可读代码、核对工程配置；不启动 Xcode 编译、签名或设备交付。
- 审查中每项结论注明静态事实/推断/已复现/不可验证，并记录路径及执行时的行号。

## 方案与顺序

采用“全覆盖扫描 → 高影响行为复现 → 条件式结构评估 → 行动清单”。直接按大文件拆分容易扩大回归面；只运行已有套件会漏掉未覆盖场景。当前方案兼顾完整覆盖和实际影响。

执行顺序：T0 → T1 → T2/T3/T4 → T5/T6/T7 → T8 → T9。T2/T3 先处理查看器与内容管线线索；其他任务是逐模块核对，不要求模块必须修改。这里的多项可独立只是依赖描述，默认由当前执行者顺序完成。

## 文件与交付职责

| 文件/范围 | 本轮 | 审查执行阶段 |
| --- | --- | --- |
| 本目录 spec/plan/tasks/change.json | 新建计划与状态 | 更新范围、进度、实际验证 |
| `docs/changes/README.md` | 增加独立入口 | 反映审查状态 |
| `docs/changes/module-review/findings.md` | 不创建 | 逐模块事实、复现结果与保留理由 |
| `docs/changes/module-review/action-plan.md` | 不创建 | 选定问题的具体实施文件、接口、依赖、测试、回退 |
| src/scripts/native/tests/工作流与配置 | 只读准备 | 审查只读；有必要的合成复现放临时目录，真实修复另行实施 |

## 已有静态线索（不等于全面审查结果）

下列位置基于 main `0f07471` 的应用代码，文档采用当前工作区清理结果；执行时重新确认位置和基线。

| 编号 | 代码证据 | 需核对的影响与复现 | 初始处置 |
| --- | --- | --- | --- |
| R01 | `src/media-viewer/MediaViewer.tsx:142` 视频事件 effect；App 无查看器可见性监听；安装的 Slideshow 插件用 timeout，未见 visibilitychange | 用户启动幻灯片或视频后切后台，是否暂停、回前台是否等待主动继续；须核对库/浏览器实际行为 | 优先行为复现，暂不宣称 bug |
| R02 | `scripts/generate-media.ts:51` 仅派生不大于源宽的 480/960/1600/2560 候选，59 行对空候选抛错 | 320px 合法照片/封面是否因低于 480px 阻断构建，与“不放大”要求是否冲突 | 高优先级边界复现 |
| R03 | `scripts/generate-media.ts:108` 先写源索引，164/165 行最后写缓存与发布索引 | 图片损坏/中途失败后，是否覆盖上次有效发布索引、留下不一致缓存/派生文件 | 故障注入后决定是否调整写入顺序 |
| R04 | `src/media-viewer/MediaViewer.tsx:83` 寄语宽度使用 `Math.max(160, mediaWidth - 24)`，68 行测量 effect 与142行媒体监听各扫描 DOM | 窄竖图寄语可能超出影像；晚挂载、缩略图收起、全屏、换项是否用旧 DOM | 先复现，再决定是否拆内部 DOM 生命周期 |
| R05 | `src/albums/home-memory.ts:16` 等旧两屏/滚轮函数无生产调用；159 行 step 默认循环，book 显式传 false | 当前实际需要的纯契约与过时能力边界，默认参数是否容易引入循环回归 | 全仓调用核对后评估清理，不靠名称删代码 |
| R06 | `scripts/generate-photo-index.ts:29` 接受大小写视频扩展名，31/124 行封面对应固定 `.mp4` 并用大小写敏感匹配 | `clip.MP4` + `clip.poster.jpg` 是否被误报孤立封面；重复封面候选与同名 ID 边界 | 合成目录复现，再确定契约 |
| R07 | `scripts/sdd/check.ts:81` 主题检查硬编码 beach/grassland | 当前 book 与未来主题之间的违规导入是否漏检；未发现实际违规导入 | 确认检查覆盖缺口，不能推断现有 UI 已串用 |
| R08 | `src/app/module.md` 引用不存在的 `tests/browsing.spec.ts`，允许依赖未列实际 media-viewer/shared；playback 文档仍称主题查看器；content 注释仍称排序实现 | 契约/测试入口漂移，实际代码方向是否正常 | 文档事实核对，单独判断是否需改实现 |
| R09 | `scripts/compress-photos.ts` 同时含 CLI、扫描/命名、HEIC 子进程、编码/并发与报告；已有多类边界测试 | 能否围绕副作用归属拆分并降低修改耦合，是否值得承担回归成本 | 结构候选，不凭文件长度决定 |
| R10 | `scripts/serve-built.mjs` HEAD 和 Range 都先 readFile 全文件；Playwright 可复用已有服务 | 大视频验收服务器内存/数据读取，以及根路径测试是否误连上一个子路径服务 | 只优化验收工具，先测量，不等同生产性能问题 |

## T0：确定执行基线与验证环境

**读取：** AGENTS、requirements、architecture、本次规格、所有 module.md、package.json、锁文件、README、现有变更声明。

- [ ] 记录 HEAD、分支、工作区差异与 Node/npm/Chrome 版本。保护已存在文档清理；如需独立分支，不把其他任务改动混入修复提交。
- [ ] 确认 Node 24、现有依赖和浏览器可用；不自动安装/升级工具。检查模拟器可用性，只读取设备信息，不读取或输出签名凭据。
- [ ] 建立 findings 的模块矩阵与证据格式，保存初始基线结果；失败保持失败，不先改测试让基线“变绿”。

```sh
git status --short --branch
git rev-parse HEAD
node --version
npm --version
npm run check
npm run build
npm run test:e2e
```

预期：得到真实结果、失败位置及适用环境，而非预设全部通过。tsx IPC/浏览器端口遇沙箱限制时依环境请求必要执行权限。浏览器测试跑 dist，记录 Chrome 版本、1440×1000 和 360×800；后续定向增加 390、820、1024 视口。

## T1：app、shared、模块入口与契约

**读取：** `src/app/{App.tsx,router.ts,index.ts,module.md,global.css}`、`src/shared/{routing.ts,index.ts,module.md}`、各模块公开入口、`src/themes/contracts.ts`、`tests/navigation.spec.ts`。

- [ ] 绘制实际 import/调用清单，核对架构与 module.md，检查跨内部引用、循环方向、共享 UI 和状态复制。shared 当前仅 Route，默认保留，不把杂项塞进去。
- [ ] 核对 hashchange、online/offline、document.title、Session ref/state、localStorage 降级和回调时序。用当前代码评估是否需要封装命令装配，不能把业务状态搬出 playback。
- [ ] 检查空/非法 Hash、URL 编码失败、未知相册、查看器打开后改路由/返回、离线、存储访问抛错；核对 R08 的事实和正确测试入口。

```sh
npx vitest run src/app/router.test.ts src/content/asset-url.test.ts
npx playwright test tests/navigation.spec.ts tests/music.spec.ts
```

输出：两个模块的保留/调整理由及所有契约偏差。只有 App 命令/副作用出现明确独立职责时才考虑内部 hook；当前小型 router/shared 无机械拆分理由。

## T2：playback 与共用查看器的状态/资源

**读取：** `src/playback/{session.ts,background-music.ts,index.ts,module.md}`、`src/media-viewer/{MediaViewer.tsx,MediaViewer.module.css,module.md}`、`src/app/App.tsx`、`tests/viewer.spec.ts`、安装版 lightbox/plugin 源码。

- [ ] 对每个视频/插件/DOM/监听/RAF/ResizeObserver 列创建、所属媒体、失效条件和清理点。特别检查播放 Promise 迟到、命令引用变化、慢挂载超过扫描期限及旧事件回写。
- [ ] 复现 R01：照片手动开始幻灯片后隐藏页面并等待超过一个周期，回前台仍停当前项且不自动继续；视频播放后隐藏/返回，媒体暂停且等待用户继续。真实切后台与合成 visibility 事件分开记证据。
- [ ] 复现 R04：窄竖图、长寄语、旋转、缩略图收起、进出全屏、缩放/平移后的条位置；影像宽低于184px时检查寄语宽不超过影像减24px。验证图片/控件点击不退出、背景关闭、Tab 正反回绕和恢复触发焦点。
- [ ] 快速视频→照片→视频、重复打开/关闭、播放拒绝、错误、ended、单张/末项分别核对；确认“视频自己结束”和“用户已启动幻灯片推进”的区别。
- [ ] 检查保留音乐纯状态/组件的契约，但不挂载音乐或增加 UI。

```sh
npx vitest run src/playback/session.test.ts src/playback/background-music.test.ts
npx playwright test tests/viewer.spec.ts tests/music.spec.ts
```

输出：R01/R04 的复现或排除证据、真实媒体/焦点风险。若确有混杂副作用，可候选拆为模块内部 `useViewerVideoEvents.ts`、`useViewerCaptionLayout.ts`、`useViewerFocus.ts`；公开入口仍 MediaViewer/MediaViewerCommands，不新增第二套会话。需先比较复用库 refs/callback 与自行 DOM 扫描的收益，行为修复与结构提取分别评估。

## T3：content、索引/媒体生成与发布校验

**读取：** `src/content/{model.ts,validate.ts,index.ts,module.md}`、`scripts/{generate-photo-index.ts,generate-media.ts,validate-content.ts}`、对应测试、`media-source/*/meta.json` 与显式 home-memory 配置。

- [ ] 检查文件名/ID/目录月份和顺序、Unicode 长度、未知字段、大小写 MP4/封面、重复封面、源/发布相对路径、编码穿越、symlink、候选宽高比、日期和缺资源定位。
- [ ] 在临时相册复现 R02/R06：320×213 照片、320×180 封面、EXIF 旋转图、`clip.MP4` 与同名封面、占位↔真实封面切换。完整临时目录使用现有 `generate-media.test.ts` 的 workspace 模式，不碰真实源素材。
- [ ] 核对冷缓存/热缓存/单素材变更/文件删除/缓存文件缺失/JSON损坏、同名视频变字节；记录重编码和旧产物清理是否只作用于生成资源。
- [ ] 故障注入 R03：先成功生成并保存有效索引/清单/产物列表，再放损坏图或模拟写入失败重跑；比较失败前后索引、缓存、旧产物是否一致，单列影响，不假定需要复杂事务系统。
- [ ] 测量读取/解码内存、视频哈希整文件读入和重复生成次数；有数据后比较流式哈希、配置去重和写入顺序，不预先并行编码所有图。

```sh
npx vitest run src/content/content.test.ts src/content/asset-url.test.ts scripts/generate-photo-index.test.ts scripts/generate-media.test.ts scripts/validate-content.test.ts
```

后续确认修复 R02 时，可在现有测试文件使用下列回归用例；本轮不添加测试，也不宣称已运行：

```ts
it('keeps photos below 480px without upscaling', async () => {
  const space = await workspace();
  await sharp({ create: { width: 320, height: 213, channels: 3, background: '#2a6f7a' } })
    .jpeg().toFile(join(space.root, 'media-source/2025-05-sequence00-周岁/top01.jpg'));
  await generateMedia();
  const photo = (await space.index()).content.albums[0].media.find((item: { id: string }) => item.id === 'top01');
  expect(photo.width).toBe(320);
  expect(photo.srcSet.length).toBeGreaterThan(0);
  expect(photo.srcSet.every((item: { width: number }) => item.width <= 320)).toBe(true);
});
```

输出：构建边界及失败一致性结论。优先局部修复；只有编码/缓存/文件发布确需独立职责时，候选在 `scripts/media/` 中提取 `variants.ts`、`manifest.ts`、`publish-video.ts`，CLI 和 npm 入口不变；不能把 Node IO 搬进 runtime content。若变更缓存格式/路径/字段，必须 full 并明确旧缓存失效及完整重建回退。

## T4：albums 与 book 页面/图片/动画

**读取：** `src/albums/{home-memory.ts,index.ts,module.md}`、`src/themes/book/{BookApp.tsx,ThemeHome.tsx,PageTurn.tsx,ThemePages.tsx,PhotoImage.tsx,browser.ts,BookMusicToggle.tsx}`、对应CSS/token及 `src/themes/contracts.ts`。

- [ ] 全仓核对 R05 的生产调用、仅测试调用与无调用导出；分别判断旧两屏逻辑、wheel 状态及循环参数是否仍有支持范围，不连带删除当前横滑/interval边界。
- [ ] 检查首页 state/ref、手势起止/cancel、锁重入、手动/自动计时、末页回翻、visibility、焦点/悬停显式继续、memory 改变和动画中卸载。还需核对自动末页的 role=status 是否引入需求禁止的自动朗读。
- [ ] 检查 PhotoImage 缓存命中/失败/换 src 或 srcSet、占位比例与键盘；主回忆是否用了过大候选，封面是否过早加载多层，性能建议须结合实际网络体积。
- [ ] 留影筛选/年份/顺序、固定顶部与定位偏移、详情opening回退、混排/空态及窄宽布局逐项比需求；核对共享样式、重复 token 和已不用的 CSS。
- [ ] 评估页面拆分与状态拆分分别带来的收益：多路由独立生命周期可候选 `BookBrowsePage.tsx`、`BookAlbumsPage.tsx`、`BookAlbumPage.tsx`；首页可候选 `useBookHomeMemory.ts`。全部留在 book，不共享主题 JSX/CSS，不改共用查看器。

```sh
npx vitest run src/albums/home-memory.test.ts
npx playwright test tests/book-home.spec.ts tests/home-memory.spec.ts tests/browse.spec.ts tests/themes.spec.ts tests/responsive-a11y.spec.ts
```

输出：页面/首页能力的保留、局部优化或有理由的拆分建议；文字/布局与无障碍语义变化要单独 full，不能混进内部提取。

## T5：照片压缩工具、静态服务器与 SDD

**读取：** `scripts/{compress-photos.ts,compress-photos.test.ts,serve-built.mjs}`、`scripts/sdd/{check.ts,cli.ts,check.test.ts,git.test.ts,module.md}`。

- [ ] 压缩工具分开核对参数/退出码、递归扫描与symlink、输出目录隔离、命名冲突、覆盖规则、dry-run、HEIC 子进程失败/清理、并发与报告稳定性。临时输入输出，源哈希/mtime不变；不调用真实家庭目录。
- [ ] 用现有多边界测试衡量 R09 的职责耦合；候选 `scripts/photo-compression/` 内部 options/scan/encode/report 文件，而 `compress-photos.ts` 保持原 CLI/导出/退出码。没有复用或隔离收益就保留。
- [ ] 在临时dist核对静态服务器 GET/HEAD/Range（首段、后缀、越界、空文件）、编码路径和symlink出界；记录R10的整文件读取开销。该服务器不是线上服务，不把它的数据直接当生产性能指标。
- [ ] SDD构造独立Map/临时Git样本，测试R07、跨模块内部导入、barrel re-export、已有规则允许/拒绝、模块文档缺失、删除文档引用、full/light与staged/worktree/range区别。别名/非字面量动态导入按现有“不支持”契约检查，不机械扩展到所有语法。

```sh
npx vitest run scripts/compress-photos.test.ts scripts/sdd/check.test.ts scripts/sdd/git.test.ts
npm run check:sdd -- --worktree --base origin/main
```

输出：工具风险/收益与验证缺口；SDD工具规则变更必须同时给允许和拒绝的测试样本，不为加严检查改变模块设计。

## T6：Android 与 iOS 原生边界

**读取：** `native/android/module.md`、MainActivity、StartupOverlay、manifest/资源/Gradle/`package_family_apk.py`；`native/ios/module.md`、SiteViewController、AppDelegate、Info.plist、工程/scheme及 `.github/workflows/native.yml`。

- [ ] Android静态核对HTTPS host/path/port/user-info/new-window、重定向/外链、只主框架错误覆盖、返回优先级与网页DOM契约，WebView创建/保存/销毁与媒体全屏回调。
- [ ] 列StartupOverlay的视频/纹理/Surface/MediaPlayer/listener/动画/延时任务所有者；检查首次onPageStarted、快慢网络、跳过、失败/关闭动画、后台/旋转/重建、销毁后的迟到回调。核对系统栏、安全区和颜色状态切换，不默认更换实现。
- [ ] 检查打包命名、版本、签名环境输入及不携带网页/家庭媒体的规则，只读现存包即可；缺APK或SDK时记录缺口，不重新生成私钥或改包名。
- [ ] iOS仅静态检查导航规则、子frame与targetFrame、进度/错误、KVO所有权、安全区及工程配置。列出需用户恢复后在Xcode/设备核对的点，不运行iOS构建。
- [ ] Android已有可用模拟器时定向复验；无设备则保持静态推断。真机、Android15和厂商差异不能靠API34模拟器覆盖。

可用Android环境下的后续命令：

```sh
cd native/android
./gradlew :app:assembleDebug --offline --no-daemon
```

网络缓存不足记录失败；构建通过只说明编译，行为需另记。原生导航/系统栏若出现独立生命周期可评估内部 helper，但不得抽象成共享网页状态或引入桥接。

## T7：配置、依赖、工作流和静态产物

**读取：** `package.json`、锁文件、Vite/TS/ESLint/Playwright 配置、`.gitignore`、`.github/workflows/{check.yml,deploy.yml,native.yml,module.md}`。

- [ ] 核对源码实际使用与依赖、unused导出/资产和重复命令；保留音乐属于明确预留能力，不能等同无用依赖。版本依据锁文件，不在此阶段升级包。
- [ ] 核对同提交checkout、PR差异基点、权限、缓存目录/键与派生路径、失败依赖、main-only部署、原生手动触发。重复main检查是现有明确取舍，不能单凭重复就合并工作流。
- [ ] 验证根路径和仓库子路径的两次独立构建/静态测试；切换base前停止上一测试服务器，避免reuseExistingServer误测旧产物。可用actionlint时执行，不可用时记静态核对范围，不安装。

```sh
SITE_BASE=/ npm run build
SITE_BASE=/ npm run test:e2e
SITE_BASE=/wangleyou/ npm run build
SITE_BASE=/wangleyou/ npm run test:e2e
```

检查dist：无media-source、原图、签名凭据、网站服务端；MP4和派生封面存在，全部媒体URL匹配对应base。只有依赖或构建方案形成新长期取舍时写ADR；不发布实际站点。

## T8：测试质量与遗漏复核

**读取：** `src/**/*.test.ts`、`scripts/**/*.test.ts`、`tests/*.spec.ts`、`tests/support.ts`，结合T1–T7结果。

- [ ] 建立“需求场景→实现→测试”表，判断真正在测行为还是重复实现；只模拟/只默认fixture覆盖不到的路径单独标出。
- [ ] 核对test.skip适用原因、固定相册/媒体数量、隐式共享状态、测试修改源配置或process.cwd的恢复、定时等待、服务复用、并行互扰。失败先看trace和断言，不仅增加timeout或重试。
- [ ] 核对库DOM依赖的集中程度和helper中的强制focus是否掩盖真实打开焦点问题；tests/support.ts保留领域便捷操作，避免变成通用巨型封装。
- [ ] 汇总真正需要的回归用例、可以删除的失效用例及保留理由；只针对确认问题增加测试，不追求覆盖率或文件拆分数量。

输出：验证矩阵、断言质量与覆盖缺口，明确浏览器模拟/原生模拟器/真机分别能证明什么。无需为每个函数增加机械单测。

## T9：形成行动清单与实施边界

- [ ] findings按全部模块逐行给结论，即使“无需修改”也给依据；所有R01–R10都有复现/排除/待验证结果。
- [ ] action-plan先排可复现缺陷，再排有测量收益的优化与结构提取；列每项 exact files、现有/拟议公开接口、状态/资源归属、light/full、文档同步、测试命令/预期与回退。不能只写“适当重构”。
- [ ] 每项重构比较不改、局部提取、模块拆分；复用现有依赖与平台能力，新增依赖必须有明确选择理由。
- [ ] 范围不变的常规修复不反复确认；改变页面/交互/数据/架构约束时先更新规格并确认新增范围。执行审查本身不代表已授权全部候选重构。
- [ ] 核对AC1–AC7，更新实际证据；只有用户要求实施时再进入代码任务。未验证项目保持未完成。

## 验证、回退和完成界限

写计划阶段：只验证计划覆盖、文件/链接/SDD声明与代码位置，不运行应用/原生构建或浏览器审查。审查执行阶段：基线套件→逐模块定向复现→根/子路径静态验证，不在代码未变且已有结果时重复全量测试。

将来修复阶段：针对该问题先补有意义的失败证据，再最小修复、相关测试和必要全量验证，按任务记录结果；内部重构需确认UI与状态契约等价。每项回退只恢复该项文件，缓存格式变化可删除仅派生缓存并完整重建，不能删除原素材或重置其他任务改动。

完成“写计划”仅代表本轮文档交付；完成“全面审查”需矩阵和实际证据齐全；完成“修复”需独立验收通过。三者不能相互替代，不自动提交、推送或发布。
