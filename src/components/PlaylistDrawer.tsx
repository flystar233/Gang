import { useEffect, useRef } from 'react'
import Playlist from './Playlist'

interface PlaylistDrawerProps {
  isOpen: boolean
  onClose: () => void
}

function PlaylistDrawer({ isOpen, onClose }: PlaylistDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      // 延迟添加事件监听，避免立即触发关闭
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 100)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, onClose])

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300
                    ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 抽屉 */}
      <div
        ref={drawerRef}
        className={`fixed left-0 right-0 bottom-0 z-50 
                    bg-gradient-to-t from-[#0d0d12] via-[#0d0d12] to-[#0d0d12]/95
                    rounded-t-3xl shadow-2xl shadow-black/50
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '75vh', maxHeight: 'calc(100vh - 40px)' }}
      >
        {/* 拖拽指示器 */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="text-lg font-semibold text-white/90">播放列表</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full
                       text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* 播放列表内容 */}
        <div className="flex-1 overflow-hidden px-4 pb-6" style={{ height: 'calc(100% - 60px)' }}>
          <Playlist />
        </div>
      </div>
    </>
  )
}

export default PlaylistDrawer

