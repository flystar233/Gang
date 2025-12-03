import { app, BrowserWindow, ipcMain, session, dialog, Tray, Menu, nativeImage } from 'electron'
import { autoUpdater } from 'electron-updater'
import { createHmac } from 'crypto'
import { join } from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const UserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ============ 自动更新配置 ============

// 配置自动更新
autoUpdater.autoDownload = false // 不自动下载，让用户选择
autoUpdater.autoInstallOnAppQuit = true // 退出时自动安装

// 更新事件处理
function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update-status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update-status', { 
      status: 'available', 
      version: info.version,
      releaseNotes: info.releaseNotes 
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-status', { 
      status: 'downloading', 
      percent: Math.round(progress.percent) 
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-status', { status: 'downloaded' })
  })

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] Error:', error.message)
    mainWindow?.webContents.send('update-status', { 
      status: 'error', 
      message: error.message 
    })
  })
}

// 存储获取到的认证信息
let authInfo: {
  buvid3: string
  buvid4: string
  bili_ticket: string
} = {
  buvid3: '',
  buvid4: '',
  bili_ticket: '',
}

// ============ Cookie 获取 ============

// 计算 HMAC-SHA256 签名
function hmacSha256(message: string): string {
  const hmac = createHmac('sha256', 'XgwSnGZ1p')
  hmac.update(message)
  return hmac.digest('hex')
}

// 获取 bili_ticket
async function getBiliTicket(): Promise<string> {
  const ts = Math.floor(Date.now() / 1000)
  const hexsign = hmacSha256(`ts${ts}`)

  const url = 'https://api.bilibili.com/bapis/bilibili.api.ticket.v1.Ticket/GenWebTicket'
  const params = new URLSearchParams({
    key_id: 'ec02',
    hexsign,
    'context[ts]': String(ts),
    csrf: '',
  })

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'POST',
    headers: { 'User-Agent': UserAgent },
  })

  const data = await response.json()
  return data?.data?.ticket || ''
}

// 获取 buvid
async function getWebBuvid(): Promise<{ b_3: string; b_4: string }> {
  const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
    method: 'GET',
    headers: { 'User-Agent': UserAgent },
  })

  const data = await response.json()
  return data?.data || { b_3: '', b_4: '' }
}

// 获取所有认证信息
async function fetchAuthInfo() {
  try {
    const [ticket, buvid] = await Promise.all([getBiliTicket(), getWebBuvid()])
    authInfo = {
      buvid3: buvid.b_3 || '',
      buvid4: buvid.b_4 || '',
      bili_ticket: ticket || '',
    }
  } catch {
    // 忽略错误
  }
}

// ============ 网络拦截器 ============

function installWebRequestInterceptors() {
  const biliUrls = ['*://*.bilibili.com/*', '*://*.bilivideo.com/*', '*://*.hdslb.com/*']
  const origin = 'https://www.bilibili.com'
  const referer = 'https://www.bilibili.com'

  // 请求头拦截 - 添加 Referer、Origin、User-Agent 和 Cookie
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: biliUrls },
    (details, callback) => {
      const headers = details.requestHeaders || {}
      
      headers['Referer'] = referer
      headers['Origin'] = origin
      headers['User-Agent'] = UserAgent
      
      // 手动添加 Cookie
      const cookies: string[] = []
      if (authInfo.buvid3) cookies.push(`buvid3=${authInfo.buvid3}`)
      if (authInfo.buvid4) cookies.push(`buvid4=${authInfo.buvid4}`)
      if (authInfo.bili_ticket) cookies.push(`bili_ticket=${authInfo.bili_ticket}`)
      
      if (cookies.length > 0) {
        const existingCookie = headers['Cookie'] || ''
        headers['Cookie'] = existingCookie ? `${existingCookie}; ${cookies.join('; ')}` : cookies.join('; ')
      }
      
      callback({ requestHeaders: headers })
    }
  )

  // 响应头拦截 - 处理 CORS
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: biliUrls },
    (details, callback) => {
      const responseHeaders = details.responseHeaders || {}
      responseHeaders['Access-Control-Allow-Origin'] = ['*']
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS']
      responseHeaders['Access-Control-Allow-Headers'] = ['*']
      responseHeaders['Access-Control-Allow-Credentials'] = ['true']
      callback({ responseHeaders })
    }
  )
}

// ============ 托盘创建 ============

function createTray() {
  // 创建托盘图标 - 从 src/assets 目录加载
  // 打包后路径：resources/app.asar/src/assets/guodegang.png
  // 开发时路径：src/assets/guodegang.png
  const appPath = app.getAppPath()
  const iconPath = join(appPath, 'src', 'assets', 'guodegang.png')
  
  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty() || !existsSync(iconPath)) {
    // 如果图标加载失败，创建一个简单的绿色图标
    const size = 16
    const buffer = Buffer.alloc(size * size * 4)
    for (let i = 0; i < size * size; i++) {
      buffer[i * 4] = 0x44     // R
      buffer[i * 4 + 1] = 0x96 // G
      buffer[i * 4 + 2] = 0x5B // B
      buffer[i * 4 + 3] = 0xFF // A
    }
    icon = nativeImage.createFromBuffer(buffer, { width: size, height: size })
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '显示窗口', 
      click: () => {
        mainWindow?.show()
      }
    },
    { type: 'separator' },
    { 
      label: '退出', 
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('纲一下')
  tray.setContextMenu(contextMenu)

  // 单击托盘图标显示窗口
  tray.on('click', () => {
    mainWindow?.show()
  })
}

