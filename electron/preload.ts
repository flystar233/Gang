import { contextBridge, ipcRenderer } from 'electron'

interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
  releaseNotes?: string
}

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  hide: () => ipcRenderer.invoke('window:hide'),
  download: (url: string, filename: string, type: string, savePath?: string, subFolder?: string) => 
    ipcRenderer.invoke('download', url, filename, type, savePath, subFolder),
  selectFolder: () => ipcRenderer.invoke('selectFolder'),
  onDownloadProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('download-progress', (_event, progress) => callback(progress))
    return () => ipcRenderer.removeAllListeners('download-progress')
  },
  // 更新相关
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => {
    ipcRenderer.on('update-status', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('update-status')
  },
})

