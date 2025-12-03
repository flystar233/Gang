import { useState, useEffect } from 'react'
import { usePlayerStore } from '../store/player'
import { useSettingsStore } from '../store/settings'
import { useFavoritesStore } from '../store/favorites'
import { getProxiedImageUrl } from '../api/bilibili'
import logoImage from '../assets/guodegang.svg'
import backImage from '../assets/back.jpg'

// 郭德纲经典语录
const DING_CHANG_SHI = [
  '床前明月光，疑是地上霜，举头望明月，我叫郭德纲',
  '江山父老能容我，不使人间造孽钱',
  '于谦老师三大爱好：抽烟、喝酒、烫头',
  '你无耻的样子颇有我年轻时的神韵',
  '高雅不是装出来的，孙子才是装出来的',
  '要想人前显贵，必要人后遭罪',
  '说得不好观众骂街，说得好了同行骂街',
  '天儿也不早了，人也不少了，鸡也不叫了，狗也不咬了',
  '心中有事天地小，心中无事一床宽',
  '万事留一线，江湖好相见',
]

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function Playlist() {
  const { playlist, currentIndex, removeFromPlaylist } = usePlayerStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [poem, setPoem] = useState('')
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  useEffect(() => {
    if (playlist.length === 0) {
      setPoem(DING_CHANG_SHI[Math.floor(Math.random() * DING_CHANG_SHI.length)])
    }
  }, [playlist.length])

  // 监听下载进度
  useEffect(() => {
    const unsubscribe = window.electronAPI?.onDownloadProgress((progress) => {
      setDownloadProgress(progress)
      if (progress >= 100 || progress < 0) {
        // 下载完成或出错，延迟重置状态
        setTimeout(() => {
          setDownloadingIndex(null)
          setDownloadProgress(0)
        }, 500)
      }
    })
    return () => unsubscribe?.()
  }, [])

  const handleDownload = async (index: number, audioUrl: string, title: string) => {
    if (downloadingIndex !== null) return // 防止重复下载
    
    setDownloadingIndex(index)
    setDownloadProgress(0)
    
    const { downloadPath } = useSettingsStore.getState()
    
    await window.electronAPI?.download(
      audioUrl, 
      title, 
      'audio',
      downloadPath || undefined
    )
  }

  if (playlist.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/30 px-6">
        <img src={logoImage} alt="logo" className="w-20 h-20 opacity-50 mb-4" />
        <p className="text-sm text-center leading-relaxed">{poem}</p>
        <p className="text-xs mt-4 text-white/20">点击 Gang！一下</p>
      </div>
    )
  }

  return (
    <div 
      className="h-full overflow-y-auto space-y-1 relative rounded-lg"
      style={{
        backgroundImage: `url(${backImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-[#0d0d12]/95 rounded-lg" />
      
      {/* 列表内容 */}
      <div className="relative z-10 p-1">
      {playlist.map((item, index) => {
        const isActive = index === currentIndex
        const isDownloading = downloadingIndex === index
        
        return (
          <div
            key={`${item.bvid}-${index}`}
            className={`group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors relative
                        ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
            onClick={() => {
              if (!isActive) {
                usePlayerStore.setState({ currentIndex: index })
                usePlayerStore.getState().play()
              }
            }}
          >
            {/* 下载进度条 */}
            {isDownloading && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#44965B] transition-all duration-200"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}

            {/* 封面 */}
            <div className="relative w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
              <img
                src={getProxiedImageUrl(item.pic)}
                alt={item.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
              {isDownloading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-[10px] text-white font-medium">{downloadProgress}%</span>
                </div>
              )}
            </div>

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${isActive ? 'text-[#44965B]' : 'text-white/80'}`}>
                {item.title}
              </p>
              <p className={`mt-0.5 ${isDownloading ? 'text-sm text-[#44965B] font-medium' : 'text-xs text-white/30'}`}>
                {isDownloading ? `下载中 ${downloadProgress}%` : formatDuration(item.duration)}
              </p>
            </div>

            {/* 收藏按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFavorite(item, item.audioUrl)
              }}
              className={`w-6 h-6 flex items-center justify-center rounded transition-all
                         ${isFavorite(item.bvid)
                           ? 'opacity-100 text-red-500'
                           : 'opacity-0 group-hover:opacity-100 hover:bg-white/20 text-white/80 hover:text-white'}`}
              title={isFavorite(item.bvid) ? '取消收藏' : '收藏'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill={isFavorite(item.bvid) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>

            {/* 下载按钮 */}
            {item.audioUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload(index, item.audioUrl!, item.title)
                }}
                disabled={downloadingIndex !== null}
                className={`w-6 h-6 flex items-center justify-center rounded transition-all
                           ${isDownloading 
                             ? 'opacity-100 text-[#44965B]' 
                             : 'opacity-0 group-hover:opacity-100 hover:bg-white/20 text-white/80 hover:text-white'}
                           ${downloadingIndex !== null && !isDownloading ? 'cursor-not-allowed' : ''}`}
                title={isDownloading ? `下载中 ${downloadProgress}%` : '下载'}
              >
                {isDownloading ? (
                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
              </button>
            )}

            {/* 删除按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeFromPlaylist(index)
              }}
              className="w-6 h-6 flex items-center justify-center rounded
                         opacity-0 group-hover:opacity-100 
                         hover:bg-white/20 text-white/80 hover:text-white
                         transition-all"
              title="删除"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )
      })}
      </div>
    </div>
  )
}

export default Playlist
