/**
 * 应用常量定义
 */

// 默认搜索关键词
export const DEFAULT_KEYWORDS = [
  '郭德纲 于谦 相声',
  '德云社 相声',
  '郭德纲 相声 完整版',
  '于谦 郭德纲',
  '德云社 郭德纲',
  '郭德纲 单口相声',
  '郭德纲 经典相声',
] as const

// 单口相声关键词
export const DANKOU_KEYWORDS = [
  '郭德纲 单口相声',
  '郭德纲 单口',
  '郭德纲 德云社 单口相声',
  '郭德纲 评书',
  '郭德纲 单口相声 完整版',
] as const

// 对口相声关键词
export const DUIKOU_KEYWORDS = [
  '郭德纲 于谦 相声',
  '郭德纲 德云社 对口相声',
  '郭德纲 于谦 对口',
  '于谦 郭德纲 相声',
  '郭德纲 对口相声 完整版',
] as const

// 播放模式顺序
export const PLAY_MODES = ['sequence', 'loop', 'single', 'auto'] as const

// 播放速度选项
export const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0] as const

// B站 API 基础 URL
export const BILIBILI_API_BASE = 'https://api.bilibili.com'

// B站网站 URL
export const BILIBILI_SITE_URL = 'https://www.bilibili.com'

// HTTP 请求超时时间（毫秒）
export const HTTP_TIMEOUT = 15000

// 已播放视频缓存大小
export const PLAYED_VIDEOS_CACHE_SIZE = 100

// 音频 URL 缓存大小
export const AUDIO_URL_CACHE_SIZE = 10

// 图片代理参数
export const IMAGE_PROXY_PARAMS = '@300w_300h_1c.webp'
