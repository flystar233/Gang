import { useState } from 'react'
import { useSettingsStore } from '../store/settings'
import { getAudioElement } from '../store/player'
import AudioWaveform from './AudioWaveform'
import logoImage from '../assets/guodegang.svg'

function TitleBar() {
  const { toggleSettings } = useSettingsStore()
  const [showWaveform, setShowWaveform] = useState(false)

  const handleMinimize = () => {
    window.electronAPI?.minimize()
  }

  const handleClose = () => {
    const { closeAction } = useSettingsStore.getState()
    if (closeAction === 'hide') {
      window.electronAPI?.hide()
    } else {
      window.electronAPI?.close()
    }
  }

  return (
    <div 
      className="h-14 flex items-center justify-between px-4" 
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Logo 和标题 */}
      <div 
        className="flex items-center gap-3 cursor-pointer"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        onClick={() => setShowWaveform(!showWaveform)}
      >
        {showWaveform ? (
          <div className="h-10 flex items-end">
            <AudioWaveform 
              audioElement={getAudioElement()} 
              width={100} 
              height={36}
              barCount={20}
              barColor="#44965B"
            />
          </div>
        ) : (
          <>
            <div className="relative w-10 h-10 flex items-end justify-center">
              <img 
                src={logoImage} 
                alt="logo" 
                className="w-full h-full object-cover rounded-lg hover:scale-110 transition-transform" 
              />
            </div>
            <span className="text-sm font-semibold text-white/90 tracking-wide">纲一下</span>
          </>
        )}
      </div>

      {/* 控制按钮 */}
      <div 
        className="flex items-center gap-1" 
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* 设置按钮 */}
        <button
          onClick={toggleSettings}
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     text-white/40 hover:text-white/80 hover:bg-white/5
                     transition-all duration-200"
          title="设置"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        {/* 最小化 */}
        <button
          onClick={handleMinimize}
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     text-white/40 hover:text-white/80 hover:bg-white/5
                     transition-all duration-200"
          title="最小化"
        >
          <svg width="12" height="2" viewBox="0 0 12 2" fill="currentColor">
            <rect width="12" height="2" rx="1" />
          </svg>
        </button>

        {/* 关闭 */}
        <button
          onClick={handleClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg
                     text-white/40 hover:text-white hover:bg-red-500/80
                     transition-all duration-200"
          title="关闭"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
