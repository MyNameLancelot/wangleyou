# 演示照片来源

以下照片仅用于演示相册布局，不代表网站所有者或孩子的真实照片。相册日期、名称与说明均为演示文案。

来源：Pexels，2026-09-15 下载。适用 [Pexels License](https://www.pexels.com/license/)：允许免费使用和修改；不得出售未经修改的副本、暗示背书或重新分发为竞争素材服务。以原许可完整条款为准。

| 当前源文件（media-source 下） | 原始照片页面 | 下载资源 |
| --- | --- | --- |
| 2024-05-sequence00-破壳/top01.jpg | https://www.pexels.com/photo/457882/ | https://images.pexels.com/photos/457882/pexels-photo-457882.jpeg |
| 2024-05-sequence00-破壳/002.jpg | https://www.pexels.com/photo/1179229/ | https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg |
| 2024-08-sequence01-百日/top01.jpg | https://www.pexels.com/photo/2662116/ | https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg |
| 2024-08-sequence01-百日/002.jpg | https://www.pexels.com/photo/1172849/ | https://images.pexels.com/photos/1172849/pexels-photo-1172849.jpeg |
| 2025-05-sequence00-周岁/009.jpg | https://www.pexels.com/photo/807598/ | https://images.pexels.com/photos/807598/pexels-photo-807598.jpeg |
| 2025-05-sequence00-周岁/002.jpg | https://www.pexels.com/photo/102104/ | https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg |

下载时使用 Pexels 图像服务压缩至宽度 1600px；源文件位于 media-source；派生 WebP 位于同名 public/media 相册目录，宽度从 480/960/1600/2560 取不超过源宽的候选，不足480px则保留源宽。旧 thumbs 目录已经退役。素材替换时同步更新来源信息。

## 相册测试图来源（第二批）

每个相册另加了 6 张测试图，用于验证多图布局、层叠封面与查看器翻页，同样不代表真实家庭记录。

来源：Lorem Picsum（`https://picsum.photos`，图片由 Unsplash 提供），适用 [Unsplash License](https://unsplash.com/license)：允许免费使用与修改，不得原样转售或用于训练竞品服务。下表列出每张图的作者与 Unsplash 原始页面；下载后经本项目 `npm run compress:photos` 统一为 JPEG（长边 1600px、质量 82、剥离元数据）。

| 当前源文件（media-source 下） | 作者 | 原始照片页面 |
| --- | --- | --- |
| 2024-05-sequence00-破壳/003.jpg | Jon Eckert | [Unsplash](https://unsplash.com/photos/umLpP7uCZs0) |
| 2024-05-sequence00-破壳/004.jpg | Rula Sibai | [Unsplash](https://unsplash.com/photos/qVj3KuEikvg) |
| 2024-05-sequence00-破壳/005.jpg | Rula Sibai | [Unsplash](https://unsplash.com/photos/-vq7mi4oF0s) |
| 2024-05-sequence00-破壳/006.jpg | Jean Kleisz | [Unsplash](https://unsplash.com/photos/4yzPVohNuVI) |
| 2024-05-sequence00-破壳/007.jpg | Kundan Ramisetti | [Unsplash](https://unsplash.com/photos/87TJNWkepvI) |
| 2024-05-sequence00-破壳/008.jpg | Rafael Souza | [Unsplash](https://unsplash.com/photos/QxkBP3A9XmU) |
| 2024-08-sequence01-百日/003.jpg | Alexander Shustov | [Unsplash](https://unsplash.com/photos/AHBiSKaENwc) |
| 2024-08-sequence01-百日/004.jpg | Jassy Onyae | [Unsplash](https://unsplash.com/photos/1gBUXhf0PtA) |
| 2024-08-sequence01-百日/005.jpg | May Pamintuan | [Unsplash](https://unsplash.com/photos/j9nfqTi5T5o) |
| 2024-08-sequence01-百日/006.jpg | Caroline Sada | [Unsplash](https://unsplash.com/photos/r1XwWjI4PyE) |
| 2024-08-sequence01-百日/007.jpg | Vectorbeast | [Unsplash](https://unsplash.com/photos/rsJtMXn3p_c) |
| 2024-08-sequence01-百日/008.jpg | Jon Eckert | [Unsplash](https://unsplash.com/photos/IoIbdFdGCnQ) |
| 2025-05-sequence00-周岁/003.jpg | Alexander Shustov | [Unsplash](https://unsplash.com/photos/2FrX56QL7P8) |
| 2025-05-sequence00-周岁/top01.jpg | Julie Geiger | [Unsplash](https://unsplash.com/photos/dYshDcTI1Js) |
| 2025-05-sequence00-周岁/005.jpg | Sander Weeteling | [Unsplash](https://unsplash.com/photos/rlxZqmc6D_I) |
| 2025-05-sequence00-周岁/006.jpg | Daniel Genser | [Unsplash](https://unsplash.com/photos/PzPbh-faPgU) |
| 2025-05-sequence00-周岁/007.jpg | Gozha Net | [Unsplash](https://unsplash.com/photos/xDrxJCdedcI) |
| 2025-05-sequence00-周岁/008.jpg | Dorothy Lin | [Unsplash](https://unsplash.com/photos/OokBLPrkCNk) |

## 演示视频来源

演示视频是构建期发布形态的样例：源素材与照片同层放在相册目录里，构建期把 MP4 按内容哈希发布到同一相册目录，封面源素材走同一套 WebP 派生管线。

| 源素材（提交 Git，不发布） | 来源 | 许可 |
| --- | --- | --- |
| media-source/2025-05-sequence00-周岁/weekend-clip.mp4 | https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4 | CC0（MDN 示例媒体） |
| media-source/2025-05-sequence00-周岁/weekend-clip.poster.jpg | 由 macOS 自带 `qlmanage -t` 从上面这段演示视频离线抽取首帧（960×540），再用本项目 sharp 依赖转成 JPEG（质量 86、mozjpeg、剥离元数据） | 随视频素材，CC0 |

| 发布文件（构建产物，不提交 Git） | 说明 |
| --- | --- |
| public/media/2025-05-sequence00-周岁/weekend-clip.&lt;哈希12&gt;.mp4 | 构建期按内容哈希发布，与照片同一层目录 |
| public/media/2025-05-sequence00-周岁/weekend-clip.poster.&lt;哈希12&gt;.&lt;宽度&gt;.webp | 封面派生 WebP（480/960/1600/2560，不放大） |

演示视频没有对白，也不再使用字幕文件：画面说明改用相册 `meta.json` 的 `photos_meta.captions`（可按文件名登记照片或视频）。替换真实家庭视频时同步更新本文件、封面源素材与许可说明；封面抽帧是维护者的离线一步，构建期不做抽帧、不依赖 ffmpeg。若某个视频没有提供封面源素材，构建期会生成一张中立的占位封面（深色底纹、16:9）；缩略图正中的 ▶ 播放标识由页面按媒体类型叠加，不写进封面资源。

## 当前主题资产

| 发布文件（public/media 下） | 已知来源与状态 |
| --- | --- |
| themes/book/album-hero.png | 线缝相册主题提交 594e4e0 加入的原头图；仓库未登记原始制作来源及许可，仍待维护者核对，不能套用旧主题来源说明。 |
| themes/book/album-hero.webp | 从上述 PNG 原尺寸 1254×1254 无损编码；解码 RGBA 字节相同，颜色、透明通道和裁切不变。当前头图使用 WebP，PNG 保留便于比较。 |
| themes/book/music.mp3 | 当前保留但停用，不挂载 audio；来源和许可未登记，重新启用或正式使用前需要确认授权或替换。 |

当前仅 book 主题；已退役的 beach/grassland 资产说明不适用于这些文件。主题资源不属于相册素材。照片、视频封面与 MP4 派生产物同层位于 public/media/<相册目录>/，没有 thumbs 或手工 video 发布目录。

## 其他演示图的追溯状态

上表保留已登记的 Pexels/Picsum 来源；后续演示目录中重复或新增的照片，应以源文件及 Git 历史核对，不将相册日期当拍摄时间，不依据相似画面推断作者或许可。来源/使用条件未确认的文件继续待维护者补齐登记。
