# albums 模块

## 目的

首页与相册浏览。

## 职责

首页（影像入口、精选回忆、相册入口、继续浏览）、影像浏览（类型筛选、年份分组与定位）、相册索引、相册详情（元信息、从这里播放、相邻相册）、图片与视频共用的缩略图组件、空状态。

## 非职责

维护当前查看索引、播放资源、主题变量、路由解析。

## 公开接口

index.ts 导出 HomePage({data,onOpen,resume,onResume})、BrowsePage({data,onOpen})、AlbumsPage({data})、AlbumPage({album,albums,onOpen}) 与类型 OpenMedia。onOpen(album,id) 把打开媒体的请求交给 app。

## 允许依赖

content、shared。

## 状态与资源生命周期

无持久业务状态；所有内容来自 props，图片加载与失败状态交给 PhotoImage。浏览页的筛选与年份定位是本地视图状态。

## 主要文件

AlbumPages.tsx 页面；AlbumPages.module.css 响应式样式。

## 扩展与验证

新增内容仅修改配置；新增交互需要更新回调契约。browser 测试覆盖首页入口、年份分组与筛选、相邻相册、空状态、44×44 触控目标与无横向溢出。
