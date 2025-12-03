/// <reference types="vite/client" />

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
  releaseNotes?: string
}

interface ElectronAPI {
  minimize: () => Promise<void>
  close: () => Promise<void>
  hide: () => Promise<void>
  download: (url: string, filename: string, type?: string, savePath?: string, subFolder?: string) => Promise<{ success: boolean; path?: string; error?: string }>
  selectFolder: () => Promise<string | null>
  onDownloadProgress: (callback: (progress: number) => void) => () => void
  // 更新相关
  checkForUpdate: () => Promise<{ success: boolean; version?: string; error?: string }>
  downloadUpdate: () => Promise<{ success: boolean; error?: string }>
  installUpdate: () => Promise<void>
  getVersion: () => Promise<string>
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}
