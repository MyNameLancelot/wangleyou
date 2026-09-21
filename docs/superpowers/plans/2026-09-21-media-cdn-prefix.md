# 构建期媒体 CDN 前缀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让合法的相对媒体路径在构建期可解析为 jsDelivr URL，且默认继续使用站点 BASE_URL。

**Architecture:** content 模块新增媒体专用 resolver；它选择 Vite 在构建期注入的 CDN 前缀或页面 BASE_URL，并复用已有路径校验与分段编码。主题只传入相对媒体路径，所有媒体 DOM 属性由 resolver 的返回值填充。

**Tech Stack:** React、TypeScript、Vite、Vitest、Playwright；不新增依赖。

## Global Constraints

- `VITE_MEDIA_BASE_URL` 是构建期变量，生产默认值为 `https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/`，包含 GitHub 用户、仓库、版本和仓库内 public 目录。
- 未配置该变量时必须使用 `import.meta.env.BASE_URL`，不改 `vite.config.ts` 的 `base`、Hash 路由或 Pages 路径。
- 内容 JSON 只保存 `media/...` 相对路径；拒绝不安全路径；中文文件名逐段编码。
- 所有媒体只能调用 `mediaUrl()`；不在 UI 或主题中拼接 CDN。

---

### Task 1: 媒体 URL resolver 与单元测试

**Files:**
- Modify: `src/content/index.ts:1-29`
- Modify: `src/content/asset-url.test.ts:1-12`

**Interfaces:**
- Consumes: `assertAssetPath(path, location)`。
- Produces: `mediaUrl(path: string, base?: string): string`；`assetUrl(path: string, base?: string): string` 保持现有兼容行为。

- [ ] **Step 1: 写出失败的 CDN resolver 测试**

```ts
expect(mediaUrl('media/一起散步.jpg', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/'))
  .toBe('https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/media/%E4%B8%80%E8%B5%B7%E6%95%A3%E6%AD%A5.jpg');
expect(mediaUrl('media/photo.jpg', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public////'))
  .toBe('https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/media/photo.jpg');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/content/asset-url.test.ts`
Expected: FAIL，因为 `mediaUrl` 尚未导出。

- [ ] **Step 3: 实现最小 resolver**

```ts
const mediaBaseUrl = import.meta.env.VITE_MEDIA_BASE_URL || import.meta.env.BASE_URL;
const resolveAssetUrl = (path: string, base: string) => {
  assertAssetPath(path, 'resource');
  return `${base.replace(/\\/+$/, '')}/${path.split('/').map(encodeURIComponent).join('/')}`;
};
export const assetUrl = (path: string, base = import.meta.env.BASE_URL) => resolveAssetUrl(path, base);
export const mediaUrl = (path: string, base = mediaBaseUrl) => resolveAssetUrl(path, base);
```

- [ ] **Step 4: 扩充回退与拒绝路径测试并运行**

```ts
expect(mediaUrl('media/photo.jpg', '/wangleyou/')).toBe('/wangleyou/media/photo.jpg');
expect(() => mediaUrl('media/../photo.jpg', 'https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public')).toThrow();
```

Run: `npx vitest run src/content/asset-url.test.ts`
Expected: PASS。

### Task 2: 统一主题媒体消费者

**Files:**
- Modify: `src/themes/beach/BeachApp.tsx`, `src/themes/beach/ThemePages.tsx`, `src/themes/beach/ThemeViewer.tsx`, `src/themes/beach/BeachMusicToggle.tsx`
- Modify: `src/themes/grassland/GrasslandApp.tsx`, `src/themes/grassland/ThemePages.tsx`, `src/themes/grassland/ThemeViewer.tsx`, `src/themes/grassland/GrasslandMusicToggle.tsx`

**Interfaces:**
- Consumes: `mediaUrl(path: string, base?: string): string` from `../../content`.
- Produces: 所有 `<img>`、`<video>`、`poster`、`<track>`、`<audio>`、预加载 Image、封面、主回忆、hero/背景媒体均使用 resolver 结果。

- [ ] **Step 1: 将既有媒体调用替换为 `mediaUrl`**

```ts
import { mediaUrl } from '../../content';
// 例：<img src={mediaUrl(photo.src)} ... />
// 例：audio.src = mediaUrl('media/themes/beach/music.mp3');
```

- [ ] **Step 2: 核对所有媒体属性**

Run: `rg -n "assetUrl|<img|<video|<track|<audio|\.src =|media/themes" src/themes --glob '*.{ts,tsx}'`
Expected: 媒体值仅来自 `mediaUrl()`；`href="#/` 路由链接不迁移；不存在 `cdn.jsdelivr` 或模板字符串 CDN 拼接。

- [ ] **Step 3: 运行主题相关单元测试**

Run: `npx vitest run src/themes src/albums src/playback`
Expected: PASS。

### Task 3: 构建与静态部署验证

**Files:**
- Modify: `docs/changes/media-cdn-prefix/tasks.md`

**Interfaces:**
- Consumes: 默认构建环境以及 `VITE_MEDIA_BASE_URL=https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/`。
- Produces: 可追溯的 AC-1/AC-2/AC-5 验证证据。

- [ ] **Step 1: 运行完整工程检查和默认构建**

Run: `npm run check && npm run build`
Expected: PASS；dist 继续含 `/wangleyou/` 站点路径且不含 CDN 前缀。

- [ ] **Step 2: 用 jsDelivr 前缀构建并检查产物**

Run: `VITE_MEDIA_BASE_URL=https://cdn.jsdelivr.net/gh/MyNameLancelot/wangleyou@main/public/ npm run build && rg -n "https://cdn\\.jsdelivr\\.net/gh/MyNameLancelot/wangleyou@main/public/media/" dist`
Expected: PASS；产物有 jsDelivr 媒体 URL，页面入口和 `#/` 链接不变。

- [ ] **Step 3: 运行浏览器回归**

Run: `npm run test:e2e`
Expected: PASS；桌面与移动端加载页面、主回忆、查看器和主题音乐控件。

### Task 4: 同步基线和归档

**Files:**
- Modify: `docs/requirements.md`, `docs/architecture.md`, `src/content/module.md`, `src/themes/module.md`, `src/albums/module.md`, `src/playback/module.md`, `README.md`
- Modify: `docs/changes/media-cdn-prefix/change.json`, `docs/changes/media-cdn-prefix/spec.md`, `docs/changes/media-cdn-prefix/tasks.md`
- Create: `docs/changes/media-cdn-prefix/verification.md`
- Move: `docs/changes/media-cdn-prefix/` → `docs/archive/2026-09-21-media-cdn-prefix/`

**Interfaces:**
- Consumes: 已通过的验证结果和 `mediaUrl()` 公开接口。
- Produces: 与实现一致的产品、架构、模块、维护说明和归档记录。

- [ ] **Step 1: 更新文档并逐项记录 AC 证据**

在需求、架构和模块文档中说明 `mediaUrl()` 的唯一媒体入口、构建期优先级、路径安全与生命周期；README 提供含用户/仓库/版本的 jsDelivr 示例与无变量回退说明。

- [ ] **Step 2: 填写变更状态和验证结果**

将 `change.json` 的 planned 影响改为 updated，记录实际命令、环境、通过/未运行项；任务只勾选已经完成的工作。

- [ ] **Step 3: 归档并运行 SDD 校验**

Run: `npm run check:sdd -- --worktree --base origin/main`
Expected: PASS；将完整变更目录移至 archive 并更新 archive 索引。
