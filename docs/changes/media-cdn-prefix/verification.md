# 验证记录

状态：验证中；浏览器完整回归存在本次范围外的用户未提交测试冲突，尚不能归档。

| 验收项 | 操作与环境 | 结果 |
| --- | --- | --- |
| AC-1 | Node 26.8.2；`npm run build`，加载 `.env.production` | 通过。Vite 生产构建成功；`dist/assets/index-C6gzifCu.js` 含 `https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public`。首次缺少 `/public/` 时图片用例失败，因此已按仓库真实目录修正。 |
| AC-2 | Node 26.8.2；`VITE_MEDIA_BASE_URL= npm run build` | 通过。构建成功；产物不含 `cdn.jsdelivr.net`，并保留 `/wangleyou/` 页面入口路径。 |
| AC-3 | `rg -n "assetUrl\\(" src --glob '*.{ts,tsx}'` 与主题代码审查 | 通过。除 content 自身及其兼容测试外没有 `assetUrl()` 调用；两套主题的照片、视频、海报、字幕、封面、主回忆、hero/第二屏背景、预加载与音乐均调用 `mediaUrl()`；没有主题内 CDN 字符串。 |
| AC-4 | `npx vitest run src/content/asset-url.test.ts` 与 `npx vitest run scripts/generate-photo-index.test.ts` | 通过（共 6 项）。覆盖 jsDelivr 前缀、多个尾斜杠、中文逐段编码、BASE_URL 路径、危险路径及大写 `Sequence` 目录拒绝。三个示例相册目录和 `home-memory.json` 已重命名/更新为小写 `sequence`。 |
| AC-5 | `npm run check` | 通过：SDD structure、内容校验、TypeScript、ESLint 和 83 项 Vitest 测试全部通过。`vite.config.ts` 仍为 `/wangleyou/`，Hash 路由未改。 |
| AC-5 浏览器回归 | 无 CDN 回退产物上运行 `npm run test:e2e`（桌面 Chrome 与移动 Chrome） | 仅用户已有未提交的 `tests/browsing.spec.ts` 海边背景断言失败：它断言没有 `[data-home-seam]`，而从 `origin/main` 新建的当前分支仍渲染该元素；该失败不涉及媒体 URL。为保护用户改动，未修改测试或背景实现。 |

未验证：真实 jsDelivr 网络资源在浏览器中的加载；本机对 `cdn.jsdelivr.net:443` 的只读连接返回 `curl: (7) Couldn't connect`，因此生产 E2E 的图片加载失败不能作为路径错误结论。完整 E2E 在可访问 CDN 的环境、且用户现有海边背景改动协调后重跑。
