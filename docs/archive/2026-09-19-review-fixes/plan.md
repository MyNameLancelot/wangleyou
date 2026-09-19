# 分支审查修复实施计划

**关联规格：** [分支审查修复规格](spec.md)

## 影响与顺序

| 文件/位置 | 影响 |
| --- | --- |
| `src/app/App.tsx`、`src/app/module.md` | 移除 lastPlayed 装配与基线描述。 |
| `src/playback/last-played.ts`、`src/playback/index.ts`、`src/playback/module.md` | 删除无消费方的上次播放纯函数和导出。 |
| `src/themes/contracts.ts`、`src/themes/index.ts`、两主题 App 与 HomePage | 收缩主题契约、删除死常量与 resume props。 |
| 两主题 `ThemePages.tsx`、`src/albums/home-memory.ts` 和测试 | 修正 wheel 目标、aria-live 和单张照片计时规则。 |
| `public/media/theme/beach-hero.webp`、`public/media/SOURCES.md` | 删除未引用旧资产并同步素材清单。 |
| 基线与历史记录 | 修正依赖事实、运行时结构、README 能力描述。 |

## 步骤

1. 建立 full 变更记录；先补纯函数测试表达单张照片不运行、暂停时 polite 播报的目标。
2. 删除 lastPlayed 实现、App 装配、HomePage resume props 与 module 基线。
3. 修改首页 wheel 目标判定，使主题开关包含在接管范围内；补充浏览器断言。
4. 调整两主题主回忆序号的 aria-live 和 interval 授权条件。
5. 删除主题死常量、`theme` 入参和未引用旧背景；更新素材清单。
6. 修正过期过程文档、依赖验证记录、设计资产 README、README 与需求/架构描述。
7. 运行单测、构建、E2E 与完整 SDD 校验，填写验证记录并归档。

## 回退

如新行为回归，恢复本变更涉及的 App/播放模块、HomePage、主题契约与文档提交即可；主题目录结构和既有播放会话模型不变。
