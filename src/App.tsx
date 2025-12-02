import TitleBar from './components/TitleBar'
import Playlist from './components/Playlist'
import PlayerControls from './components/PlayerControls'
import Settings from './components/Settings'

function App() {
  return (
    <div className="h-screen w-full flex flex-col bg-[#0d0d12]">
      {/* 标题栏 */}
      <TitleBar />
      
      {/* 播放列表 */}
      <div className="flex-1 overflow-hidden px-4 pt-4 pb-3">
        <Playlist />
      </div>
      
      {/* 播放控制 */}
      <div className="px-4 pb-4">
        <PlayerControls />
      </div>

      {/* 设置面板 */}
      <Settings />
    </div>
  )
}

export default App
