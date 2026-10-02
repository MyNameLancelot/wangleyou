# 审查后的行动清单

依据 [审查结果与证据](findings.md)。以下保留审查时的行动方案快照。用户随后明确要求修复，A1–A7 已按独立 [修复记录](../module-repairs/tasks.md) 落地，实际结果见 [验证证据](../module-repairs/verification.md)。本文件原未勾项是建议步骤，不作为当前修复状态；D1设备与暂缓iOS、D2条件式方案仍按各自边界保留。

## 推荐顺序

`A1 → A2 → A3 → A4 → A5 → A6 → A7`。A3可在A1/A2后独立推进；A4的测试应先完善，再作为A5/A6的回归工具。A7是条件式结构提取，正常行为稳定后才做。原生专项D1和低收益D2均不阻塞前端/管线局部修复，但保持未验证。

| 工作 | 覆盖问题 | 优先级 | SDD | 选择及收益 |
| --- | --- | --- | --- | --- |
| A1 压缩输入保护 | F01 | P0 | full（文件写入/失效生命周期） | 先修每项目标校验和安全替换；不先拆CLI |
| A2 管线完整性与小素材 | F02/F03/F06，F05 | P1/P2 | full（候选/缓存/索引提交契约） | 成功才提交索引，恢复损坏缓存；保持源素材只读 |
| A3 后台/寄语与首页语义 | F04/F07/F08/F09 | P1/P2 | full（播放及无障碍语义） | 恢复已确认需求；复用插件ref，不复制业务状态 |
| A4 验证规则与根路径 | F10/F11 | P2 | light（修复检查工具，产品/架构不变） | 正反例覆盖真实主题，测试不写死base |
| A5 图片传输 | F12 | P2 | light起步；若改变素材外观则full | 先复用既有srcSet/sizes，再独立核对头图压缩 |
| A6 服务器读取 | F13 | P2 | light（仅验收工具） | HEAD只stat、Range按范围流，保留HTTP与路径契约 |
| A7 死代码与内部边界 | F14/F15 | P2/P3 | 文档/死CSSlight；接口/归属变更full | 先纠正文档、删确定残留；有限提取查看器/编码副作用 |

实际实施前新建对应 change.json，逐项检查需求、架构、module.md、ADR、README影响。下面文件清单是拟议范围，不包含其他任务的未提交差异。常规恢复既有需求无需再次确认；新增重复封面规则或改变架构/交互范围先明确规格。

## A1：保护每个压缩输入与已有输出

**修改：** `scripts/compress-photos.ts` 的canonicalPath、processFile、encodeToJpeg/encodeHeic写入路径；`scripts/compress-photos.test.ts`；README压缩约束；对应full变更记录。

**接口：** 保持 `CompressOptions`、`runCompress(options,deps): Promise<CompressReport>`、`main(argv,deps): Promise<number>`，以及0/1/2退出码；不引入依赖。新内部写入函数接收本项 input/outPath/outputRoot，拥有临时输出的创建、成功rename与失败清理。

- [ ] 在现有临时workspace加入叶子symlink、父目录symlink、hardlink样本；只使用临时输入，首先证明原实现改写输入指纹。
- [ ] 逐项目标路径检查真实祖先在outputRoot内；拒绝链接逃逸/输入别名。选择同目标目录唯一临时文件，先编码再替换，成功后不得跟随既有hardlink/symlink写原inode；失败删除仅本项临时文件，保留最后有效输出。
- [ ] 测正常重复覆盖、保留无关文件、编码失败保留旧文件、HEIC失败、目录创建失败和dry-run零写入；明确拒绝时report与退出码，不把危险目标报成功。
- [ ] 回填源指纹和输出结果，文档说明规则，不扩大成通用文件系统框架。

可直接放入现有测试文件的关键回归（已有workspace/photo/options/fingerprint/symlink等helper和import）：

```ts
it('输出文件链接不能改变输入照片', async () => {
  const { input, out } = await workspace();
  await photo(join(input, 'photo.jpg'), 1000, 800);
  await mkdir(out);
  await symlink(join(input, 'photo.jpg'), join(out, 'photo.jpg'));
  const before = await fingerprint(input);
  await runCompress(options(input, { out, maxEdge: 500, concurrency: 1 }));
  expect(await fingerprint(input)).toEqual(before);
});
```

运行 `npx vitest run scripts/compress-photos.test.ts`。预期上述保护断言在旧实现失败，修复后通过；再核对拒绝/安全替换两种允许结果中规格选定的一种，不把“没有抛异常”当正确。回退仅恢复本项工具/测试/文档；不重跑真实素材、不删除已存在输出目录。

## A2：生成、缓存与封面边界

