import { useState, useEffect } from 'react'
import TitleBar from '@/components/TitleBar'
import PlayerControls from '@/components/PlayerControls'
import PlaylistDrawer from '@/components/PlaylistDrawer'
import FavoritesDrawer from '@/components/FavoritesDrawer'
import Settings from '@/components/Settings'
import Toast from '@/components/Toast'
import { usePlayerStore } from '@/store/player'
import { useFavoritesStore } from '@/store/favorites'
import { useSettingsStore } from '@/store/settings'
import { isAndroid, platformAPI, isTauri } from '@/utils/platform'
import backImage from '@/assets/back.jpg'

function App() {
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false)
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false)
  const gangType = useSettingsStore((state) => state.gangType)
  const setGangType = useSettingsStore((state) => state.setGangType)
  const closeAction = useSettingsStore((state) => state.closeAction)
  const isPlaying = usePlayerStore((state) => state.isPlaying)
  const { playlist, currentIndex } = usePlayerStore()
  const { isFavorite, toggleFavorite } = useFavoritesStore()
  
  const currentItem = playlist[currentIndex]
  const isCurrentFavorite = currentItem ? isFavorite(currentItem.bvid) : false

  // 应用启动时，同步 closeAction 到后端
  useEffect(() => {
    if (isTauri && platformAPI.setCloseAction) {
      platformAPI.setCloseAction(closeAction).catch(() => {
        // 忽略错误
      })
    }
  }, []) // 只在启动时执行一次
  
  const handleToggleFavorite = () => {
    if (currentItem) {
      toggleFavorite(currentItem, currentItem.audioUrl)
    }
  }
  

  const recordGrooves = [
    'inset-1', 'inset-2', 'inset-3', 'inset-4', 'inset-5', 'inset-6'
  ]


  return (
    <div className="h-screen w-full flex flex-col bg-[#0d0d12]">
      <TitleBar />
      
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        <div className="relative">
          <div 
            className="relative w-56 h-56 rounded-full shadow-2xl shadow-black/50 animate-spin-slow bg-black border border-white/10"
            style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
          >
            {recordGrooves.map((inset, i) => (
              <div key={i} className={`absolute ${inset} rounded-full border border-white/5`} />
            ))}
            <div 
              className="absolute inset-7 rounded-full overflow-hidden border-2 border-white/10"
              style={{
                backgroundImage: `url(${backImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-black/40" />
            </div>
          </div>
          
          <div 
            className="absolute -top-8 -right-10 origin-top transition-transform duration-500 ease-out"
            style={{ transform: isPlaying ? 'rotate(24deg)' : 'rotate(-5deg)' }}
          >
            <div className="absolute -top-2 -left-2 w-11 h-11 rounded-full bg-gradient-to-br from-[#4a4a50] to-[#2a2a30] shadow-xl shadow-black/70" />
            <div className="absolute -top-0.5 -left-0.5 w-8 h-8 rounded-full bg-gradient-to-br from-[#6a6a70] to-[#3a3a40]" />
            <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-[#8a8a90] to-[#5a5a60] shadow-inner">
              <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-white/40" />
            </div>
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-2 h-[108px] bg-gradient-to-b from-[#a0a0a8] to-[#606068] rounded-full shadow-md" />
            <div 
              className="absolute top-[120px] left-1/2 origin-top"
              style={{ transform: 'translateX(-50%) rotate(-35deg)' }}
            >
              <div className="w-1.5 h-7 bg-gradient-to-b from-[#909098] to-[#505058] rounded-full shadow-md" />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-3.5 h-4 bg-gradient-to-b from-[#707078] to-[#404048] border border-white/20 rounded-sm" />
              <div className="absolute top-[38px] left-1/2 -translate-x-1/2 w-1 h-2 bg-[#44965B] rounded-b-full shadow-sm shadow-[#44965B]/50" />
            </div>
          </div>
        </div>
      </div>
      
      <div className="px-4 pb-4 space-y-3">
        {isAndroid && (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setIsFavoritesOpen(true)}
              className="w-12 h-12 flex items-center justify-center rounded-lg text-white/50 hover:text-white/90 transition-all duration-200 active:scale-95"
              title="收藏列表"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>


            <button
              onClick={handleToggleFavorite}
              disabled={!currentItem}
              className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200 active:scale-95 ${
                isCurrentFavorite ? 'text-red-400 hover:text-red-300' : 'text-white/50 hover:text-white/90'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={isCurrentFavorite ? '取消收藏' : '收藏'}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill={isCurrentFavorite ? 'currentColor' : 'none'} 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          </div>
        )}

        <PlayerControls 
          onOpenPlaylist={() => setIsPlaylistOpen(true)}
          gangType={gangType}
          onGangTypeChange={setGangType}
        />
      </div>

      <PlaylistDrawer isOpen={isPlaylistOpen} onClose={() => setIsPlaylistOpen(false)} />
      <FavoritesDrawer isOpen={isFavoritesOpen} onClose={() => setIsFavoritesOpen(false)} />
      <Settings />
      <Toast />
    </div>
  )
}

export default App
