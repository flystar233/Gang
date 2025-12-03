/// <reference types="vite/client" />

interface ElectronAPI {
  minimize: () => Promise<void>
  close: () => Promise<void>
  hide: () => Promise<void>
  download: (url: string, filename: string, type?: string, savePath?: string, subFolder?: string) => Promise<{ success: boolean; path?: string; error?: string }>
  selectFolder: () => Promise<string | null>
  onDownloadProgress: (callback: (progress: number) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}