**修改：** `scripts/generate-photo-index.ts`、`scripts/generate-media.ts` 及各自 `.test.ts`；必要时`src/content/validate.ts`与content测试（仅比例契约确实需要调整时）；`src/content/module.md`、README、`docs/requirements.md`/`architecture.md`/ADR0005（分别记录字段/布局/新长期取舍，不能重复复制）。

**接口：** 保持 `generateMedia(): Promise<void>`、CLI/npm命令和发布路径。索引扫描与写盘分离：拟新增内部 `readPhotoIndex(photosDir): Promise<{content:SiteContent;homeMemory:Photo[]}>`；既有 `generatePhotoIndex(photosDir,outputPath)` 可保留调用包装，生成器直接消费内存返回值。不把Node IO移进runtime content。

- [ ] 先补失败索引保持测试：成功生成后保存索引/缓存/旧文件列表；损坏图、索引目标写失败、清单写失败分别注入，核对最后有效发布状态，不只断言throw。
- [ ] 增加320px照片/封面、479px、1px极小输入与EXIF旋转回归；无预设宽度时以实际源宽输出一个候选，保持不放大和正整数尺寸。明确量化舍入误差与比例阈值，不盲目放宽全部校验。
- [ ] validate缓存schema/version及安全输出路径，非法条目回退重新派生；只清理经验证的派生文件。无效JSON、缺variants、坏videos、缺产物、冷/热缓存、单图变更和删除图各自给证据。
- [ ] 全部派生/内容校验成功后，以临时文件替换发布索引；提交失败保持可恢复状态。旧产物清理放在成功发布之后，失败遗留的新派生产物只能被之后安全清理，不先删旧索引需要的文件。
- [ ] 实现视频扩展名大小写一致关联，保留stem原样；Linux相区分大小写、同stem异扩展、孤立封面、Unicode命名测试。重复封面尚无需求：建议明确拒绝歧义，若选优先级须写清规则再实施。
- [ ] 若候选生成/缓存格式改变，提升PROFILE/必要版本，解释旧缓存失效和完整重建；不删除源素材。

运行 `npx vitest run scripts/generate-photo-index.test.ts scripts/generate-media.test.ts scripts/validate-content.test.ts src/content/content.test.ts`；再 `npm run validate:content` 与 `npm run build`。预期有效小图、大小写封面均成功，故障不覆盖最后有效索引，所有源指纹不变，现行136引用完整。回退只恢复本项代码/文档与必要生成索引；只移除可重建派生缓存，重新生成，不reset其他任务。

**方案比较：** 原样保留不能解决已复现完整性问题；选择局部“扫描/派生/提交”职责分离。暂不建立复杂事务/存储模块；如果故障顺序仍混杂，再提取 `scripts/media/manifest.ts` / `commit.ts` 内部文件，另在规格声明接口和失败归属。

## A3：后台播放、寄语和首页恢复

**修改：** `src/media-viewer/MediaViewer.tsx`/`.module.css`、必要的 `src/playback/session.ts`/`index.ts`/`session.test.ts`和`src/app/App.tsx`命令；`src/themes/book/ThemeHome.tsx`；`tests/viewer.spec.ts`、`tests/home-memory.spec.ts`；对应module.md/需求/架构。

**接口：** Session/媒体队列/业务状态继续归playback，ThemeApp装配方向不变。Slideshow通过库 `SlideshowRef` 的playing/play/pause控制，禁止复制计时器。若增加 `MediaViewerCommands.reportVisibility(visible:boolean)`，App调用playback纯转换，记录临时暂停原因、使旧播放请求失效；不能只在DOM pause却让后续副作用立即重播。

- [ ] visibility回归明确分“合成事件”和“真实hidden/原生后台”；修前保留F04失败证据。照片启动幻灯片/播放视频时隐藏，回前台保持当前项、视频暂停、幻灯片播放按钮复位，只有主动动作继续。
- [ ] 复用插件ref，建立/清理可见性监听；处理隐藏期间挂载和迟到play成功/拒绝、关闭后旧请求、换路由及用户手动暂停。保持打开视频尝试播放、自然ended不推进。
- [ ] 寄语宽度由实际影像限定，去掉160px下限；核对padding/border-box、窄竖图和390×300短视口，缩略图折叠/全屏/缩放后仍在影像内部，不把长文字遮满图。
- [ ] 首页resumeRequired时一键继续、按钮语义同步；不清掉独立的用户暂停，不破坏悬停/焦点临时覆盖、末页和手动周期重启。
- [ ] 末页移除自动live语义，普通可读取文本保留；错误/离线提示语义维持。用DOM语义回归并另记VoiceOver/TalkBack结果。
- [ ] raw键盘用例不经helper强制focus，覆盖正反Tab/原始Escape/关闭回触发；已有移动全屏/滑动测试继续保留。

