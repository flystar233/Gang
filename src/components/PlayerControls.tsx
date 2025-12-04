import { useState, useRef, useCallback, useEffect } from 'react'
import { usePlayerStore } from '@/store/player'
import { useSettingsStore, type PlayMode } from '@/store/settings'

interface PlayerControlsProps {
  onOpenPlaylist?: () => void
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const playModeIcons: Record<PlayMode, string> = {
  sequence: '→',
  loop: '↻',
  single: '1',
  auto: '∞',
}

const playModeLabels: Record<PlayMode, string> = {
  sequence: '顺序',
  loop: '循环',
  single: '单曲',
  auto: '自动',
}

function PlayerControls({ onOpenPlaylist }: PlayerControlsProps) {
  const { isPlaying, togglePlay, next, prev, currentTime, duration, playlist, currentIndex, seek, gangDanKou, gangDuiKou, isLoading } = usePlayerStore()
  const { volume, setVolume, playMode, cyclePlayMode, isMuted, toggleMute } = useSettingsStore()
  const [isDragging, setIsDragging] = useState(false)
  const [dragProgress, setDragProgress] = useState(0)
  const [showVolume, setShowVolume] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const displayProgress = isDragging ? dragProgress : progress
  const currentItem = playlist[currentIndex]

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

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setDragProgress(calcProgress(e.clientX))
  }, [isDragging, calcProgress])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    setIsDragging(false)
    seek((calcProgress(e.clientX) / 100) * duration)
  }, [isDragging, calcProgress, duration, seek])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div className="bg-white/5 rounded-xl p-5 space-y-4">
      {/* 标题 */}
      <p className="text-sm text-white/80 text-center truncate px-2">
        {currentItem?.title || '暂无播放'}
      </p>

      {/* 进度条 */}
      <div className="space-y-1">
        <div 
          ref={progressRef}
          className="relative h-1 bg-white/10 rounded-full cursor-pointer group"
          onMouseDown={handleMouseDown}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[#44965B] rounded-full"
            style={{ width: `${displayProgress}%` }}
          />
          <div 
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow
                        ${isDragging ? 'scale-110' : 'scale-0 group-hover:scale-100'} transition-transform`}
            style={{ left: `calc(${displayProgress}% - 6px)` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/40">
          <span>{formatTime(isDragging ? (dragProgress / 100) * duration : currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Gang 按钮行 - Pill Outline 风格 */}
      <div className="grid grid-cols-2 gap-4 px-2 pt-2">
        <button
          onClick={gangDanKou}
          disabled={isLoading}
          className="group flex items-center justify-center gap-1.5 py-3 rounded-full
                     border border-white/20 hover:border-[#44965B] hover:bg-[#44965B]/10
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-300 select-none active:scale-95"
        >
          <span className="text-sm font-medium text-white/70 group-hover:text-[#44965B] transition-colors duration-300">Gang</span>
          <svg className="w-4 h-4 text-white/60 group-hover:text-[#44965B] transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        <button
          onClick={gangDuiKou}
          disabled={isLoading}
          className="group flex items-center justify-center gap-1.5 py-3 rounded-full
                     border border-white/20 hover:border-[#44965B] hover:bg-[#44965B]/10
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all duration-300 select-none active:scale-95"
        >
          <span className="text-sm font-medium text-white/70 group-hover:text-[#44965B] transition-colors duration-300">Gang</span>
          <svg className="w-4 h-4 text-white/60 group-hover:text-[#44965B] transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
      </div>

      {/* 控制 */}
      <div className="flex items-center justify-between relative pt-2">
        {/* 左侧：音量 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div 
            className="relative"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button 
              onClick={toggleMute}
              className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white/80"
            >
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
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-0.5 py-2 pr-2">
                <div className="relative w-12 h-1.5 bg-white/10 rounded-full">
                  <div 
                    className="absolute inset-y-0 left-0 bg-[#44965B] rounded-full"
                    style={{ width: `${volume * 100}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume * 100}
                    onChange={(e) => setVolume(Number(e.target.value) / 100)}
                    className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] opacity-0 cursor-pointer"
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow pointer-events-none"
                    style={{ left: `calc(${volume * 100}% - 6px)` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* 主控制 - 居中 */}
        <div className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2">
          <button
            onClick={prev}
            disabled={currentIndex <= 0}
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            disabled={playlist.length === 0}
            className="w-12 h-12 flex items-center justify-center rounded-full
                       bg-[#44965B] hover:bg-[#55A86C]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       active:scale-95 transition-all"
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" className="ml-0.5">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            )}
          </button>

          <button
            onClick={next}
            disabled={currentIndex >= playlist.length - 1}
            className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* 右侧：播放模式 + 播放列表 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 播放模式 */}
          <button
            onClick={cyclePlayMode}
            className="w-10 h-10 flex items-center justify-center rounded-lg
                       text-white/50 hover:text-white/80 hover:bg-white/5 text-base font-medium"
            title={playModeLabels[playMode]}
          >
            {playModeIcons[playMode]}
          </button>

          {/* 播放列表 */}
          <button 
            onClick={onOpenPlaylist}
            className="w-10 h-10 flex items-center justify-center rounded-lg
                       text-white/50 hover:text-white/80 hover:bg-white/5"
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
