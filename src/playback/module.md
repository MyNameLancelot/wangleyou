# playback 模块

## 目的

照片浏览会话。

## 职责

创建照片队列、当前索引和非循环边界切换。

## 非职责

DOM、图片加载、音视频、幻灯片计时；本期没有自动播放状态机。

## 公开接口

index.ts 导出 Session、openSession(photos,id)、stepSession(session,delta)。空或无匹配返回 null；越界及非法 delta 保持原会话。

## 允许依赖

content 的 Photo 类型。

## 状态与资源生命周期

会话数据由本模块纯函数生成，由 App 唯一持有；不创建监听或计时器。

## 主要文件

session.ts 纯状态函数；session.test.ts 边界和顺序测试。

## 扩展与验证

后续播放意图及调度仍归本模块，不在查看器复制索引。扩展状态迁移前新增行为测试。
