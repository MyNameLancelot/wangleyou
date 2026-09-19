# 悬浮主题切换验证记录

日期：2026-09-19

| 验收 | 验证 | 结果 |
| --- | --- | --- |
| 1、5 | `npm run check`、`npm run build` | 通过；10 个 Vitest 文件共 100 项测试通过，生产构建成功 |
| 1–5 | `npm run test:e2e`，desktop-chrome 与 mobile-chrome | 39 项通过；3 项因桌面触控/移动全屏设备能力按既有条件跳过 |
| 2、3 | 新增浏览器用例 `floating glass theme switch replaces the global header` | 两个浏览器项目均通过；验证无主导航、右下角位置、默认收起、桌面 hover、键盘 focus 与点击切换 |
| 2、4 | `desktop-chrome-home.png` 与失败修正阶段的移动端截图人工核对 | 顶栏消失，首屏从顶部铺满；控件具备玻璃高光、阴影和独立悬浮层次，不遮挡核心内容 |
| 2 | SDD 主题隔离静态规则及 TypeScript 导入检查 | 通过；海边与草原分别拥有组件和 CSS，无跨主题 UI 导入 |
| 1–5 | `npm run check:sdd -- --worktree --base origin/main` | 通过；覆盖 96 个工作区差异路径 |

首次完整 E2E 的移动项目因测试错误地要求触控环境响应 hover 而失败；测试已改为桌面验证 hover、所有环境验证键盘 focus。修正后的完整回归通过。未在真实 Safari、iOS 或 Android 真机执行；Safari 降级路径由现有 UA 回归覆盖，不宣称等同真机结果。
