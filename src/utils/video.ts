/**
 * 视频相关工具函数
 */

import type { VideoItem } from '@/types'

/**
 * 解析时长字符串为秒数
 * @param duration 时长字符串（如 "10:30"）或数字（秒）
 * @returns 秒数
 */
export function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return duration
  if (!duration) return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

/**
 * 清理 HTML 标签
 * @param html HTML 字符串
 * @returns 清理后的文本
 */
export function stripHtmlTags(html: string): string {
  return html?.replace(/<[^>]+>/g, '') || ''
}

/**
 * 处理图片 URL（添加协议、转换 HTTPS、添加代理参数）
 * @param url 原始图片 URL
 * @returns 处理后的图片 URL
 */
export function processImageUrl(url: string, proxyParams: string = '@300w_300h_1c.webp'): string {
  if (!url) return ''
  let imageUrl = url
  
  // 处理协议相对 URL（//开头）
  if (imageUrl.startsWith('//')) {
    imageUrl = `https:${imageUrl}`
  }
  
  // 将 HTTP 转换为 HTTPS（避免混合内容问题）
  if (imageUrl.startsWith('http://')) {
    imageUrl = imageUrl.replace('http://', 'https://')
  }
  
  return `${imageUrl}${proxyParams}`
}

/**
 * 检查是否为合集（有多个分P）
 * @param item 视频项
 * @returns 是否为合集
 */
export function isCollection(item: VideoItem & { pages?: VideoItem[] }): boolean {
  return !!(item.pages && item.pages.length > 1)
}
