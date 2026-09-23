export interface Photo {
  id: string
  type: 'photo'
  src: string
  date?: string
  /** 单张照片的寄语：来自相册 meta.json 的 photos_meta.captions，查看器据此显示照片下方文案。 */
  caption?: string
  description?: string
  alt?: string
  width?: number
  height?: number
  /** 发布用的同宽高比响应式 WebP 候选图；原图不在浏览器侧公开。 */
  srcSet?: Array<{ src: string; width: number; height: number }>
}

export interface Video {
  id: string
  type: 'video'
  /** 发布用的 MP4：构建期按内容哈希发布到相册目录，浏览器只在查看器中按需加载。 */
  src: string
  /** 发布用的封面：来自相册目录内 `<视频同名>.poster.jpg` 的派生 WebP，缺失时构建失败。 */
  poster: string
  /** 封面的同宽高比响应式 WebP 候选图，供相册网格按列宽取合适尺寸。 */
  posterSrcSet?: Array<{ src: string; width: number; height: number }>
  date?: string
  /** 与照片共用同一字段语义：媒体自身的寄语文案。 */
  caption?: string
  description?: string
  alt?: string
  /** 取封面派生尺寸；本项目不探测真实视频画幅（构建期不依赖 ffprobe）。 */
  width?: number
  height?: number
  duration?: number
}

/** 首页主回忆由 photos/home-memory.json 显式给出，数组顺序即播放顺序。 */
export type HomeMemoryPhoto = Photo

export type Media = Photo | Video

export interface Album {
  id: string
  title: string
  description?: string
  /** 相册详情页沉浸式开场引言；缺省时主题回退到 description。 */
  opening?: string
  date?: string
  cover?: string
  media: Media[]
}

export interface SiteContent {
  site: {
    title: string
    subtitle: string
  }
  albums: Album[]
}
