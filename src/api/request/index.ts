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
    return Promise.reject(error)
  }
)
