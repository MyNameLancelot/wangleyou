# albums 模块

## 目的

首页与相册浏览。

## 职责

首页精选与近期照片、相册卡片、相册详情、空状态、视频未支持提示。

## 非职责

维护当前查看索引、播放资源、路由解析。

## 公开接口

index.ts 导出 HomePage({data,onOpen})、AlbumPage({album,onOpen})；onOpen(album,id) 将请求交给 app。

## 允许依赖

content、shared。

## 状态与资源生命周期

无持久业务状态；所有内容来自 props，图片加载状态交给 PhotoImage。

## 主要文件

AlbumPages.tsx 页面；AlbumPages.module.css 响应式样式。

## 扩展与验证

新增内容仅修改配置；新增交互需要更新回调契约。浏览器测试覆盖入口、空状态、响应式。
