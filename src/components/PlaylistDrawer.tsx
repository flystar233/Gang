import Playlist from './Playlist'
import { Drawer } from './Drawer'

interface PlaylistDrawerProps {
  isOpen: boolean
  onClose: () => void
}

function PlaylistDrawer({ isOpen, onClose }: PlaylistDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="播放列表">
      <Playlist />
    </Drawer>
  )
}

export default PlaylistDrawer
