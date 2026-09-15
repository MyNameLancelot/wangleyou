# shared 模块

## 目的

复用图片基础组件。

## 职责

在卡片中显示图片、维持容器大小及失败占位。

## 非职责

相册业务、播放状态、主题选择。

## 公开接口

index.ts 导出 PhotoImage({src,alt,className?,width?,height?,eager?})。

## 允许依赖

无业务模块依赖。

## 状态与资源生命周期

图片状态由组件本地管理；src 变化重建内部状态，不注册全局监听。卡片不内嵌重试按钮，点击仍可进入查看器重试。

## 主要文件

PhotoImage.tsx 图片；PhotoImage.module.css 加载容器。

## 扩展与验证

只有实际跨模块复用才加入 shared。通过首页与相册浏览器测试验证图片展示。
