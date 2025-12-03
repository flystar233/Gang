import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type VideoItem } from '@/api/bilibili'

export interface FavoriteItem extends VideoItem {
  audioUrl?: string
  addedAt: number // 添加时间戳
}

interface FavoritesState {
  favorites: FavoriteItem[]
}

interface FavoritesActions {
  addFavorite: (item: VideoItem, audioUrl?: string) => void
  removeFavorite: (bvid: string) => void
  isFavorite: (bvid: string) => boolean
  toggleFavorite: (item: VideoItem, audioUrl?: string) => void
}

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set, get) => ({
      favorites: [],

      addFavorite: (item, audioUrl) => {
        const { favorites } = get()
        // 检查是否已存在
        if (favorites.some(f => f.bvid === item.bvid)) {
          return
        }
        const newFavorite: FavoriteItem = {
          ...item,
          audioUrl,
          addedAt: Date.now(),
        }
        set({ favorites: [...favorites, newFavorite] })
      },

      removeFavorite: (bvid) => {
        const { favorites } = get()
        set({ favorites: favorites.filter(f => f.bvid !== bvid) })
      },

      isFavorite: (bvid) => {
        const { favorites } = get()
        return favorites.some(f => f.bvid === bvid)
      },

      toggleFavorite: (item, audioUrl) => {
        const { isFavorite, addFavorite, removeFavorite } = get()
        if (isFavorite(item.bvid)) {
          removeFavorite(item.bvid)
        } else {
          addFavorite(item, audioUrl)
        }
      },
    }),
    {
      name: 'gang-yi-xia-favorites',
    }
  )
)

