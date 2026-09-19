# 紧凑主题切换验证记录

日期：2026-09-19

| 验收 | 验证 | 结果 |
| --- | --- | --- |
| 1、2 | `npx playwright test tests/browsing.spec.ts -g "floating glass theme switch|interactive targets"` | 桌面与移动项目全部通过；默认玻璃 32×32px、图标 20×20px 居中、按钮命中区 44×44px，hover/focus 展开为 142px 胶囊 |
| 1、2 | 无头 Chrome 直接读取几何数据（视口 1440×900，设备像素比 3） | 收起：`surface 32×32 @x1384`，图标 `20×20 @x1390`（居中）；展开：`surface 142px`，图标 `@x1301.6`、文字 58.8px `@x1329.6` |
| 1–3 | 两主题截图 `test-results/desktop-chrome-<theme>-theme-switch-{collapsed,expanded}.png` | 海边为蓝绿图标、草原为深绿图标；收起仅图标，展开为“图标 + 主题切换”胶囊 |
| 3 | 既有 `theme switch keeps page, media and playback context` 用例 | 通过；切换后路由、媒体与播放上下文、偏好持久化保持 |
| 4 | `floating glass theme switch…` 内断言统计文案计数为 0 | 通过；两主题首页均不再渲染“7 个片刻 · 3 本相册 · 内容均为演示”，`.heroMeta`、`totalMedia` 与不再使用的 `items` 已删除 |
| 5 | `npm run check` | 通过；SDD 结构、内容校验、TypeScript、ESLint 与 10 个 Vitest 文件共 100 项测试 |
| 5 | `npm run build` | 通过；产物 JS 295.41 kB（gzip 85.87 kB），较引入 `lucide-react` 前 +3.09 kB（gzip +1.39 kB） |
| 5 | `npm run test:e2e` | 39 项通过，3 项因设备能力（桌面触控、移动全屏）按既有条件跳过 |

修复过程记录：首次实现把文字标签放进玻璃内容层后，收起状态仍被文字的最小内容宽度撑开，图标被挤出圆形之外并被 `overflow:hidden` 裁切（几何检查显示图标位于玻璃圆左侧 23px）。已在玻璃库内容层收紧宽度与 `min-width`，图标回到圆心。

本轮改用 `lucide-react` 后不再手写图标 SVG；未在真实 Safari、iOS 或 Android 真机复核，Safari 降级路径仍由既有 UA 回归覆盖，不宣称等同真机结果。