运行 `npx vitest run src/playback/session.test.ts src/albums/home-memory.test.ts`；构建后 `npx playwright test tests/viewer.spec.ts tests/home-memory.spec.ts`。预期以上场景符合既有需求；浏览器环境始终visible则保持真后台待验证，不造证据。回退只恢复本项状态/适配和UI语义文件，不卸载库或恢复旧查看器。

**方案比较：** 仅延长DOM扫描/加timer不解决可见性；选择库ref+一个适配入口。内部hook可在行为通过后A7提取，避免行为与结构同时大改。公开接口变化或临时暂停模型按full声明，不以“bug”豁免。

## A4：主题隔离与双base验收

**修改：** `scripts/sdd/check.ts`、`scripts/sdd/git.test.ts`、`scripts/sdd/module.md`；`tests/home-memory.spec.ts`，必要时`playwright.config.ts`仅调整验收服务隔离；README验证说明。

**接口：** `validateModules(files:Map<string,string>):string[]`与SDD CLI不变；现有公开入口依赖规则保留，别名和非字面量动态import仍不支持。

- [ ] 用当前book和任意第二主题构造正反例：跨UI树静态/动态字面量/重导出拒绝，contracts/index与本主题内部允许，跨app仍拒绝。移除仅旧主题名的假覆盖，避免把contracts.ts识别成主题。
- [ ] 首页测试先保存当前URL，操作后断言未改变；不写死/wangleyou/，不增加timeout。其他媒体URL断言也按base推导。
- [ ] 每个base独立build和server，CI验收禁用reuseExistingServer；如果保留本地复用，切base前明确停止自己启动的旧服务，不能关闭用户其他服务。

运行 `npx vitest run scripts/sdd`，预期违规拒绝、合法例通过；运行以下两组，预期各自全部适用项通过、平台跳过单列：

```sh
SITE_BASE=/ npm run build
SITE_BASE=/ CI=1 npm run test:e2e
SITE_BASE=/wangleyou/ npm run build
SITE_BASE=/wangleyou/ CI=1 npm run test:e2e
```

回退本项规则和测试；不改变main部署约束、保护检查名称或现有分支。

## A5：复用响应式候选并优化主题头图

**修改：** `ThemeHome.tsx`、`PageTurn.tsx`、`ThemePages.tsx`、必要的主题内部图片纯helper、`BookApp.tsx`；`tests/home-memory.spec.ts`/`browse.spec.ts`。头图若实施，新增`public/media/themes/book/album-hero.webp`并改引用，更新`public/media/SOURCES.md`、主题契约与对应记录；原PNG先保留以便比较/回退。

**接口：** 既有Photo/Video.srcSet/posterSrcSet不变，无新尺寸；PhotoImage仍接受src/srcSet/sizes等Props。首页/封面在book内部消费候选；不要把主题UI移到shared。PageTurn使用已选清晰度资源或同候选解析，不能额外加载最大图。

- [ ] 先加冷上下文网络核对：390/820/1440宽，DPR1/2/3，记录currentSrc、显示尺寸、字节和翻页后的第二次请求；用固定fixture避免相册数写死。
- [ ] 首页和索引传现有srcSet与实际sizes，相册cover自定义无候选时安全回退。留影/详情已有正确响应式实现不重写。
- [ ] 头图比较原图、原尺寸WebP与960w视觉结果；保持颜色、透明/底色融合及裁切。26,920/17,350字节是编码测量，没有视觉等价证据；明确选择后再替换，语义外观变化使用full。
- [ ] 验证慢加载/失败/缓存命中、无布局抖动、旋转与动画，不为每张图强制解码或预加载整册。

运行构建及 `npx playwright test tests/book-home.spec.ts tests/home-memory.spec.ts tests/browse.spec.ts tests/responsive-a11y.spec.ts`；预期DPR1小框不无故选1600w、DPR3仍清晰，首页样本字节显著低于320,208且不引入额外大图请求。回退主题引用/图片Props与新增派生主题资产；不动源相册素材，不删除音乐。

## A6：验收服务器使用范围流

**修改：** `scripts/serve-built.mjs`，新增有意义的 `scripts/serve-built.test.ts`（独立临时dist与端口）；README仅在启动参数改变时更新。拟增加PORT配置仅为隔离测试需用时，默认4173不变。

**接口：** 现有GET/HEAD、Content-Type、Content-Length、Accept-Ranges、Content-Range/416、Cache-Control、realpath约束保持；无SPA fallback或业务后端。使用Node `createReadStream`，资源由request/response生命周期关闭，错误/客户端断开销毁流。

