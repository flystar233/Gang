import { apiRequest } from '@/api/request'
import { getAllKeywords, useSettingsStore } from '@/store/settings'
import { checkTauriEnv } from '@/utils/platform'
import { LRUCache } from '@/utils/cache'
import {
  type VideoItem,
  type AudioInfo,
  type SearchResponse,
  type VideoInfoResponse,
  type PlayUrlResponse,
} from '@/types'
import {
  AUDIO_URL_CACHE_SIZE,
  DANKOU_KEYWORDS,
  DUIKOU_KEYWORDS,
  IMAGE_PROXY_PARAMS,
  PLAYED_VIDEOS_CACHE_SIZE,
} from '@/constants'
import type { AudioQuality } from '@/types'
import { parseDuration, processImageUrl, stripHtmlTags } from '@/utils/video'

const audioUrlCache = new LRUCache<string, string>(AUDIO_URL_CACHE_SIZE)

export async function proxyAudioUrl(url: string): Promise<string> {
  // 检查缓存
  const cached = audioUrlCache.get(url)
  if (cached) {
    return cached
  }
  
  // 移动端 Tauri 有时 checkTauriEnv 可能返回 false，这里用 UA 兜底
  const isTauri =
    checkTauriEnv() ||
    (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent))
  
  if (isTauri) {
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)
    
    // Android 平台：先确保代理服务器已启动
    if (isAndroid) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        // 尝试启动代理服务器（如果还没启动）
        await invoke<number>('start_proxy_server').catch(() => {
          // 忽略错误，可能已经启动了
        })
      } catch {
        // 忽略错误
      }
    }
    
    // 重试机制：Android 上可能需要等待代理服务器启动
    let retries = isAndroid ? 3 : 1
    let lastError: any = null
    
    while (retries > 0) {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        
        // 使用代理服务器 URL（支持流式播放和 Range 请求）
        const proxyUrl = await invoke<string>('proxy_audio', { url })
        
        // 验证代理 URL 是否有效
        if (!proxyUrl || (!proxyUrl.startsWith('http://127.0.0.1:') && !proxyUrl.startsWith('http://localhost:'))) {
          throw new Error('代理 URL 无效')
        }
        
        // 缓存代理 URL（LRU自动管理大小）
        audioUrlCache.set(url, proxyUrl)
        
        return proxyUrl
      } catch (invokeError: any) {
        lastError = invokeError
        console.error(`[Audio Proxy] Tauri 代理失败 (剩余重试: ${retries - 1}):`, invokeError)
        
        retries--
        if (retries > 0 && isAndroid) {
          // Android 上等待一段时间后重试（给代理服务器启动时间）
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        
        // Android 上代理失败时，抛出错误而不是降级（因为原 URL 会有 CORS 问题）
        if (isAndroid) {
          throw new Error(`代理服务器启动失败: ${lastError?.message || '未知错误'}`)
        }
        // 非 Android 平台降级到原 URL
        return url
      }
    }
  }
  return url
}

// 类型定义已移至 @/types
// parseDuration 函数已移至 @/utils/video

// 搜索相声视频（网络错误会向上抛出）
async function searchVideos(keyword: string, page = 1): Promise<VideoItem[]> {
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
    title: stripHtmlTags(item.title || ''),
    pic: processImageUrl(item.pic || '', ''),
    duration: parseDuration(item.duration),
  }))
}

// 获取视频详情（网络错误会向上抛出）
export async function getVideoInfo(bvid: string): Promise<VideoInfoResponse['data'] | null> {
  const res = await apiRequest.get<VideoInfoResponse>('/x/web-interface/view', { params: { bvid } })
  const data = res as unknown as VideoInfoResponse
  return data.code === 0 ? data.data || null : null
}

// 获取合集的所有分P视频
export async function getCollectionVideos(bvid: string): Promise<{ mainTitle: string; pages: VideoItem[] } | null> {
  const info = await getVideoInfo(bvid)
  if (!info || !info.pages || info.pages.length <= 1) {
    // 不是合集或只有一个分P，返回 null
    return null
  }

  // 返回合集主标题和所有分P
  return {
    mainTitle: info.title,
    pages: info.pages.map((page) => ({
      bvid: info.bvid,
      title: page.part,
      pic: info.pic,
      duration: page.duration,
      cid: page.cid,
    })),
  }
}

// AudioInfo 类型已移至 @/types