// ============ 窗口创建 ============

function createWindow() {
  // 加载窗口图标 - 使用正方形 PNG 格式
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev 
    ? join(__dirname, '..', 'src', 'assets', 'icon.png')
    : join(app.getAppPath(), 'src', 'assets', 'icon.png')
  
  const appIcon = nativeImage.createFromPath(iconPath)
  
  mainWindow = new BrowserWindow({
    width: 420,
    height: 850,
    resizable: false,
    maximizable: false,
    frame: false,
    transparent: false,
    icon: appIcon.isEmpty() ? undefined : appIcon,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  // 禁止双击标题栏最大化
  mainWindow.on('maximize', () => {
    mainWindow?.restore()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 打包后的路径处理
    const appPath = app.getAppPath()
    const indexPath = join(appPath, 'dist', 'index.html')
    
    // 尝试多个路径
    const possiblePaths = [
      indexPath,
      join(__dirname, '../dist/index.html'),
      join(appPath, 'index.html'),
      join(__dirname, '../../dist/index.html'),
    ]
    
    let loaded = false
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        mainWindow.loadFile(path)
        loaded = true
        break
      }
    }
    
    if (!loaded) {
      // 最后尝试使用 URL
      const fileUrl = `file://${join(appPath, 'dist', 'index.html')}`
      mainWindow.loadURL(fileUrl)
    }
  }
}

// ============ 应用生命周期 ============

app.whenReady().then(async () => {
  // 先获取认证信息
  await fetchAuthInfo()
  // 安装拦截器
  installWebRequestInterceptors()
  // 创建托盘
  createTray()
  // 创建窗口
  createWindow()
  // 设置自动更新
  setupAutoUpdater()
  // 启动时检查更新（延迟 3 秒）
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 3000)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:hide', () => {
  mainWindow?.hide()
})

// 选择文件夹
ipcMain.handle('selectFolder', async () => {
  if (!mainWindow) return null

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

// 下载音频/视频
ipcMain.handle('download', async (_event, url: string, filename: string, type: string = 'audio', savePath?: string, subFolder?: string) => {
  if (!mainWindow) return { success: false, error: '窗口未初始化' }

  try {
    const ext = type === 'video' ? '.mp4' : '.m4a'
    const safeName = filename.replace(/[<>:"/\\|?*]/g, '_') + ext
    const safeFolder = subFolder?.replace(/[<>:"/\\|?*]/g, '_')
    let filePath: string

    if (savePath) {
      // 使用默认路径
      let targetDir = savePath
      if (safeFolder) {
        targetDir = join(savePath, safeFolder)
        // 确保子文件夹存在
        const { mkdirSync, existsSync } = await import('fs')
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true })
        }
      }
      filePath = join(targetDir, safeName)
    } else {
      // 弹出保存对话框
      const filters = type === 'video' 
        ? [{ name: '视频文件', extensions: ['mp4', 'mkv', 'avi'] }]
        : [{ name: '音频文件', extensions: ['m4a', 'mp3', 'aac'] }]

      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: safeName,
        filters,
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: '用户取消' }
      }

      filePath = result.filePath
    }

    // 下载文件
    const response = await fetch(url, {
      headers: {
        'User-Agent': UserAgent,
        'Referer': 'https://www.bilibili.com',
        'Origin': 'https://www.bilibili.com',
      },
    })

    if (!response.ok || !response.body) {
      return { success: false, error: '下载失败' }
    }

    // 获取文件大小
    const contentLength = response.headers.get('content-length')
    const totalSize = contentLength ? parseInt(contentLength, 10) : 0

    // 保存文件并报告进度
    const fileStream = createWriteStream(filePath)
    let downloadedSize = 0

    const reader = response.body.getReader()
    
    // 发送初始进度
    mainWindow.webContents.send('download-progress', 0)

    while (true) {
      const { done, value } = await reader.read()
      
      if (done) break
      
      fileStream.write(value)
      downloadedSize += value.length
      
      // 计算并发送进度
      if (totalSize > 0) {
        const progress = Math.round((downloadedSize / totalSize) * 100)
        mainWindow.webContents.send('download-progress', progress)
      }
    }

    fileStream.end()
    
    // 发送完成进度
    mainWindow.webContents.send('download-progress', 100)

    return { success: true, path: filePath }
  } catch (error) {
    mainWindow?.webContents.send('download-progress', -1) // 表示错误
    return { success: false, error: String(error) }
  }
})

// ============ 更新相关 IPC ============

// 检查更新
ipcMain.handle('update:check', async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return { success: true, version: result?.updateInfo.version }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// 下载更新
ipcMain.handle('update:download', async () => {
  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
})

// 安装更新（退出并安装）
ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall(false, true)
})

// 获取当前版本
ipcMain.handle('app:version', () => {
  return app.getVersion()
})
