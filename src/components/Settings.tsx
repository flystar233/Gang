import { useState } from 'react'
import { useSettingsStore } from '@/store/settings'
import { useFavoritesStore } from '@/store/favorites'
import { usePlayerStore } from '@/store/player'
import { getProxiedImageUrl } from '@/api/bilibili'

type TabType = 'settings' | 'favorites'

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
  } = useSettingsStore()
  const { favorites, removeFavorite } = useFavoritesStore()
  const { playlist } = usePlayerStore()
  const [activeTab, setActiveTab] = useState<TabType>('settings')

  if (!isSettingsOpen) return null

  const handleSelectPath = async () => {
    const result = await window.electronAPI?.selectFolder()
    if (result) {
      setDownloadPath(result)
    }
  }

  const handlePlayFavorite = (favorite: typeof favorites[0]) => {
    // 检查是否已在播放列表中
    const existingIndex = playlist.findIndex(item => item.bvid === favorite.bvid)
    if (existingIndex >= 0) {
      usePlayerStore.setState({ currentIndex: existingIndex })
      usePlayerStore.getState().play()
    } else {
      // 添加到播放列表并播放
      const newPlaylist = [...playlist, favorite]
      usePlayerStore.setState({ playlist: newPlaylist, currentIndex: newPlaylist.length - 1 })
      usePlayerStore.getState().play()
    }
    closeSettings()
  }

  function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={closeSettings}
      />
      
      {/* 设置面板 */}
      <div className="relative w-full max-w-[400px] max-h-[600px] bg-[#1a1a1f] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* 标题和标签页 */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-lg font-medium text-white">
              {activeTab === 'settings' ? '设置' : '收藏'}
            </h2>
            <button
              onClick={closeSettings}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                         hover:bg-white/10 text-white/40 hover:text-white 
                         transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 标签页切换 */}
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

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'settings' ? (
            <div className="p-5 space-y-5">
          {/* 关闭行为 */}
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

          {/* 下载路径 */}
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

          {/* 音频品质 */}
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
                    {/* 封面 */}
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

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{favorite.title}</p>
                      <p className="text-xs text-white/30 mt-0.5">{formatDuration(favorite.duration)}</p>
                    </div>

                    {/* 操作按钮 */}
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
