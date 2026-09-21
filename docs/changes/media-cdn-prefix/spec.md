# 构建期媒体 CDN 前缀

状态：验证中

## 背景与目标

站点当前将媒体相对路径拼接到 Vite 页面 `BASE_URL`，适合 GitHub Pages 子路径，但不能将体积较大的媒体请求切换至 CDN。新增构建期媒体前缀，优先使用 `VITE_MEDIA_BASE_URL`；生产构建使用本仓库 `https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/`，因为 GitHub Pages 的 `public/` 发布根目录在 jsDelivr 中仍是仓库子目录。

## 非目标

- 不改变 Vite 页面 base、Hash 路由、GitHub Pages 部署路径或页面链接。
- 不将完整 CDN URL 写入内容 JSON，或在主题组件拼接 CDN 地址。
- 不增加后端、数据库、登录、上传系统、付费服务或运行时依赖。

## 行为与边界

- 内容配置和主题资源声明继续使用 `media/...` 相对路径。
- 相册目录命名统一为 `YYYY-MM-sequenceNN-相册名`，`sequence` 必须小写；构建期索引、首页回忆引用和已提交示例目录同步使用该形式，避免 jsDelivr 的大小写敏感路径失配。
- `mediaUrl()` 是所有媒体消费点的唯一 resolver。它默认使用构建期 `VITE_MEDIA_BASE_URL`，未设置时回退 `import.meta.env.BASE_URL`；`assetUrl()` 保持兼容但不再供媒体消费者使用。
- CDN 前缀去除末尾多余斜杠后与已编码的相对路径以单个 `/` 连接。生产前缀包含仓库、版本与仓库内发布目录：`https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public`。
- 保留现有路径安全和中文编码：拒绝协议、绝对路径、反斜杠、查询参数、片段及目录穿越（包括多重 percent-encoding 的等价形式）；各路径段经 `encodeURIComponent`。
- 网络加载失败继续使用既有界面错误反馈；非法配置仍在构建期校验失败。

## 依赖与自行实现评估

现有 `assetUrl()`、`assertAssetPath()` 和标准 `encodeURIComponent` 已满足前缀拼接与安全编码需求。Vite 原生在构建时替换 `import.meta.env.VITE_*`，无需运行时配置。第三方 URL 库不能取代项目的严格相对路径语义，且新增依赖没有收益；因此不新增依赖，在 content 模块增加语义明确的薄封装。

## 验收条件

- AC-1：构建设置 `VITE_MEDIA_BASE_URL=https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/` 后，媒体 URL 使用该前缀、仓库、版本和 `public` 目录，且无双斜杠或漏斜杠。
- AC-2：未设置 `VITE_MEDIA_BASE_URL` 时，媒体 URL 与原有 `BASE_URL` 行为一致，包含 GitHub Pages 子路径与本地开发。
- AC-3：照片、视频、海报、字幕、相册封面、首页主回忆、hero、主题背景/装饰媒体和两主题背景音乐全部通过 `mediaUrl()` 获取 URL；主题内不存在 CDN 字符串拼接。
- AC-4：相对路径 JSON 继续保存相对路径并使用小写 `sequence` 相册目录；协议、绝对路径、反斜杠、查询、片段、目录穿越与大写 `Sequence` 目录被拒绝，中文路径仍逐段编码。
- AC-5：页面 base、Hash 路由链接和 GitHub Pages 部署路径不变；README、需求、架构、模块说明与验证记录准确反映真实实现。
