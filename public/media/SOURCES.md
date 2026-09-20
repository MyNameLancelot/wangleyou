# 演示照片来源

以下照片仅用于演示相册布局，不代表网站所有者或孩子的真实照片。相册日期、名称与说明均为演示文案。

来源：Pexels，2026-09-15 下载。适用 [Pexels License](https://www.pexels.com/license/)：允许免费使用和修改；不得出售未经修改的副本、暗示背书或重新分发为竞争素材服务。以原许可完整条款为准。

| 发布文件 | 原始照片页面 | 下载资源 |
| --- | --- | --- |
| seaside.jpg | https://www.pexels.com/photo/457882/ | https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg |
| forest.jpg | https://www.pexels.com/photo/1179229/ | https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg |
| lake.jpg | https://www.pexels.com/photo/2662116/ | https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg |
| flowers.jpg | https://www.pexels.com/photo/1172849/ | https://images.pexels.com/photos/1172849/pexels-photo-1172849.jpeg |
| leaves.jpg | https://www.pexels.com/photo/807598/ | https://images.pexels.com/photos/807598/pexels-photo-807598.jpeg |
| picnic.jpg | https://www.pexels.com/photo/102104/ | https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg |

下载时使用 Pexels 图像服务压缩至宽度 1600px；thumbs 下的派生 WebP 由本项目脚本生成，最长边 640px，不放大。素材替换时同步更新来源信息。

## 演示视频来源

| 发布文件 | 来源 | 许可 |
| --- | --- | --- |
| video/weekend-clip.mp4 | https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4 | CC0（MDN 示例媒体） |
| video/weekend-clip.zh.vtt | 本项目编写 | 仅用于演示字幕说明，无对白 |

视频封面复用 `thumbs/flowers.webp`（同一 Pexels 演示照片的派生缩略图）。演示视频没有对白，字幕用于说明画面内容与演示用途；替换真实家庭视频时同步更新本文件与字幕。

## 主题背景插画

| 发布文件 | 来源 | 说明 |
| --- | --- | --- |
| themes/beach/home-hero.webp | 用户提供的海滩图，经局部图像修复去除沙地石粒后重采样与 WebP 编码 | 2560×1440；非原始素材，用于首页海滩首屏 |
| themes/beach/home-memory.webp | 从用户提供原图的底部连续沙滩带截取参考，经 OpenAI 图像生成工具向下扩展并去除石粒；最终只保留扩展区域，并以等比例中心裁切重采样 | 2560×1440，海边主题首页第二屏背景；不属于相册内容 |
| themes/grassland/home-hero.webp | 本项目设计资产 `docs/design-assets/grassland-environment-v1.png` | 同上（约 101 KB） |
| themes/beach/home-hero-2k.webp | 用户提供的早期海滩首屏图（`home-hero.webp` 的前一版） | 2560×1440；当前没有被任何主题引用，保留待用户确认是否删除 |

`themes/grassland/home-hero.webp` 为本项目原创演示插画，不含真实家庭影像或第三方品牌元素；`themes/beach/home-hero.webp` 与 `themes/beach/home-memory.webp` 为用户提供并经处理的非原始素材。替换为实拍素材时同步更新本文件与许可说明。

主题私有资源按主题分目录存放，内容资产（照片、缩略图、视频）仍在 `public/media/` 顶层、`thumbs/` 与 `video/`。

## 演示背景音乐

| 发布文件 | 当前状态 |
| --- | --- |
| themes/beach/music.mp3 | 来源和许可未登记；当前仅作为非商业演示占位，正式发布或商用前必须替换或确认授权。 |
| themes/grassland/music.mp3 | 同上。 |

这两个音频已重编码为 96 kbps mono。替换为真实家庭音乐时同步更新本文件、许可说明与主题组件引用。
