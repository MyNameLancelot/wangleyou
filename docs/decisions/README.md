# 架构决策

此目录保留仍影响维护的技术选择与取舍，当前行为由 [需求](../requirements.md) 和 [总架构](../architecture.md) 维护，操作步骤由 [README](../../README.md) 维护。

| 决策 | 长期约束 |
| --- | --- |
| [0001：静态工程基础](0001-frontend-foundation.md) | React/TypeScript/Vite、Node 24/npm、Hash 与静态路径 |
| [0005：媒体派生与瀑布流](0005-responsive-media-pipeline.md) | 源素材/派生分层、增量缓存、离线 MP4、响应式图库 |
| [0006：共用查看器](0006-lightbox-viewer.md) | 成熟 lightbox、单一组件、playback 与 DOM 生命周期分离 |
| [0007：原生壳](0007-native-webview-shell.md) | 在线系统 WebView、无桥接、独立构建与授权分发 |

重要决策使用 `NNNN-主题.md`，说明日期、状态、背景、候选、决定、取舍、影响与验证；有效时更新现状，被替代时指向接替方案。精确包版本以锁文件为准，历史构建快照和发布过程不放进 ADR。

编号不重排或复用。0003 的外部设计治理废弃已落实为 [SDD 规则](../sdd.md)，0004 的双主题/液态玻璃方案已被唯一 book 主题及共用查看器取代，本次移除其当前目录文件。旧理由与版本仍可从 Git 历史查阅；普通局部实现只记活动变更。
