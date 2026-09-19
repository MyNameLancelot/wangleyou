# 分支审查修复验证记录

日期：2026-09-19
环境：macOS，Node.js 24.18.0，npm 11.16.0，Playwright Chrome。
状态：完成。

## 自动化证据

- `npm run check`：通过。SDD 结构检查、内容校验（3 个相册、7 个媒体）、TypeScript、ESLint、Vitest（10 个文件、100 项测试）全部通过。
- `npm run build`：通过。生成严格静态 `dist/`，JS 294.50 kB（gzip 85.70 kB），CSS 55.72 kB（gzip 8.06 kB）。
- `npm run test:e2e`：通过。42 项通过，4 项按既有设备能力跳过。
- `npm run verify:fixtures`：通过。临时新增配置为 4 个相册、8 个媒体；桌面与移动各 1 项通过；脚本结束后恢复原始配置和静态构建。
- `npm run check:sdd -- --worktree --base origin/main`：通过，覆盖 116 个差异路径。

## 验收结果

| 验收 | 结果 | 证据 |
| --- | --- | --- |
| AC-1 | 通过 | 删除 `src/playback/last-played.ts` 与 App 的读写装配；e2e 预置旧 `wangleyou.lastPlayed=legacy-value`，打开查看器并关闭后断言值不变，首页无“继续播放”按钮；`app/module.md` 与 `playback/module.md` 已同步。 |
| AC-2 | 通过 | 两主题 wheel 目标判定包含 `[data-testid='theme-switch']`；桌面 Playwright 在开关上滚下/滚上，分别断言 memory 和 hero 进入视口。mobile-chrome 模拟不提供真实触控板 wheel 输入，该专项用例按设备能力跳过。 |
| AC-3 | 通过 | `shouldRunHomeMemoryInterval` 对 0 和 1 张照片返回 false；浏览器核对自动播放时序号 `aria-live=off`，暂停后为 `polite`。 |
| AC-4 | 通过 | 删除过期 `docs/superpowers/`；修正依赖验证和 ADR 中玻璃库的实际导入范围；设计资产 README 改为描述 beach/grassland 独立运行时结构。 |
| AC-5 | 通过 | 删除无消费方主题常量与 `ThemeAppProps.theme`；删除未引用的 `public/media/theme/beach-hero.webp` 并更新素材清单。 |
| AC-6 | 通过 | Node 24.18.0 下 check、build、E2E、fixtures 和完整 SDD 校验全部通过。 |

## 未验证范围

- 未执行真实 Safari/WebKit、iOS、Android 真机或 WebView 验证。
- Safari fallback 用例运行在 Chromium 中，通过 UA 切换库内 fallback filter，并断言 hero SVG 无 `feDisplacementMap`、含 `feTurbulence`；这不等于 Safari/WebKit 真机验证。
- mobile-chrome 的主题开关 wheel 专项用例因模拟环境无真实 wheel 输入而跳过；移动端其余触屏、布局和媒体流程已通过。
