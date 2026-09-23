# content 模块

## 目的

把照片目录和元信息经构建期索引转换为应用可安全使用的内容数据，并统一发布资源路径规则。

## 职责

- 定义站点、相册、照片和视频的公开数据类型。
- 校验配置结构、字段类型、ID、真实日期、资源路径及 ID 唯一性。
- 消费构建期生成的相册顺序与照片顺序；不在运行时重排。
- 相册元信息的来源是每个照片目录的 `meta.json`：`album` 段描述相册本身（`title`、`date`、`description` 均可选，缺省分别取目录名后缀与目录名的年月，允许只写到月，`description` 上限 16 个字符）；`photos_meta.captions` 按文件名登记单张照片寄语，数组项只允许 `fileName` 与 `caption`，寄语为 1–60 个非空白字符、允许只覆盖部分照片、文件名必须真实存在且不得重复。照片顺序与 ID 不写进配置：构建期脚本按 `topNN` 优先、其余文件名自然序生成顺序，并由文件名生成照片 ID。解析与错误定位在构建期脚本完成，本模块只消费生成结果，运行时 `validateContent` 复核同一套字段规则。
- 通过模块公开入口提供经校验的配置、类型、排序及资源 URL 解析能力。

## 非职责

- 不在浏览器运行时读取目录或推断照片日期、尺寸与相册结构；原图尺寸及发布 `srcSet` 均由构建期媒体生成器写入索引。
- 不检查发布资源是否存在；该检查属于构建期内容校验脚本。
- 不渲染页面，不维护路由、查看器或播放状态。
- 不修改原图或生成缩略图。

## 公开接口与输入输出

其他模块只通过 `index.ts` 引用本模块；该公开入口由应用装配工作统一维护。

- `Photo`、`Video`、`Media`、`Album`、`SiteContent`：静态内容模型；照片和视频都可提供列表缩略图，视频还可提供播放海报与说明字幕（`captions`，WebVTT）。
- `validateContent(input: unknown): SiteContent`：接收未受信任的配置值；成功时返回同一份已校验数据，失败时抛出包含字段位置的 `Error`。
- `homeMemory`：经校验的显式首页主回忆照片，数组顺序即播放顺序。
- `assertAssetPath(path: unknown, location: string): asserts path is string`：验证发布目录内的相对资源路径，并用 `location` 定位错误。
- `assetUrl(path: string, base?: string): string`：兼容非媒体静态资源的既有站点基础路径 resolver。
- `mediaUrl(path: string, base?: string): string`：唯一媒体 resolver；默认使用构建期 `VITE_MEDIA_BASE_URL`，未设置时使用 Vite `BASE_URL`。它复用相对路径校验、逐段编码和前缀末尾斜杠规范化；主题、相册、查看器与音乐组件不得自行拼接 CDN。
- `content`：由公开入口导出的已校验静态 JSON 配置。
- `contentErrorMessage`：校验失败时的可读原因；此时 `content` 是安全的空内容，界面展示配置异常而不是白屏。构建期 `npm run validate:content` 仍然直接失败，不允许带病发布。

资源路径允许普通发布相对路径；禁止协议、绝对路径、反斜杠、查询、片段、空目录段、当前或上级目录段。校验对百分号编码递归解码，编码后的越界形式同样被拒绝。

## 允许依赖

本模块当前没有跨模块依赖。其他业务模块不得引用 `content` 的内部文件。

## 状态及资源生命周期

内容模型、校验和排序均为同步逻辑，不持有可变业务状态、计时器、媒体元素或异步任务。配置由应用初始化时读取和校验；排序结果由调用方持有。

## 主要文件

- `model.ts`：公开数据类型。
- `validate.ts`：配置、路径校验和稳定排序。
- `content.test.ts`：内容边界和排序行为测试。
- `generated-photo-index.json`：构建期目录扫描的产物，不手写。
- `index.ts`：模块公开入口，由应用装配任务提供。

## 扩展与验证方法

新增字段时先更新模型和规格，再补充字段类型、边界及错误位置测试。新增媒体类型需同时明确列表展示、查看器行为和构建期文件检查，不能只扩充联合类型。视频新增字幕字段时同步把资源纳入 `scripts/validate-content.ts` 的存在性检查。

运行 `npm test -- --run src/content/content.test.ts` 验证内容规则；完整构建期资源存在性由 `npm run validate:content` 验证。
