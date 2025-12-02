import { apiRequest } from './request'
import { getAllKeywords } from '../store/settings'

export interface VideoItem {
  bvid: string
  title: string
  pic: string
  duration: number
  cid?: number
}

interface SearchResponse {
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

interface VideoInfoResponse {
  code: number
  data?: {
    bvid: string
    cid: number
    title: string
    pic: string
    duration: number
  }
}

interface PlayUrlResponse {
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

// 解析时长字符串 "10:30" -> 秒数
function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return duration
  if (!duration) return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

// 搜索相声视频
async function searchVideos(keyword: string, page = 1): Promise<VideoItem[]> {
  try {
    // 先尝试 30-60 分钟时长
    let res = await apiRequest.get<SearchResponse>('/x/web-interface/search/type', {
      params: { keyword, search_type: 'video', order: 'totalrank', duration: 3, page, page_size: 20 },
    })

    let data = res as unknown as SearchResponse
    if (data.code !== 0 || !data.data?.result) {
      // 不限制时长重试
      res = await apiRequest.get<SearchResponse>('/x/web-interface/search/type', {
        params: { keyword, search_type: 'video', order: 'totalrank', page, page_size: 20 },
      })
      data = res as unknown as SearchResponse
      if (data.code !== 0 || !data.data?.result) return []
    }

    return data.data.result.map(item => ({
      bvid: item.bvid,
      title: item.title?.replace(/<[^>]+>/g, '') || '',
      pic: item.pic?.startsWith('//') ? `https:${item.pic}` : item.pic,
      duration: parseDuration(item.duration),
    }))
  } catch {
    return []
  }
}

// 获取视频详情
export async function getVideoInfo(bvid: string): Promise<VideoInfoResponse['data'] | null> {
  try {
    const res = await apiRequest.get<VideoInfoResponse>('/x/web-interface/view', { params: { bvid } })
    const data = res as unknown as VideoInfoResponse
    return data.code === 0 ? data.data || null : null
  } catch {
    return null
  }
}

// 获取音频播放地址
export async function getAudioUrl(bvid: string, cid: number): Promise<string | null> {
  try {
    const res = await apiRequest.get<PlayUrlResponse>('/x/player/playurl', {
      params: { bvid, cid, fnval: 16, qn: 64, platform: 'html5', high_quality: 1 },
    })

    const data = res as unknown as PlayUrlResponse
    if (data.code !== 0) return null

    // 优先 dash 格式
    const audioList = data.data?.dash?.audio || []
    if (audioList.length > 0) {
      const sorted = audioList.sort((a, b) => b.bandwidth - a.bandwidth)
      return sorted[0]?.baseUrl || sorted[0]?.base_url || null
    }

    // 降级 durl
    if (data.data?.durl?.[0]) return data.data.durl[0].url
    return null
  } catch {
    return null
  }
}

// 已播放过的视频，避免重复
const playedVideos = new Set<string>()

// 随机获取一个相声视频（通用函数）
async function getRandomVideoByKeywords(keywords: string[]): Promise<VideoItem | null> {
  if (keywords.length === 0) return null
  
  const keyword = keywords[Math.floor(Math.random() * keywords.length)]
  const page = Math.floor(Math.random() * 3) + 1

  const videos = await searchVideos(keyword, page)

  if (videos.length > 0) {
    const unplayed = videos.filter(v => !playedVideos.has(v.bvid))
    const candidates = unplayed.length > 0 ? unplayed : videos
    const shuffled = candidates.sort(() => Math.random() - 0.5)

    for (const video of shuffled) {
      const info = await getVideoInfo(video.bvid)
      if (info) {
        playedVideos.add(info.bvid)
        if (playedVideos.size > 100) {
          const first = playedVideos.values().next().value
          if (first) playedVideos.delete(first)
        }
        return { bvid: info.bvid, title: info.title, pic: info.pic, duration: info.duration, cid: info.cid }
      }
    }
  }

  // 回退：尝试其他关键词
  for (const kw of keywords) {
    if (kw === keyword) continue
    const fallback = await searchVideos(kw, 1)
    if (fallback.length > 0) {
      const video = fallback[Math.floor(Math.random() * fallback.length)]
      const info = await getVideoInfo(video.bvid)
      if (info) {
        playedVideos.add(info.bvid)
        return { bvid: info.bvid, title: info.title, pic: info.pic, duration: info.duration, cid: info.cid }
      }
    }
  }

  return null
}

// 随机获取一个相声视频
export async function getRandomVideo(): Promise<VideoItem | null> {
  const keywords = getAllKeywords()
  return getRandomVideoByKeywords(keywords)
}

// 随机获取一个单口相声视频
export async function getRandomDanKouVideo(): Promise<VideoItem | null> {
  const keywords = [
    '郭德纲 单口相声',
    '郭德纲 单口',
    '郭德纲 德云社 单口相声',
    '郭德纲 评书',
    '郭德纲 单口相声 完整版',
  ]
  return getRandomVideoByKeywords(keywords)
}

// 随机获取一个对口相声视频
export async function getRandomDuiKouVideo(): Promise<VideoItem | null> {
  const keywords = [
    '郭德纲 于谦 相声',
    '郭德纲 德云社 对口相声',
    '郭德纲 于谦 对口',
    '于谦 郭德纲 相声',
    '郭德纲 对口相声 完整版',
  ]
  return getRandomVideoByKeywords(keywords)
}

// 处理图片 URL
export function getProxiedImageUrl(url: string): string {
  if (!url) return ''
  const imageUrl = url.startsWith('//') ? `https:${url}` : url
  return `${imageUrl}@300w_300h_1c.webp`
}
