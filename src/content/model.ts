export interface Photo {
  id: string
  type: 'photo'
  src: string
  thumbnail?: string
  date?: string
  description?: string
  alt?: string
  width?: number
  height?: number
}

export interface Video {
  id: string
  type: 'video'
  src: string
  thumbnail?: string
  poster?: string
  date?: string
  description?: string
  alt?: string
  width?: number
  height?: number
  duration?: number
}

export type Media = Photo | Video

export interface Album {
  id: string
  title: string
  description?: string
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
