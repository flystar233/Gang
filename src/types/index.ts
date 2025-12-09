/**
 * 应用类型定义
 */

// 视频项类型
export interface VideoItem {
  bvid: string
  title: string
  pic: string
  duration: number
  cid?: number
}

// 播放项类型（扩展 VideoItem）
export interface PlayItem extends VideoItem {
  audioUrl?: string
  audioBitrate?: number // 音频码率 kbps
  pages?: VideoItem[]
}

// 收藏项类型
export interface FavoriteItem extends VideoItem {
  audioUrl?: string
  addedAt: number // 添加时间戳
}

// 音频信息类型
export interface AudioInfo {
  url: string
  bitrate: number // kbps
}

// 播放模式类型
export type PlayMode = 'sequence' | 'loop' | 'single' | 'auto'

// 关闭行为类型
export type CloseAction = 'quit' | 'hide'

// 音频品质类型
export type AudioQuality = 'high' | 'medium' | 'low'

// 相声类型
export type GangType = 'dan' | 'dui'

// B站 API 响应类型
export interface SearchResponse {
  code: number
  data?: {
    result?: Array<{
      bvid: string
      title: string
      pic: string
      duration: string | number
    }>
  }
}

export interface VideoPage {
  cid: number
  page: number
  part: string
  duration: number
}

export interface VideoInfoResponse {
  code: number
  data?: {
    bvid: string
    cid: number
    title: string
    pic: string
    duration: number
    pages?: VideoPage[]
  }
}

export interface PlayUrlResponse {
  code: number
  data?: {
    dash?: {
      audio: Array<{
        baseUrl: string
        base_url: string
        bandwidth: number
      }>
    }
    durl?: Array<{ url: string }>
  }
}

// Tauri 响应类型
export interface TauriResponse<T> {
  status: number
  headers: Record<string, string>
  data: T
}
