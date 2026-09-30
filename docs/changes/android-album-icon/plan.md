# 实施计划

1. 使用已选 B 成稿，缩小并居中到自适应图标安全区域，替换现有 `res/drawable-nodpi/app_icon.png`；沿用 `ic_launcher.xml` 引用。
2. 提高 Android 版本号并同步需求、模块和 README；保留包名与家庭签名身份。
3. 构建 Debug/Release，在 API 34 模拟器查看桌面圆形图标与启动图标，验证签名、版本、SDD 和最终差异。
4. 回退可恢复旧 PNG 与版本配置；无数据迁移。

资源选择：已生成的成稿是本次用户选定设计的位图，沿用现有 Android 自适应图标能力，无新增依赖。
