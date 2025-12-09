import axios from 'axios'
import { checkTauriEnv } from '@/utils/platform'
import type { TauriResponse } from '@/types'
import { BILIBILI_API_BASE, BILIBILI_SITE_URL, HTTP_TIMEOUT } from '@/constants'

const axiosInstance = axios.create({
  baseURL: BILIBILI_API_BASE,
  timeout: HTTP_TIMEOUT,
  withCredentials: true,
  headers: {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': BILIBILI_SITE_URL,
    'Origin': BILIBILI_SITE_URL,
  },
})

axiosInstance.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API 请求失败:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      url: error.config?.url,
    })
    return Promise.reject(error)
  }
)

// TauriResponse 类型已移至 @/types

// 公共方法：调用Tauri HTTP请求
async function invokeHttpRequest<T>(url: string, params?: Record<string, any>): Promise<TauriResponse<T>> {
  const { invoke } = await import('@tauri-apps/api/core')
  const stringParams = params 
    ? Object.fromEntries(
        Object.entries(params).map(([key, value]) => [
          key, 
          value === null || value === undefined ? '' : String(value)
        ])
      )
    : null
  
  return invoke<TauriResponse<T>>('http_request', {
    url,
    method: 'GET',
    headers: null,
    params: stringParams,
  })
}

export const apiRequest = {
  get: async <T = any>(url: string, config?: { params?: Record<string, any> }) => {
    const fullUrl = url.startsWith('http') ? url : `${BILIBILI_API_BASE}${url}`
    const isTauri = checkTauriEnv()
    
    if (isTauri) {
      try {
        const result = await invokeHttpRequest<T>(fullUrl, config?.params)
        
        if (result.status >= 200 && result.status < 300) {
          return result.data
        } else if (result.status === 412) {
          // 412错误时，先访问bilibili.com获取cookies，然后重试
          try {
            await invokeHttpRequest(BILIBILI_SITE_URL)
            const retryResult = await invokeHttpRequest<T>(fullUrl, config?.params)
            
            if (retryResult.status >= 200 && retryResult.status < 300) {
              return retryResult.data
            }
            throw new Error(`HTTP ${retryResult.status}: ${JSON.stringify(retryResult.data)}`)
          } catch {
            throw new Error(`HTTP 412 Precondition Failed: ${JSON.stringify(result.data)}`)
          }
        } else {
          throw new Error(`HTTP ${result.status}: ${JSON.stringify(result.data)}`)
        }
      } catch (error) {
        throw error
      }
    }
    
    // 非Tauri环境降级到axios
    try {
      const result = await invokeHttpRequest<T>(fullUrl, config?.params)
      return result.data
    } catch {
      return axiosInstance.get<T>(url, config)
    }
  }
}
