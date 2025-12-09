import { useState, useEffect } from 'react'
import { useSettingsStore } from '@/store/settings'
import { useFavoritesStore } from '@/store/favorites'
import { usePlayerStore } from '@/store/player'
import { getProxiedImageUrl } from '@/api/bilibili'
import { platformAPI } from '@/utils/platform'
import { formatDuration } from '@/utils/format'

type TabType = 'settings' | 'favorites'
type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | 'up-to-date'

function Settings() {
  const {
    isSettingsOpen,
    closeSettings,
    downloadPath,
    setDownloadPath,
    closeAction,
    setCloseAction,
    audioQuality,
    setAudioQuality,
    sleepTimerDeadline,
    setSleepTimer,
  } = useSettingsStore()
  const { favorites, removeFavorite } = useFavoritesStore()
  const { playlist } = usePlayerStore()
  const [activeTab, setActiveTab] = useState<TabType>('settings')
  const [currentVersion, setCurrentVersion] = useState('')
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [downloadPercent, setDownloadPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [sleepRemaining, setSleepRemaining] = useState(0)

  // 获取当前版本
  useEffect(() => {
    if (platformAPI.getVersion) {
      platformAPI.getVersion().then(setCurrentVersion)
    } else {
      setCurrentVersion('1.0.0')
    }
  }, [])

  useEffect(() => {
    if (!platformAPI.onUpdateStatus) return
    const unsubscribe = platformAPI.onUpdateStatus((status) => {
      switch (status.status) {
        case 'checking':
          setUpdateState('checking')
          break
        case 'available':
          setUpdateState('available')
          setUpdateVersion(status.version || '')
          break
        case 'not-available':
          setUpdateState('up-to-date')
          break
        case 'downloading':
          setUpdateState('downloading')
          setDownloadPercent(status.percent || 0)
          break
        case 'downloaded':
          setUpdateState('downloaded')
          break
        case 'error':
          setUpdateState('error')
          setErrorMessage(status.message || '未知错误')
          break
      }
    })
    return () => unsubscribe()
  }, [])

  // 睡眠定时倒计时
  useEffect(() => {
    const timer = setInterval(() => {
      if (sleepTimerDeadline) {
        const diff = Math.max(0, sleepTimerDeadline - Date.now())
        setSleepRemaining(diff)
      } else {
        setSleepRemaining(0)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [sleepTimerDeadline])

  const handleCheckUpdate = async () => {
    if (!platformAPI.checkForUpdate) return
    setUpdateState('checking')
    setErrorMessage('')
    await platformAPI.checkForUpdate()
  }

  const handleDownloadUpdate = async () => {
    if (!platformAPI.downloadUpdate) return
    setUpdateState('downloading')
    await platformAPI.downloadUpdate()
  }

  const handleInstallUpdate = () => {
    if (platformAPI.installUpdate) {
      platformAPI.installUpdate()
    }
  }

  if (!isSettingsOpen) return null

  const handleSelectPath = async () => {
    const result = await platformAPI.selectFolder()
    if (result) {
      setDownloadPath(result)
    }
  }

  const handlePlayFavorite = (favorite: typeof favorites[0]) => {
    const existingIndex = playlist.findIndex(item => item.bvid === favorite.bvid)
    if (existingIndex >= 0) {
      usePlayerStore.setState({ currentIndex: existingIndex })
      usePlayerStore.getState().play()
    } else {
      const newPlaylist = [...playlist, favorite]
      usePlayerStore.setState({ playlist: newPlaylist, currentIndex: newPlaylist.length - 1 })
      usePlayerStore.getState().play()
    }
    closeSettings()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeSettings}
      />
      
      <div className="relative w-full max-w-[400px] max-h-[600px] bg-[#1a1a1f] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-lg font-medium text-white">
              {activeTab === 'settings' ? '设置' : '收藏'}
            </h2>
            <button
              onClick={closeSettings}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex border-b border-white/5">
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors
                         ${activeTab === 'settings'
                           ? 'text-[#44965B] border-b-2 border-[#44965B]'
                           : 'text-white/50 hover:text-white/80'}`}
            >
              设置
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors relative
                         ${activeTab === 'favorites'
                           ? 'text-[#44965B] border-b-2 border-[#44965B]'
                           : 'text-white/50 hover:text-white/80'}`}
            >
              收藏
              {favorites.length > 0 && (
                <span className="absolute top-1 right-4 px-1.5 py-0.5 text-[10px] bg-[#44965B] text-white rounded-full">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="p-5 space-y-5">
          <div className="space-y-2">
            <label className="text-sm text-white/60">点击关闭按钮时</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCloseAction('quit')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                           ${closeAction === 'quit' 
                             ? 'bg-[#44965B] text-white' 
                             : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                退出程序
              </button>
              <button
                onClick={() => setCloseAction('hide')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                           ${closeAction === 'hide' 
                             ? 'bg-[#44965B] text-white' 
                             : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                最小化到托盘
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/60">默认保存位置</label>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-white/5 rounded-lg text-sm text-white/70 truncate">
                {downloadPath || '未设置（每次询问）'}
              </div>
              <button
                onClick={handleSelectPath}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg 
                           text-sm text-white/70 transition-colors"
              >
                选择
              </button>
            </div>
            {downloadPath && (
              <button
                onClick={() => setDownloadPath('')}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                清除默认路径
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/60">音频品质</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAudioQuality('high')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                           ${audioQuality === 'high' 
                             ? 'bg-[#44965B] text-white' 
                             : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                高 192k
              </button>
              <button
                onClick={() => setAudioQuality('medium')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                           ${audioQuality === 'medium' 
                             ? 'bg-[#44965B] text-white' 
                             : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                中 132k
              </button>
              <button
                onClick={() => setAudioQuality('low')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
                           ${audioQuality === 'low' 
                             ? 'bg-[#44965B] text-white' 
                             : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                低 64k
              </button>
            </div>
            <p className="text-xs text-white/30">
              {audioQuality === 'high' ? '最佳音质，文件较大' : 
               audioQuality === 'medium' ? '平衡音质与大小' : '节省流量，文件最小'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/60">睡眠定时</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSleepTimer(null)}
                className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-sm font-medium transition-colors
                           ${!sleepTimerDeadline 
                             ? 'bg-[#44965B] text-white' 
                             : 'bg-white/5 text-white/50 hover:bg-white/10'}`}
              >
                关闭
              </button>
              {[15, 30, 60].map((m) => {
                const isActive = !!sleepTimerDeadline && Math.abs(sleepTimerDeadline - (Date.now() + m * 60 * 1000)) < 2000
                return (
                <button
                  key={m}
                  onClick={() => setSleepTimer(m)}
                  className={`flex-1 min-w-[80px] py-2.5 rounded-lg text-sm font-medium transition-colors
                             ${isActive ? 'bg-[#44965B] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                >
                  {m} 分
                </button>
                )
              })}
            </div>
            <p className="text-xs text-white/30">
              {sleepTimerDeadline && sleepRemaining > 0
                ? `剩余 ${formatDuration(Math.ceil(sleepRemaining / 1000))}`
                : '未开启'}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-white/60">版本更新</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-white/5 rounded-lg text-sm text-white/70">
                当前版本：v{currentVersion || '...'}
              </div>
              {updateState === 'idle' && (
                <button
                  onClick={handleCheckUpdate}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-lg 
                             text-sm text-white/70 transition-colors"
                >
                  检查更新
                </button>
              )}
              {updateState === 'checking' && (
                <div className="px-4 py-2.5 text-sm text-white/50">
                  检查中...
                </div>
              )}
              {updateState === 'up-to-date' && (
                <div className="px-4 py-2.5 text-sm text-[#44965B]">
                  已是最新
                </div>
              )}
              {updateState === 'available' && (
                <button
                  onClick={handleDownloadUpdate}
                  className="px-4 py-2.5 bg-[#44965B] hover:bg-[#3d8a52] rounded-lg 
                             text-sm text-white transition-colors"
                >
                  下载 v{updateVersion}
                </button>
              )}
              {updateState === 'downloading' && (
                <div className="px-4 py-2.5 text-sm text-[#44965B]">
                  下载中 {downloadPercent}%
                </div>
              )}
              {updateState === 'downloaded' && (
                <button
                  onClick={handleInstallUpdate}
                  className="px-4 py-2.5 bg-[#44965B] hover:bg-[#3d8a52] rounded-lg 
                             text-sm text-white transition-colors"
                >
                  立即安装
                </button>
              )}
              {updateState === 'error' && (
                <button
                  onClick={handleCheckUpdate}
                  className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg 
                             text-sm text-red-400 transition-colors"
                >
                  重试
                </button>
              )}
            </div>
            {updateState === 'error' && (
              <p className="text-xs text-red-400/70">
                {errorMessage.includes('404') || errorMessage.includes('No published versions') 
                  ? '暂无可用更新（尚未发布新版本）' 
                  : errorMessage.includes('net::') || errorMessage.includes('ENOTFOUND')
                    ? '网络连接失败，请检查网络'
                    : `更新失败: ${errorMessage}`}
              </p>
            )}
          </div>
        </div>
          ) : (
            <div className="p-4 space-y-2">
              {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/30">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4 opacity-50">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                  <p className="text-sm">暂无收藏</p>
                  <p className="text-xs mt-2 text-white/20">在播放列表中点击心形图标收藏</p>
                </div>
              ) : (
                favorites.map((favorite) => (
                  <div
                    key={favorite.bvid}
                    onClick={() => handlePlayFavorite(favorite)}
                    className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
                      <img
                        src={getProxiedImageUrl(favorite.pic)}
                        alt={favorite.title}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{favorite.title}</p>
                      <p className="text-xs text-white/30 mt-0.5">{formatDuration(favorite.duration)}</p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          removeFavorite(favorite.bvid)
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg
                                   hover:bg-white/10 text-white/50 hover:text-[#44965B]
                                   transition-colors"
                        title="取消收藏"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Settings
