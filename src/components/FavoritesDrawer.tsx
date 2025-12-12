import { useFavoritesStore, type FavoriteItem } from '@/store/favorites'
import { usePlayerStore } from '@/store/player'
import { getProxiedImageUrl, getAudioUrl, proxyAudioUrl, getVideoInfo } from '@/api/bilibili'
import { formatDuration } from '@/utils/format'
import type { PlayItem } from '@/types'
import { Drawer } from './Drawer'
import { isTauri, isAndroid } from '@/utils/platform'
import { useEffect } from 'react'

// 简单延时
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface FavoritesDrawerProps {
  isOpen: boolean
  onClose: () => void
}

// 重新获取收藏音频的可播放地址，避免重启后旧端口或签名失效
// 同时兼容老数据（可能缺少 cid，或保存了旧代理端口）。
async function resolveFavoriteAudio(favorite: FavoriteItem): Promise<PlayItem | null> {
  // 始终优先用最新接口获取音频 URL，避免沿用旧代理端口/签名
  try {
    const cid = favorite.cid || (await getVideoInfo(favorite.bvid))?.pages?.[0]?.cid || (await getVideoInfo(favorite.bvid))?.cid
    if (cid) {
      const audioInfo = await getAudioUrl(favorite.bvid, cid)
      if (audioInfo?.url) {
        return { ...favorite, cid, audioUrl: audioInfo.url, audioBitrate: audioInfo.bitrate }
      }
    }
  } catch (error) {
    console.error('[Favorites] 通过接口获取音频失败', error)
  }

  // 兜底：尝试对收藏里存的原始 URL 重新代理（解码 /proxy/ 里的原始 URL）
  if (favorite.audioUrl) {
    const encoded = favorite.audioUrl.includes('/proxy/') ? favorite.audioUrl.split('/proxy/')[1] : undefined
    const originalUrl = encoded ? decodeURIComponent(encoded) : favorite.audioUrl
    if (originalUrl) {
      try {
        const proxiedUrl = await proxyAudioUrl(originalUrl)
        return { ...favorite, audioUrl: proxiedUrl }
      } catch (error) {
        console.error('[Favorites] 兜底代理收藏音频失败', error)
      }
    }
  }

  return null
}

// 确保代理已启动，带重试，避免首次点击收藏时连接被拒绝
async function ensureProxyReady(retries = 3, delay = 200) {
  if (!isTauri) return
  const { invoke } = await import('@tauri-apps/api/core')
  for (let i = 0; i < retries; i++) {
    try {
      await invoke('start_proxy_server')
      return
    } catch (error) {
      console.error(`[Favorites] 启动代理失败，第 ${i + 1} 次:`, error)
      if (i < retries - 1) {
        await sleep(delay)
      }
    }
  }
  throw new Error('代理服务器启动失败')
}

function FavoritesDrawer({ isOpen, onClose }: FavoritesDrawerProps) {
  const { favorites, removeFavorite } = useFavoritesStore()

  // 抽屉打开时先预热代理，进一步避免首点击收藏的竞态
  useEffect(() => {
    if (!isOpen) return
    ensureProxyReady().catch(() => {})
  }, [isOpen])

  const handlePlayFavorite = async (favorite: FavoriteItem) => {
    const { playlist: latestPlaylist } = usePlayerStore.getState()
    const existingIndex = latestPlaylist.findIndex(item => item.bvid === favorite.bvid)

    usePlayerStore.setState({ isLoading: true, error: null })

    // 确保代理已启动，避免初次点击收藏时连接被拒绝
    try {
      await ensureProxyReady()
    } catch (error) {
      usePlayerStore.setState({ isLoading: false, error: '代理启动失败，请重试或重启应用' })
      return
    }

    const resolved = await resolveFavoriteAudio(favorite)
    if (!resolved?.audioUrl) {
      usePlayerStore.setState({ isLoading: false, error: '无法获取收藏音频地址，请重试' })
      return
    }

    const updatedPlaylist = [...latestPlaylist]
    let targetIndex = existingIndex

    if (existingIndex >= 0) {
      updatedPlaylist[existingIndex] = { ...updatedPlaylist[existingIndex], ...resolved }
    } else {
      updatedPlaylist.push(resolved)
      targetIndex = updatedPlaylist.length - 1
    }

    usePlayerStore.setState({ playlist: updatedPlaylist, currentIndex: targetIndex, isLoading: false })
    usePlayerStore.getState().play()
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

                <div className={`flex items-center gap-1 transition-opacity ${isAndroid ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
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


