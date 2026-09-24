# 视频媒体类型适配与查看器替换计划

## 方案要点

| 主题 | 选择 |
| --- | --- |
| 视频发布方式 | 构建期按内容哈希复制到 `public/media/<相册目录>/<文件名>.<哈希12>.mp4`，目标存在即跳过；源→产物记录在 `.cache/media-variants/manifest.json` 的 `videos` 段，用于清理旧产物 |
| poster 来源 | 维护者提供 `media-source/<相册目录>/<视频同名>.poster.jpg`，走既有 WebP 派生管线；`video.poster`/`posterSrcSet` 指向派生资源，缺失即构建失败 |
| 格式与体积校验 | 只接受 `.mp4`；>200 MB 失败、>100 MB 警告；校验在 `scripts/validate-content.ts` 对发布文件执行，错误带 `albums[i].media[j].<字段>` 位置 |
| 排序 | 照片与视频合并后使用同一条规则：`topNN` 优先（编号升序），其余文件名自然序 |
| 字幕 | 整体下线：模型字段、两处校验、两套 `<track>`、`.vtt` 文件与文档说明 |
| 查看器 | `yet-another-react-lightbox@3.32.2` + video/captions 插件；受控 `open`/`index`，`on.view` 回写会话；`carousel.finite: true`、`controller.closeOnBackdropClick: true` 保留非循环与背景点击退出；两套主题各自包装组件与 `[data-theme]` 作用域样式覆盖 |

## 步骤

1. 变更记录与规格（本目录），先写清楚用户已确认的交互要求。
2. 单测先行：生成器（视频项、封面引用、排序、扩展名与保留名）、校验（poster 必填、扩展名、体积）、playback（`stepSessionTo` 边界）。
3. A/B 实施：媒体目录归位、生成器与校验、字幕下线。
4. C 实施：安装并核对 lightbox 兼容性，替换两套查看器，相册网格混排视频缩略图。
5. 依赖评估写进变更记录与 ADR。
6. 验证：`npm run check`、`npm run build`（核对 dist）、`npm run test:e2e`、本地浏览器人工核对。
7. 同步基线：requirements、architecture、module.md、README、ADR 0005/0006、SOURCES.md。

## 影响模块与顺序

`content`（模型/校验）→ `scripts`（索引/派生/发布/校验）→ `playback`（会话索引）→ `themes`（查看器包装、相册网格）→ docs → tests。

## 验证方式

- 单测：`npm test`。
- 内容与构建：`npm run check`、`npm run build`，并核对 `dist/media/<相册目录>` 内 mp4 与 poster 派生文件名、体积，确认无 `.vtt`、无 `media-source`、无 `public/media/video`。
- 行为：`npm run test:e2e`（桌面 Chrome 1440×1000、移动 Chrome 360×800），覆盖视频缩略图、查看器播放/暂停/进度/结束停留、音乐协调、焦点回归、两套主题。
- 人工：本地浏览器核对相册页缩略图与查看器播放，记录浏览器版本与视口；移动端与真机结论分开说明。

## 回退方式

- 生成器/校验改动可按文件回退，重新运行 `npm run generate:media` 会重建索引与派生资源（派生目录不提交 Git）。
- 视频素材回退只需把 `weekend-clip.mp4` 与 `weekend-clip.poster.jpg` 从相册目录移除，并按 README 恢复 `public/media/video/` 手工发布方式。
- 查看器回退需同时恢复两套主题的自绘查看器与 `ViewerCommands`（`step(delta)`/`toggleIntent`），以及对应的 e2e 断言。

## 代码审查修复补充

1. 保存生成前的资源清单快照；新资源全部生成后，对比同一来源的新旧地址，清理旧哈希 MP4 与不再引用的 WebP 派生文件。用临时工作区回归测试同名视频字节变化，断言旧资源已移除。
2. 查看器自动播放失败回调携带发起时的队列与索引，卸载或切换时失效；App 仅在来源仍匹配当前会话时接受回调。运行类型检查与查看器浏览器测试。
3. 总架构统一描述两套主题挂载同一个 `media-viewer`，并核对寄语和幻灯片的当前行为；更新模块契约与变更验证记录。重新运行 SDD、完整检查和构建。
