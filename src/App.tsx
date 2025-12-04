import { useState } from 'react'
import TitleBar from '@/components/TitleBar'
import PlayerControls from '@/components/PlayerControls'
import PlaylistDrawer from '@/components/PlaylistDrawer'
import Settings from '@/components/Settings'
import Toast from '@/components/Toast'
import { usePlayerStore } from '@/store/player'
import backImage from '@/assets/back.jpg'

function App() {
  const [isPlaylistOpen, setIsPlaylistOpen] = useState(false)
  const isPlaying = usePlayerStore((state) => state.isPlaying)

  return (
    <div className="h-screen w-full flex flex-col bg-[#0d0d12]">
      {/* 标题栏 */}
      <TitleBar />
      
      {/* 主内容区域 */}
      <div className="flex-1 overflow-hidden flex items-center justify-center">
        <div className="relative">
          {/* 旋转唱片 */}
          <div 
            className="relative w-56 h-56 rounded-full shadow-2xl shadow-black/50 animate-spin-slow
                       bg-black border border-white/10"
            style={{
              animationPlayState: isPlaying ? 'running' : 'paused',
            }}
          >
            {/* 唱片纹路 */}
            <div className="absolute inset-1 rounded-full border border-white/5" />
            <div className="absolute inset-2 rounded-full border border-white/5" />
            <div className="absolute inset-3 rounded-full border border-white/5" />
            <div className="absolute inset-4 rounded-full border border-white/5" />
            <div className="absolute inset-5 rounded-full border border-white/5" />
            <div className="absolute inset-6 rounded-full border border-white/5" />
            
            {/* 中心标签区域 */}
            <div 
              className="absolute inset-7 rounded-full overflow-hidden border-2 border-white/10"
              style={{
                backgroundImage: `url(${backImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {/* 暗色遮罩 */}
              <div className="absolute inset-0 bg-black/40" />
            </div>
          </div>
          
          {/* 播放针 */}
          <div 
            className="absolute -top-8 -right-10 origin-top transition-transform duration-500 ease-out"
            style={{
              transform: isPlaying ? 'rotate(24deg)' : 'rotate(-20deg)',
            }}
          >
            {/* 底座外圈 */}
            <div className="absolute -top-2 -left-2 w-11 h-11 rounded-full bg-gradient-to-br from-[#4a4a50] to-[#2a2a30] shadow-xl shadow-black/70" />
            {/* 底座中圈 */}
            <div className="absolute -top-0.5 -left-0.5 w-8 h-8 rounded-full bg-gradient-to-br from-[#6a6a70] to-[#3a3a40]" />
            {/* 针座（轴心） */}
            <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-[#8a8a90] to-[#5a5a60] shadow-inner">
              {/* 轴心高光 */}
              <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-white/40" />
            </div>
            {/* 主针臂 */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-2 h-[108px] bg-gradient-to-b from-[#a0a0a8] to-[#606068] rounded-full shadow-md" />
            {/* 弯折部分 */}
            <div 
              className="absolute top-[120px] left-1/2 origin-top"
              style={{ transform: 'translateX(-50%) rotate(-35deg)' }}
            >
              {/* 弯折臂 */}
              <div className="w-1.5 h-7 bg-gradient-to-b from-[#909098] to-[#505058] rounded-full shadow-md" />
              {/* 针头座 */}
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-3.5 h-4 bg-gradient-to-b from-[#707078] to-[#404048] border border-white/20 rounded-sm" />
              {/* 针头 */}
              <div className="absolute top-[38px] left-1/2 -translate-x-1/2 w-1 h-2 bg-[#44965B] rounded-b-full shadow-sm shadow-[#44965B]/50" />
            </div>
          </div>
        </div>
      </div>
      
      {/* 播放控制 */}
      <div className="px-4 pb-4">
        <PlayerControls onOpenPlaylist={() => setIsPlaylistOpen(true)} />
      </div>

      {/* 播放列表抽屉 */}
      <PlaylistDrawer 
        isOpen={isPlaylistOpen} 
        onClose={() => setIsPlaylistOpen(false)} 
      />

      {/* 设置面板 */}
      <Settings />

      {/* Toast 提示 */}
      <Toast />
    </div>
  )
}

export default App
