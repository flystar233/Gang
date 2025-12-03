import { contextBridge, ipcRenderer } from 'electron'

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
})

