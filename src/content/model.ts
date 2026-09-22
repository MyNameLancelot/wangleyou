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
}

export interface Video {
  id: string
  type: 'video'
  src: string
  poster?: string
  /** 说明字幕（WebVTT）：无对白的家庭短片也应有文字说明，供无法听音的场景使用。 */
  captions?: string
  date?: string
  /** 与照片共用同一字段语义：媒体自身的寄语文案。 */
  caption?: string
  description?: string
  alt?: string
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
