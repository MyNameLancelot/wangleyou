# albums 模块

## 目的

首页交互纯契约。

## 职责

首页主回忆照片队列、横向输入意图、播放意图与 interval 生命周期等无 UI 纯逻辑。首页只使用 content 提供的显式主回忆顺序；不把视频放入主回忆队列；非循环推进允许到照片数对应的文字末页，到达时关闭自动播放。当前 book 首页消费横向触摸意图，不拦截纵向滚动或键盘；旧两屏/触控板导航函数已移除。横向输入须达到阈值且方向占优。自动播放运行期间发生手动换页时，控制器清理旧周期并从完整间隔重新开始；未运行时不因手动换页新建计时器。

## 非职责

渲染主题 UI、维护查看器的当前索引或播放资源、主题变量、路由解析。首页主回忆不是 playback 会话，不控制查看器的媒体调度。

## 公开接口

index.ts 导出 `createHomeMemory`、`stepHomeMemory`（loop 缺省 true，book 明确传 false）、`setHomeMemoryPlaying`、`getHomeMemorySwipeIntent`、`shouldRunHomeMemoryInterval`、`createHomeMemoryIntervalController` 及相关类型/常量；主题 UI 通过公开入口使用它们。

## 允许依赖

content。

## 状态与资源生命周期

无持久业务状态。主题 UI 自己持有视图状态、页面可见性与回前台待恢复标记；纯控制器负责确保 interval 在同步条件失效与释放时清理。

## 主要文件

home-memory.ts 首页纯状态、输入意图与计时器控制器。

## 扩展与验证

新增交互需要更新纯契约。home-memory.test.ts 覆盖显式队列顺序、非循环收束、循环边界与 interval restart/dispose；横滑阈值由首页触屏端到端验证；主题测试其实体页数和浏览器行为。
