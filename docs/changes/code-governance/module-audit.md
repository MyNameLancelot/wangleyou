# 模块职责审计

审计基准为当前 `origin/main`（a646d69）的 `module.md`、公开入口、导入关系与实际实现。结论只决定本次是否动代码；没有具体收益与风险前保持“拆分待定”。

| 模块 | 声明的职责 | 实际承担的职责 | 是否混职责 | 是否超出行数或复杂度阈值 | 拆分建议 | 依据 | 风险 | 结论 |
|---|---|---|---|---|---|---|---|---|
| `src/app` | 应用入口、Hash 路由、主题选择、唯一 Session 与音乐状态装配 | `App.tsx` 确实集中装配路由、在线状态、标题、Session、音乐、主题命令；`router.ts` 只解析路由 | 否（装配层天然聚合命令，但状态机都在 playback） | 否：App 138 行，纯装配；router 12 行 | 保留 | `module.md` 与 `App.tsx`/`router.ts` 一致；公开入口只导出 App | 拆散装配层会扩大跨模块接口面 | 保留 |
| `src/albums` | 首页两段导航与主回忆纯逻辑、interval 生命周期 | 实现为纯函数与注入式 interval 控制器，不渲染、不持久化、不维护 playback 会话 | 否 | 否：home-memory 177 行，逻辑单一 | 保留 | 仅依赖 content 类型；`home-memory.test.ts` 覆盖边界 | 拆分只会增加文件数量 | 保留 |
| `src/content` | 类型、构建期索引消费、校验、排序与媒体 URL | `validate.ts` 只做规则校验和错误定位，不做 IO 或报告输出；`index.ts` 持有已校验数据与 resolver | 否 | 否：validate 208 行，规则集中且按类型分函数 | 保留 | `module.md` 声明“运行时复核同一套字段规则”；代码无 `fs`/`process` | 拆规则文件会增加内部耦合，暂无收益 | 保留 |
| `src/playback` | 查看器队列、意图/状态、进度与背景音乐纯状态 | 实现只含同步状态机与偏好契约，无 DOM、监听、audio 或计时器 | 否 | 否：session 80 行、background-music 105 行 | 保留 | `App` 唯一持有 Session；主题只接收命令，不复制业务状态 | 把状态搬进主题会违反架构 | 保留 |
| `src/shared` | 跨模块无 UI 契约，当前仅 Route 类型 | 只导出 Route 类型；无组件、业务状态或工具杂物 | 否 | 否：7 行 | 保留 | `module.md` 明确新增前需两个模块消费；当前 themes 与 app 都使用 | 无需动作 | 保留 |
| `src/themes` 总契约 | 主题读写、无 UI 装配契约与两套隔离主题 | `index.ts`/`contracts.ts` 提供默认主题、循环切换和命令契约；两主题通过公开入口导出 | 否 | 否：契约文件小 | 保留 | 依赖只指向 content/playback/albums/shared 公开入口 | 共享 UI 会破坏主题隔离 | 保留 |
| `beach` | 完整海边站点 UI、文案、样式、媒体引用、audio DOM 与动画 | `ThemePages.tsx` 同时含 HomePage/Browse/Album/AlbumPage；`ThemeViewer.tsx` 含 dialog 生命周期、手势、全屏、图片/视频舞台；MusicToggle 含 audio effect 与长按 | 是：同一主题内 UI 装配较集中 | 接近阈值：ThemePages 476 行、ThemeViewer 327 行、MusicToggle 228 行；但没有循环依赖或跨模块内部引用 | 待定：可在主题内部按页面/查看器舞台拆文件，但先要有回归收益 | 主题文件行数高但已由 e2e 覆盖；主题模块契约与依赖方向未漂移 | 机械拆分易改渲染生命周期或导致主题间复制契约；与 grassland 复用会违反隔离 | 拆分待定 |
| `grassland` | 完整草原站点 UI、文案、样式、媒体引用、audio DOM 与动画 | 与 beach 同构但完全独立实现；`ThemePages.tsx`、`ThemeViewer.tsx`、MusicToggle 同样聚合 UI 逻辑 | 是：同一主题内 UI 装配较集中 | 接近阈值：ThemePages 472 行、ThemeViewer 325 行、MusicToggle 228 行 | 待定：同 beach，但禁止共享 JSX/CSS/资产 | 文件与 beach 行数相近说明是主题隔离下的重复成本；当前无越界导入 | 为消除重复共享 UI 会违反 ADR 0004；单独拆分收益不明确 | 拆分待定 |
| `scripts/compress-photos.ts` | 离线图片压缩 CLI | 一个文件包含参数解析、扫描、压缩管线、HEIC 外部命令、报告格式化与 CLI 入口 | 是：入口、管线、扫描、日志/报告集中 | 超过常规复杂度：674 行，但导出纯函数并已有 367 行单测 | 待定：可拆为 scan/compress/report/heic 纯模块 + 薄 CLI | `compress-photos.test.ts` 已覆盖核心路径；未影响运行时架构，无 module.md | 拆分需保持报告文本、退出码、并发与外部命令行为；无直接业务收益 | 拆分待定 |
| `scripts/sdd` | 校验 change.json、Markdown 引用、模块结构与依赖方向 | `check.ts` 规则纯函数，`cli.ts` 处理 Git/退出码；测试覆盖结构与临时 Git | 否 | 否：check 96 行、cli 62 行 | 保留 | `module.md` 与实现一致；不写索引、不修改仓库 | 无需动作 | 保留 |

## 重点关注结论

- **主题大文件**： beach/grassland 的页面与查看器确实混合布局、数据取用、播放命令、手势与动画；但这发生在主题内部，业务状态仍由 App/playback 持有。当前没有证据表明渲染、路由或播放行为出错。单边拆分无法验证通用收益，双边拆分容易扩大回归面，故记录待定。
- **compress-photos.ts**： CLI、管线、扫描、报告与错误处理确实集中。已有单测与导出纯函数降低了风险，但这是低频维护工具，拆分不能改变退出码、输出文本和 HEIC 策略；本轮不动。
- **content/validate.ts**： 未发现校验、报告输出与 IO 混合；构建期资源存在性检查在 `scripts/validate-content.ts`，错误报告由 CLI 汇总，符合 `module.md`。
- **albums 与 playback 边界**： 首页主回忆队列/计时器在 albums，查看器媒体会话在 playback；`ThemePages.tsx` 不创建第二套查看器 Session，`ThemeViewer.tsx` 只转发命令。
- **module.md 漂移**： 未发现公开接口、依赖、状态或资源生命周期描述与实现冲突；本轮不更新模块基线。