- [ ] 覆盖首段/后缀/越界/空文件Range、HEAD全文件及HEAD Range、编码穿越和symlink出界；先保存现行响应作为契约。
- [ ] HEAD只stat，GET流式输出，Range只读所需区段；关闭连接不会残留文件句柄/流，错误不能在已发送header后再写404。
- [ ] 100MiB合成文件复测HEAD与32字节Range，记录RSS与读取量；目标不再分配整文件Buffer，不能把峰值抖动当机械固定内存断言。

运行新增定向测试，再构建后的video/viewer E2E验证seek/ended。回退仅服务器/测试；不是线上服务性能或部署架构变化。

## A7：文档、残留与有限内部提取

**文档修改：** `src/{app,content,playback,albums}/module.md`、`src/content/model.ts`注释、README与`public/media/SOURCES.md`；原来清理记录覆盖的基线改动不重写来源。媒体统计可改为生成命令结果而非易过时固定数量；源码/发布路径与真实素材来源对应，未知许可如实标注。

**残留修改：** `src/albums/home-memory.ts`/`index.ts`、`ThemePages.module.css`，只删除全仓确认无调用/无选择器依赖的旧两屏和旧CSS。若改变公开API，使用full并同步调用和契约；不得删除有效的循环边界测试来伪装通过，需明确废除循环接口才调整测试。

- [ ] 先修F15文档事实，确认引用存在与函数真实输出；不为旧文档恢复旧功能。
- [ ] 对F14每个函数/类型、CSS选择器记删除理由和替代；横滑、interval、非循环、当前token/库全局类保留。
- [ ] A3通过后如DOM事件/布局仍混杂，优先提取`src/media-viewer/useViewerVideoEvents.ts`、`useViewerCaptionLayout.ts`；owner仍media-viewer、commands保持稳定，hook只拥有DOM资源不存Session。Tab逻辑目前短且独立，可继续留组件，没必要三个hook一起建立。
- [ ] A1通过后如编码策略变更确实频繁，提取`scripts/photo-compression/encode.ts`，让HEIC/临时文件归同一能力，compress-photos.ts保留CLI/报告/公开导出。暂不拆options/scan/report四个文件，收益不足。
- [ ] 保留App/router/shared、纯playback、PhotoImage、PageTurn、三个内容页现行组织；它们没有因为长度或同文件就必须拆分的证据。

文档/死CSS用SDD/链接检查和相关已有浏览器验证；状态/接口提取跑对应单测与viewer/首页E2E，并比较无视觉/状态变化。回退各提取文件与调用改动即可，不移动全部目录、不新增通用“utils”层。

## D1：仍需设备/专门环境验证（未完成）

- [ ] 浏览器真实hidden（需确认getter确为hidden）及Android后台：播放后切后台，等待大于幻灯片周期，回前台仍等待主动继续；记录浏览器/WebView版本与视口。合成事件不能替代。
- [ ] Android：快/弱/断网、开屏首尾/跳过/关闭动画、Surface失效、重建时restoreState返回null、popup未导航的销毁、系统/网页全屏返回、API26–29与35安全区。当前无连接设备，不能执行这些验收，不凭静态猜测先重构MainActivity/StartupOverlay。
- [ ] VoiceOver/TalkBack验证自动末页不播报与错误通知；慢portal/DOM替换、长窄竖图、缩放/平移后的寄语、迟到play成功/拒绝与rapid close有专项回归。
- [ ] iOS编译/模拟器/签名/设备继续暂缓；仅在用户明确恢复后执行，保持独立记录。

## D2：有触发条件才做（当前不实施）

- CI媒体缓存：当前只缓存manifest，public产物不存在时正常重新派生；先计时冷/热runner，确有成本才加入可校验的派生缓存或压缩归档。不改变同提交检查/部署依赖。
- 视频哈希：当前readFile整MP4，最大200MiB；如批量大视频让构建内存成为瓶颈，用流式hash替代。当前无生产OOM证据，不增加并行复制。
- 外部HEIC命令无超时、PhotoImage同src换srcSet、全屏焦点迟到RAF、原生popup/restoreState等：先复现必要场景，不能仅静态怀疑立刻加通用调度器。
- 不升级依赖、不做路由框架/状态库/后端迁移，不恢复音乐、不引入桥接，不全仓拆页拆模块。

## 实施结束条件

每项修复有原始失败证据、相关回归通过、SDD与基线同步，设备缺口明确保留。修复后统一运行必要的check/build/双base E2E，已有定向结果未变化时不机械重复套件；静态检查不能证明行为正确。仅修改各项授权范围，不提交、推送或发布，除非用户之后明确要求。
