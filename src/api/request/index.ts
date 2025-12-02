import axios from 'axios'

export const apiRequest = axios.create({
  baseURL: 'https://api.bilibili.com',
  timeout: 15000,
  withCredentials: true,
})

// 响应拦截器 - 直接返回 data
apiRequest.interceptors.response.use(
  response => response.data,
  error => {
    console.error('API 请求失败:', error)
    return Promise.reject(error)
  }
)
