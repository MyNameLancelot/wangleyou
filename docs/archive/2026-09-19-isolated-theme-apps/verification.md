# 全站隔离主题应用验证记录

日期：2026-09-19

## 依赖证据

- `react-liquid-glass-svg@1.0.5`，MIT；零运行时依赖，React/ReactDOM 仅为 peer dependency。
- 本地发布 ESM 经 gzip 为 1731 字节。海边 `BeachGlass`、海边悬浮开关和草原悬浮开关分别在自己的主题目录导入该依赖；不存在跨主题导入或共享玻璃组件。
- 海边主题提供不支持 `backdrop-filter` 时的不透明背景回退；浏览器用 Safari UA 路径确认标题与操作仍可见。未将 Chromium UA 模拟等同于 Safari/WebKit 真机验证。

## 自动化证据

- `npm run check:sdd -- --worktree --base origin/main`：通过，覆盖 94 个差异路径。
- `npm run check`：通过，包括 SDD 结构、3 个相册/7 个媒体内容校验、TypeScript、ESLint，以及 10 个 Vitest 文件、100 项测试。
- `npm run build`：通过，生成严格静态 `dist/`。
- `npm run test:e2e`：37 项通过、3 项按既有设备条件跳过、0 项失败。desktop-chrome 与 mobile-chrome 双主题流程覆盖首页两屏、相册/浏览/详情、照片/视频查看器、错误恢复、主题切换保持会话、草原全部路由、1920×1080、2560×1440、390×844、液态玻璃 Safari UA 回退和无横向溢出；跳过项为 desktop 触控与 mobile 原生全屏。

## 隔离结论

- `src/themes/beach` 与 `src/themes/grassland` 分别拥有页面、查看器、图片状态、CSS、Token 和装饰；不存在跨主题导入。
- 旧 `AlbumPages`、共享 `MediaViewer`、共享 `PhotoImage` 与 `ThemeDecor` 已删除。
- `scripts/sdd/check.ts` 会拒绝 beach/grassland 之间的静态导入；两主题只通过公开入口消费无 UI 的 content、playback、albums 与路由类型。