// 根据品质设置选择音频
function selectAudioByQuality(
  audioList: Array<{ baseUrl: string; base_url: string; bandwidth: number }>,
  quality: AudioQuality
): AudioInfo | null {
  if (audioList.length === 0) return null
  
  // 按码率排序（高到低）
  const sorted = [...audioList].sort((a, b) => b.bandwidth - a.bandwidth)
  
  let selected: typeof sorted[0]
  
  switch (quality) {
    case 'high':
      selected = sorted[0]
      break
    case 'medium':
      selected = sorted[Math.floor(sorted.length / 2)]
      break
    case 'low':
      selected = sorted[sorted.length - 1]
      break
    default:
      selected = sorted[0]
  }
  
  const url = selected?.baseUrl || selected?.base_url
  if (!url) return null
  
  return {
    url,
    bitrate: Math.round(selected.bandwidth / 1000), // 转换为 kbps
  }
}

// 获取音频播放地址和码率（网络错误会向上抛出）
export async function getAudioUrl(bvid: string, cid: number): Promise<AudioInfo | null> {
  // fnval=16 请求 DASH 格式（音视频分离，支持音质选择）
  const res = await apiRequest.get<PlayUrlResponse>('/x/player/playurl', {
    params: { bvid, cid, fnval: 16 },
  })

  const data = res as unknown as PlayUrlResponse
  if (data.code !== 0) return null

  // 优先 dash 格式（支持音质选择）
  const audioList = data.data?.dash?.audio || []
  if (audioList.length > 0) {
    const { audioQuality } = useSettingsStore.getState()
    const selected = selectAudioByQuality(audioList, audioQuality)
    if (selected) {
      // 代理音频 URL（解决 CORS 问题）
      const proxiedUrl = await proxyAudioUrl(selected.url)
      return {
        url: proxiedUrl,
        bitrate: selected.bitrate,
      }
    }
  }

  // 降级 durl（老视频，不支持音质选择）
  if (data.data?.durl?.[0]) {
    // 代理音频 URL（解决 CORS 问题）
    const proxiedUrl = await proxyAudioUrl(data.data.durl[0].url)
    return {
      url: proxiedUrl,
      bitrate: 0, // durl 格式无法获取音频码率
    }
  }
  
  return null
}

// 已播放过的视频，避免重复
const playedVideos = new Set<string>()

// 清理播放历史（保持缓存大小）
function cleanupPlayedVideos() {
  if (playedVideos.size > PLAYED_VIDEOS_CACHE_SIZE) {
    const toRemove = Array.from(playedVideos).slice(0, playedVideos.size - PLAYED_VIDEOS_CACHE_SIZE)
    toRemove.forEach(bvid => playedVideos.delete(bvid))
  }
}

// 随机获取一个相声视频（通用函数）
// 如果是合集，返回带 pages 属性的对象；否则返回单个视频
async function getRandomVideoByKeywords(keywords: string[]): Promise<VideoItem | (VideoItem & { pages: VideoItem[] }) | null> {
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
        cleanupPlayedVideos()
        
        // 检查是否是合集
        const collection = await getCollectionVideos(info.bvid)
        if (collection) {
          // 是合集，返回主标题和所有分P
          return {
            bvid: info.bvid,
            title: collection.mainTitle,
            pic: info.pic,
            duration: collection.pages[0]?.duration || info.duration,
            cid: collection.pages[0]?.cid || info.cid,
            pages: collection.pages,
          } as VideoItem & { pages: VideoItem[] }
        }
        
        // 不是合集，返回单个视频
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
        
        // 检查是否是合集
        const collection = await getCollectionVideos(info.bvid)
        if (collection) {
          return {
            bvid: info.bvid,
            title: collection.mainTitle,
            pic: info.pic,
            duration: collection.pages[0]?.duration || info.duration,
            cid: collection.pages[0]?.cid || info.cid,
            pages: collection.pages,
          } as VideoItem & { pages: VideoItem[] }
        }
        
        return { bvid: info.bvid, title: info.title, pic: info.pic, duration: info.duration, cid: info.cid }
      }
    }
  }

  return null
}

// 随机获取一个相声视频（可能是单个或合集）
export async function getRandomVideo(): Promise<VideoItem | (VideoItem & { pages: VideoItem[] }) | null> {
  const keywords = getAllKeywords()
  return getRandomVideoByKeywords(keywords)
}

// 随机获取一个单口相声视频（可能是单个或合集）
export async function getRandomDanKouVideo(): Promise<VideoItem | (VideoItem & { pages: VideoItem[] }) | null> {
  return getRandomVideoByKeywords([...DANKOU_KEYWORDS])
}

// 随机获取一个对口相声视频（可能是单个或合集）
export async function getRandomDuiKouVideo(): Promise<VideoItem | (VideoItem & { pages: VideoItem[] }) | null> {
  return getRandomVideoByKeywords([...DUIKOU_KEYWORDS])
}

// 处理图片 URL（使用工具函数）
export function getProxiedImageUrl(url: string): string {
  return processImageUrl(url, IMAGE_PROXY_PARAMS)
}
