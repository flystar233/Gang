import { useState, useRef, useCallback, useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import { useSettingsStore, type PlayMode } from '@/store/settings'
import { useFavoritesStore } from '@/store/favorites'
import { isAndroid } from '@/utils/platform'
import { formatTime } from '@/utils/format'
import { GangTypeIcon } from '@/components/icons/GangTypeIcon'

// 检测是否是Windows平台
const isWindows = typeof navigator !== 'undefined' && /win/i.test(navigator.platform)

interface PlayerControlsProps {
  onOpenPlaylist?: () => void
  gangType?: 'dan' | 'dui'
  onGangTypeChange?: (type: 'dan' | 'dui') => void
}

const playModeIcons: Record<PlayMode, string> = {
  sequence: '→',
  loop: '↻',
  single: '1',
  auto: 'G',
}

const playModeLabels: Record<PlayMode, string> = {
  sequence: '顺序',
  loop: '循环',
  single: '单曲',
  auto: '自动',
}

type GangType = 'dan' | 'dui'

function PlayerControls({ onOpenPlaylist, gangType: _externalGangType, onGangTypeChange }: PlayerControlsProps) {
  const { isPlaying, togglePlay, next, prev, currentTime, duration, playlist, currentIndex, seek, gangDanKou, gangDuiKou, isLoading } = usePlayerStore()
  const { volume, setVolume, playMode, cyclePlayMode, isMuted, toggleMute, gangType: _storeGangType, setGangType } = useSettingsStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const [showVolume, setShowVolume] = useState(false)
  const [isDraggingVolume, setIsDraggingVolume] = useState(false)
  const [_internalGangType, setInternalGangType] = useState<GangType>('dan')
  const progressRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)
  const volumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gangButtonRef = useRef<HTMLDivElement>(null)
  
  const handleGangClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gangButtonRef.current || isLoading) return
    
    const rect = gangButtonRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const buttonWidth = rect.width
    const isLeftHalf = clickX < buttonWidth / 2
    
    if (isLeftHalf) {
      // 点击左边，单口
      const newType: GangType = 'dan'
      if (onGangTypeChange) {
        onGangTypeChange(newType)
      } else {
        setInternalGangType(newType)
        setGangType(newType)
      }
      gangDanKou()
    } else {
      // 点击右边，对口
      const newType: GangType = 'dui'
      if (onGangTypeChange) {
        onGangTypeChange(newType)
      } else {
        setInternalGangType(newType)
        setGangType(newType)
      }
      gangDuiKou()
    }
  }
  
  

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const displayProgress = isDragging ? dragProgress : progress
  const currentItem = playlist[currentIndex]
  const isCurrentFavorite = currentItem ? isFavorite(currentItem.bvid) : false
  
  const handleToggleFavorite = () => {
    if (currentItem) {
      toggleFavorite(currentItem, currentItem.audioUrl)
    }
  }

  const calcProgress = useCallback((clientX: number) => {
    if (!progressRef.current || duration <= 0) return 0
    const rect = progressRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    return Math.max(0, Math.min(100, (x / rect.width) * 100))
  }, [duration])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (duration <= 0) return
    e.preventDefault()
    setIsDragging(true)
    setDragProgress(calcProgress(e.clientX))
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (duration <= 0) return
    setIsDragging(true)
    setDragProgress(calcProgress(e.touches[0].clientX))
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setDragProgress(calcProgress(e.clientX))
  }, [isDragging, calcProgress])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return
    setDragProgress(calcProgress(e.touches[0].clientX))
    e.preventDefault()
  }, [isDragging, calcProgress])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    seek((calcProgress(e.clientX) / 100) * duration)
  }, [isDragging, calcProgress, duration, seek])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    const touch = e.changedTouches[0] || e.touches[0]
    seek((calcProgress(touch.clientX) / 100) * duration)
  }, [isDragging, calcProgress, duration, seek])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      window.addEventListener('touchmove', handleTouchMove, { passive: false })
      window.addEventListener('touchend', handleTouchEnd)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
        window.removeEventListener('touchmove', handleTouchMove)
        window.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  useEffect(() => {
    const handleVolumeMouseMove = (e: MouseEvent) => {
      if (!isDraggingVolume || !volumeRef.current) return
      const rect = volumeRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const percentage = 1 - (y / rect.height)
      setVolume(Math.max(0, Math.min(1, percentage)))
    }

    const handleVolumeMouseUp = () => {
      setIsDraggingVolume(false)
    }

    if (isDraggingVolume) {
      window.addEventListener('mousemove', handleVolumeMouseMove)
      window.addEventListener('mouseup', handleVolumeMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleVolumeMouseMove)
        window.removeEventListener('mouseup', handleVolumeMouseUp)
      }
    }
  }, [isDraggingVolume])

  useEffect(() => {
    return () => {
      if (volumeTimeoutRef.current) {
        clearTimeout(volumeTimeoutRef.current)
      }
    }
  }, [])

  const buttonBaseClass = "w-10 h-10 flex items-center justify-center rounded-lg text-white/50 hover:text-white/90 transition-all duration-200 active:scale-95"

  return (
    <div className={`bg-white/5 rounded-2xl ${isAndroid ? 'p-6 space-y-5' : 'p-5 space-y-4'}`}>
      <p className="text-sm text-white/80 text-center truncate px-2">
        {currentItem?.title || '暂无播放'}
      </p>

      <div className="space-y-1">
        <div 
          ref={progressRef}
          className="relative h-1.5 bg-white/10 rounded-full cursor-pointer group"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[#44965B] rounded-full"
            style={{ width: `${displayProgress}%` }}
          />
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow
                        ${isDragging ? 'scale-110' : 'scale-0 group-hover:scale-100'} transition-transform`}
            style={{ left: `calc(${displayProgress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40">
          <span>{formatTime(isDragging ? (dragProgress / 100) * duration : currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="relative flex items-center justify-center px-2 pt-2">
        <div
          ref={gangButtonRef}
          onClick={handleGangClick}
          className={`group relative flex items-center py-4 rounded-full bg-white/5 border-[3px] border-white/40 overflow-hidden select-none transition-all duration-300 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${isWindows ? 'hover:bg-white/10 hover:border-white/60' : ''}`}
          style={{ width: '280px' }}
        >
          {/* 左边背景 - 奶白色填满整个左边 */}
          <div className="absolute inset-y-0 left-0 w-1/2 bg-[#F0EDE5] rounded-l-full transition-all duration-300 group-hover:bg-[#F0EDE5]/95" />
          
          {/* 右边背景 - 主题色填满整个右边 */}
          <div className={`absolute inset-y-0 right-0 w-1/2 bg-[#44965B]/40 rounded-r-full transition-all duration-300 ${isWindows ? 'group-hover:bg-[#44965B]/50' : ''}`} />
          
          {/* 右边斜线纹理 - 45度斜线 */}
          <div 
            className="absolute inset-y-0 right-0 w-1/2 rounded-r-full pointer-events-none z-5"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0, 0, 0, 0.08) 2px, rgba(0, 0, 0, 0.08) 4px)'
            }}
          />
          
          {/* 左边 - 单口图标 */}
          <div
            className="relative z-10 w-1/2 flex items-center justify-center h-full transition-all duration-300"
          >
            <GangTypeIcon 
              type="dan" 
              className={`w-6 h-6 text-gray-900 select-none transition-all duration-300 ${
                isWindows ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
              }`}
            />
          </div>
          
          {/* 中间分割线 - 真实胶囊分割效果 */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 z-30">
            {/* 主分割线 - 深色细线，模拟胶囊中间的凹槽 */}
            <div className="absolute inset-y-0 left-0 w-[1px] bg-gray-500/50" />
            {/* 左侧内阴影 - 营造左侧凹陷感 */}
            <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-r from-black/15 to-transparent" />
            {/* 右侧内高光 - 营造右侧凸起感 */}
            <div className="absolute inset-y-0 right-0 w-[2px] bg-gradient-to-l from-white/25 to-transparent" />
          </div>
          
          {/* 右边 - 对口图标 */}
          <div
            className="relative z-10 w-1/2 flex items-center justify-center h-full transition-all duration-300"
          >
            <GangTypeIcon 
              type="dui" 
              className={`w-6 h-6 text-white select-none transition-all duration-300 ${
                isWindows ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'
              }`}
            />
          </div>
        </div>
      </div>
      <div className={`flex items-center justify-between relative ${isAndroid ? 'pt-3' : 'pt-2'}`}>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAndroid ? (
            <button
              onClick={cyclePlayMode}
              className={`${buttonBaseClass} text-base font-medium`}
              title={playModeLabels[playMode]}
            >
              {playModeIcons[playMode]}
            </button>
          ) : (
            <div className="relative flex items-center gap-3">
              <div
                className="relative"
                onMouseEnter={() => {
                  if (volumeTimeoutRef.current) {
                    clearTimeout(volumeTimeoutRef.current)
                    volumeTimeoutRef.current = null
                  }
                  setShowVolume(true)
                }}
                onMouseLeave={() => {
                  volumeTimeoutRef.current = setTimeout(() => {
                    setShowVolume(false)
                  }, 200)
                }}
              >
                <button onClick={toggleMute} className={buttonBaseClass}>
                {isMuted || volume === 0 ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    {volume > 0 && <path d="M15.54 8.46a5 5 0 010 7.07" />}
                    {volume > 0.5 && <path d="M19.07 4.93a10 10 0 010 14.14" />}
                  </svg>
                )}
              </button>
              
              {showVolume && (
                <div 
                  className="absolute left-0 bottom-full mb-0.5 px-2 py-2 z-20"
                  onMouseEnter={() => {
                    if (volumeTimeoutRef.current) {
                      clearTimeout(volumeTimeoutRef.current)
                      volumeTimeoutRef.current = null
                    }
                    setShowVolume(true)
                  }}
                  onMouseLeave={() => {
                    volumeTimeoutRef.current = setTimeout(() => {
                      setShowVolume(false)
                    }, 200)
                  }}
                >
                  <div 
                    ref={volumeRef}
                    className="relative h-16 w-1.5 bg-white/10 rounded-full cursor-pointer"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setIsDraggingVolume(true)
                      const rect = e.currentTarget.getBoundingClientRect()
                      const y = e.clientY - rect.top
                      const percentage = 1 - (y / rect.height)
                      setVolume(Math.max(0, Math.min(1, percentage)))
                    }}
                  >
                    <div 
                      className="absolute inset-x-0 bottom-0 bg-[#44965B] rounded-full"
                      style={{ height: `${volume * 100}%` }}
                    />
                    <div 
                      className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none"
                      style={{ bottom: `calc(${volume * 100}% - 6px)` }}
                    />
                  </div>
                </div>
              )}
              </div>
              
              {/* Windows系统下的收藏按钮 */}
              {isWindows && (
                <button
                  onClick={handleToggleFavorite}
                  disabled={!currentItem}
                  className={`${buttonBaseClass} ${
                    isCurrentFavorite 
                      ? 'text-red-500 hover:text-red-400 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]' 
                      : ''
                  } disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200`}
                  title={isCurrentFavorite ? '取消收藏' : '收藏'}
                >
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill={isCurrentFavorite ? '#ef4444' : 'none'} 
                    stroke={isCurrentFavorite ? '#ef4444' : 'currentColor'} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className={isCurrentFavorite ? 'transition-all duration-200' : ''}
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              )}
              
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
          <button
            onClick={prev}
            disabled={currentIndex <= 0}
            className={`${buttonBaseClass} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            disabled={playlist.length === 0}
            className="w-14 h-14 flex items-center justify-center rounded-lg
                       disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-95 transition-all duration-200"
          >
            {isPlaying ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-white/90 pointer-events-none">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-white/90 ml-1 pointer-events-none">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
            disabled={currentIndex >= playlist.length - 1}
            className={`${buttonBaseClass} disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {!isAndroid && (
            <button
              onClick={cyclePlayMode}
              className={`${buttonBaseClass} text-base font-medium`}
              title={playModeLabels[playMode]}
            >
              {playModeIcons[playMode]}
            </button>
          )}

          <button 
            onClick={onOpenPlaylist}
            className={buttonBaseClass}
            title="播放列表"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default PlayerControls
