import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// 检测是否在 Tauri 环境
export function checkTauriEnv(): boolean {
  try {
    return typeof window !== 'undefined' && 
           ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
  } catch {
    return false
  }
}

export const isTauri = checkTauriEnv()

// 在 Tauri 移动端（非 Capacitor）时，Capacitor.getPlatform 可能返回 web。
// 额外用 UA 判断是否运行在 Android 设备上，确保移动端样式生效。
export const isAndroid =
  Capacitor.getPlatform() === 'android' ||
  (isTauri && typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent))

export const isWeb = Capacitor.getPlatform() === 'web'

export interface DownloadResult {
  success: boolean
  path?: string
  error?: string
}

export interface PlatformAPI {
  download: (url: string, filename: string, type?: string, savePath?: string, subFolder?: string) => Promise<DownloadResult>
  onDownloadProgress: (callback: (progress: number) => void) => () => void
  selectFolder: () => Promise<string | null>
  minimize?: () => Promise<void>
  close?: () => Promise<void>
  hide?: () => Promise<void>
  checkForUpdate?: () => Promise<{ success: boolean; version?: string; error?: string }>
  downloadUpdate?: () => Promise<{ success: boolean; error?: string }>
  installUpdate?: () => Promise<void>
  getVersion?: () => Promise<string>
  onUpdateStatus?: (callback: (status: any) => void) => () => void
  setCloseAction?: (action: 'quit' | 'hide') => Promise<void>
  getCloseAction?: () => Promise<'quit' | 'hide'>
}

// Tauri 平台实现
const tauriAPI: PlatformAPI = {
  download: async (url: string, filename: string, type?: string, savePath?: string, subFolder?: string) => {
    try {
      const result = await invoke('download_file', {
        url,
        filename,
        fileType: type,
        savePath,
        subFolder,
      })
      return result as DownloadResult
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  onDownloadProgress: (callback: (progress: number) => void) => {
    if (!isTauri) {
      return () => {}
    }
    let unlisten: (() => void) | null = null
    
    listen<{ progress: number }>('download-progress', (event) => {
      callback(event.payload.progress)
    }).then((fn) => {
      unlisten = fn
    }).catch(() => {})
    
    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  },
  selectFolder: async () => {
    try {
      const result = await invoke<string | null>('select_folder')
      return result
    } catch {
      return null
    }
  },
  minimize: async () => {
    try {
      await invoke('minimize_window')
    } catch {
      // 忽略错误
    }
  },
  close: async () => {
    try {
      await invoke('close_window')
    } catch {
      // 忽略错误
    }
  },
  hide: async () => {
    try {
      await invoke('hide_window')
    } catch {
      // 忽略错误
    }
  },
  checkForUpdate: async () => {
    try {
      const result = await invoke<{ success: boolean; version?: string; error?: string }>('check_for_update')
      return result
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  downloadUpdate: async () => {
    try {
      const result = await invoke<{ success: boolean; error?: string }>('download_update')
      return result
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  installUpdate: async () => {
    try {
      await invoke('install_update')
    } catch {
      // 忽略错误
    }
  },
  getVersion: async () => {
    try {
      return await invoke<string>('get_app_version')
    } catch {
      return '1.0.0'
    }
  },
  onUpdateStatus: (callback: (status: any) => void) => {
    if (!isTauri) {
      return () => {}
    }
    let unlisten: (() => void) | null = null
    
    listen('update-status', (event) => {
      callback(event.payload)
    }).then((fn) => {
      unlisten = fn
    }).catch(() => {})
    
    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  },
  setCloseAction: async (action: 'quit' | 'hide') => {
    try {
      await invoke('set_close_action', { action })
    } catch {
      // 忽略错误
    }
  },
  getCloseAction: async () => {
    try {
      const action = await invoke<string>('get_close_action')
      return (action === 'hide' ? 'hide' : 'quit') as 'quit' | 'hide'
    } catch {
      return 'quit'
    }
  }
}

// Android/Web 平台实现
const capacitorAPI: PlatformAPI = {
  download: async (url: string, filename: string, type?: string, _savePath?: string, subFolder?: string) => {
    try {
      // 下载文件
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com',
          'Origin': 'https://www.bilibili.com',
        },
      })

      if (!response.ok) {
        return { success: false, error: '下载失败' }
      }

      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      const base64Data = btoa(
        Array.from(uint8Array)
          .map(byte => String.fromCharCode(byte))
          .join('')
      )

      // 构建文件路径
      const ext = type === 'video' ? '.mp4' : '.m4a'
      const safeName = filename.replace(/[<>:"/\\|?*]/g, '_') + ext
      let filePath = safeName

      if (subFolder) {
        const safeFolder = subFolder.replace(/[<>:"/\\|?*]/g, '_')
        filePath = `${safeFolder}/${safeName}`
      }

      // 保存文件
      await Filesystem.writeFile({
        path: filePath,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      })

      return { success: true, path: filePath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  },
  onDownloadProgress: (_callback: (progress: number) => void) => {
    // Android 平台暂时不支持进度回调，返回空函数
    // 可以通过 XMLHttpRequest 实现，但需要额外处理
    return () => {}
  },
  selectFolder: async () => {
    // Android 平台不支持选择文件夹，返回默认下载路径
    return null
  }
}

// 导出平台 API
export const platformAPI: PlatformAPI = isTauri ? tauriAPI : capacitorAPI

