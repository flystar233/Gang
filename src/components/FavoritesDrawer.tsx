import { useFavoritesStore, type FavoriteItem } from '@/store/favorites'
import { usePlayerStore } from '@/store/player'
import { getProxiedImageUrl } from '@/api/bilibili'
import { formatDuration } from '@/utils/format'
import { Drawer } from './Drawer'

interface FavoritesDrawerProps {
  isOpen: boolean
  onClose: () => void
}

function FavoritesDrawer({ isOpen, onClose }: FavoritesDrawerProps) {
  const { favorites, removeFavorite } = useFavoritesStore()
  const { playlist, play } = usePlayerStore()

  const handlePlayFavorite = (favorite: FavoriteItem) => {
    const existingIndex = playlist.findIndex(item => item.bvid === favorite.bvid)
    if (existingIndex >= 0) {
      usePlayerStore.setState({ currentIndex: existingIndex })
      play()
    } else {
      const newPlaylist = [...playlist, favorite]
      const newIndex = newPlaylist.length - 1
      usePlayerStore.setState({ playlist: newPlaylist, currentIndex: newIndex })
      setTimeout(() => play(), 100)
    }
    onClose()
  }

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="收藏列表">
      {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/30">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4 opacity-50">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <p className="text-sm">暂无收藏</p>
            <p className="text-xs mt-2 text-white/20">在播放列表中点击心形图标收藏</p>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((favorite) => (
              <div
                key={favorite.bvid}
                onClick={() => handlePlayFavorite(favorite)}
                className="group flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 rounded-md overflow-hidden flex-shrink-0 bg-white/5">
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

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{favorite.title}</p>
                  <p className="text-xs text-white/30 mt-0.5">{formatDuration(favorite.duration)}</p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFavorite(favorite.bvid)
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-[#44965B] transition-colors"
                    title="取消收藏"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </Drawer>
  )
}

export default FavoritesDrawer

