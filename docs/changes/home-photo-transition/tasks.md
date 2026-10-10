# 任务与验证

- [x] 新分支 feat/home-photo-transition，用户确认 PC 旋转效果和闪烁修复。
- [x] 用户授权继续手机、平板适配与检查；更新规格与计划。
- [x] 统一跨端旋转、手势与生命周期，专项规格/代码审查通过。
- [x] 子路径浏览器回归：首页28项、布局/键盘4项通过；7个尺寸静态视觉及浏览器触屏输入核对完成。
- [x] 基线同步及check/build/SDD完成。

本轮 Node24.18.0 完整check通过（230项单元测试），本地媒体子路径及根路径build、默认生产build均通过；根路径针对旋转、手势、切屏及减少动态的13项回归通过，9个重复设备场景跳过。Chrome154.0.8037.99；静态视觉检查尺寸1440×1000、360×800、390×844、844×390、768×1024、820×1180、1180×820，无横向滚动或页面脚本异常，手机/平板用浏览器CDP触屏输入核对横滑。横屏手机维持普通纵向滚动。

验收命令（均以Node24运行）：`npm run check`；`VITE_MEDIA_BASE_URL= npm run build` + `npx playwright test tests/home-memory.spec.ts`（28通过、18设备场景跳过）；`npx playwright test tests/book-home.spec.ts tests/responsive-a11y.spec.ts`（4通过）；`SITE_BASE=/ VITE_MEDIA_BASE_URL= npm run build` + `SITE_BASE=/ VITE_MEDIA_BASE_URL= CI=1 env -u NO_COLOR npx playwright test tests/home-memory.spec.ts -g 'whole paper|resize during motion|cancelled touch|reduced motion turns'`（13通过、9跳过）；`npm run build`；`npm run check:sdd -- --worktree --base b3c2f36`（14个差异路径通过）；`git diff --check`。默认生产bundle保留既有R2公开地址。

首次check被仓库忽略目录中的临时浏览器脚本lint阻止，移到系统临时目录后通过；首次全页截图触发横屏resize收尾，改为固定视口截图后核对通过。初次沙箱build/Playwright被IPC或服务权限阻止，按权限重跑通过。布局用例有NO_COLOR/FORCE_COLOR环境提示，后续根路径运行移除冲突变量后输出正常。没有把环境/截图失败计作应用验证通过。浏览器为视口与触屏模拟，未执行iPhone/iPad/Android真机、Safari或原生WebView验证；未运行无关的全站查看器回归。用户已有5173开发服务保留，检查服务与浏览器已关闭，网站未发布，随本次 PR 交付。
