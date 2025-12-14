import { create } from 'zustand'
import { getRandomVideo, getRandomDanKouVideo, getRandomDuiKouVideo, getAudioUrl, clearAudioUrlCache } from '@/api/bilibili'
import { useSettingsStore } from '@/store/settings'
import { isAndroid } from '@/utils/platform'
import { isCollection } from '@/utils/video'
import type { PlayItem, VideoItem } from '@/types'

// 链接刷新重试计数器（避免无限重试）
let refreshRetryCount = 0
const MAX_REFRESH_RETRIES = 2

type VideoResult = VideoItem | VideoItem[] | (VideoItem & { pages?: VideoItem[] })

interface PlayerStore {
  isPlaying: boolean
  currentIndex: number
  playlist: PlayItem[]
  currentTime: number
  duration: number
  isLoading: boolean
  error: string | null
  gangYiXia: () => Promise<void>
  gangDanKou: () => Promise<void>
  gangDuiKou: () => Promise<void>
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => Promise<void>
  prev: () => Promise<void>
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  removeFromPlaylist: (index: number) => void
  setError: (error: string | null) => void
  clearError: () => void
  playPage: (index: number, pageIndex: number) => Promise<void>
}

// 音频元素
const audio = new Audio()
if (!isAndroid) audio.crossOrigin = 'anonymous'
audio.preload = 'auto'

export const getAudioElement = () => audio

// 同步设置到音频元素
const syncAudioSettings = () => {
  const { volume, playbackRate } = useSettingsStore.getState()
  audio.volume = volume
  audio.playbackRate = playbackRate
}
syncAudioSettings()
useSettingsStore.subscribe(syncAudioSettings)

// 播放音频并处理错误
const startPlayback = () => {
  audio.playbackRate = useSettingsStore.getState().playbackRate
  audio.play().catch((err) => {
    usePlayerStore.setState({ isPlaying: false, error: `播放失败: ${err.message || '未知错误'}` })
  })
}

// 播放指定URL的音频
const playAudio = (url: string) => {
  if (!url) return
  audio.pause()
  audio.currentTime = 0

  if (isAndroid) {
    // Android: 等待足够缓冲后播放
    const onLoaded = () => {
      audio.removeEventListener('loadeddata', onLoaded)
      const checkBuffer = () => {
        const hasBuffer = audio.buffered.length > 0
        const bufferOk = hasBuffer && (audio.buffered.end(audio.buffered.length - 1) >= 3 || audio.readyState >= 3)
        bufferOk ? startPlayback() : setTimeout(checkBuffer, 100)
      }
      setTimeout(checkBuffer, 200)
    }
    audio.addEventListener('loadeddata', onLoaded, { once: true })
  } else {
    // 桌面: canplaythrough 后播放
    audio.addEventListener('canplaythrough', startPlayback, { once: true })
  }

  audio.src = url
  audio.load()
}

// 处理视频结果，获取音频URL
const processVideoResult = async (result: VideoResult): Promise<PlayItem | null> => {
  if (Array.isArray(result)) {
    const first = result[0]
    if (!first?.cid) return null
    const info = await getAudioUrl(first.bvid, first.cid)
    return info ? { ...first, audioUrl: info.url, audioBitrate: info.bitrate, pages: result } : null
  }

  if ('pages' in result && result.pages) {
    const first = result.pages[0]
    if (!first?.cid) return null
    const info = await getAudioUrl(first.bvid, first.cid)
    return info ? { ...result, cid: first.cid, audioUrl: info.url, audioBitrate: info.bitrate } : null
  }

  if (!result.cid) return null
  const info = await getAudioUrl(result.bvid, result.cid)
  return info ? { ...result, audioUrl: info.url, audioBitrate: info.bitrate } : null
}

export const usePlayerStore = create<PlayerStore>((set, get) => {
  // 获取视频并播放
  const fetchAndPlay = async (fetchFn: () => Promise<VideoResult | null>) => {
    set({ isLoading: true, error: null })
    try {
      const result = await fetchFn()
      if (!result) return set({ isLoading: false })

      const { playlist } = get()
      const newIndex = playlist.length

      // 创建临时项，立即显示标题
      const baseItem = Array.isArray(result) ? result[0] : result
      const tempItem: PlayItem = {
        ...baseItem,
        audioUrl: undefined,
        pages: Array.isArray(result) ? result : ('pages' in result ? result.pages : undefined),
      }

      set({ playlist: [...playlist, tempItem], currentIndex: newIndex, isLoading: true })

      // 获取音频URL
      const newItem = await processVideoResult(result)
      if (!newItem) return set({ isLoading: false, error: '无法获取音频地址' })

      const finalPlaylist = [...get().playlist]
      finalPlaylist[newIndex] = newItem
      set({ playlist: finalPlaylist, isLoading: false, isPlaying: true })
      playAudio(newItem.audioUrl!)
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : '网络连接失败，请检查网络' })
    }
  }

  // 播放指定索引的项目
  const playItemAtIndex = async (index: number) => {
    const item = get().playlist[index]
    if (!item) return

    if (isCollection(item)) {
      await get().playPage(index, 0)
    } else if (item.audioUrl) {
      playAudio(item.audioUrl)
      set({ currentIndex: index, isPlaying: true })
    }
  }

  return {
    isPlaying: false,
    currentIndex: -1,
    playlist: [],
    currentTime: 0,
    duration: 0,
    isLoading: false,
    error: null,

    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    setCurrentTime: (currentTime) => set({ currentTime }),
    setDuration: (duration) => set({ duration }),

    gangYiXia: () => fetchAndPlay(getRandomVideo),
    gangDanKou: () => fetchAndPlay(getRandomDanKouVideo),
    gangDuiKou: () => fetchAndPlay(getRandomDuiKouVideo),

    play: () => {
      const item = get().playlist[get().currentIndex]
      if (!item?.audioUrl) return

      if (audio.src !== item.audioUrl) {
        playAudio(item.audioUrl)
      } else {
        audio.playbackRate = useSettingsStore.getState().playbackRate
        audio.play().catch(() => set({ isPlaying: false }))
      }
      set({ isPlaying: true })
    },

    pause: () => {
      audio.pause()
      set({ isPlaying: false })
    },

    togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

    next: async () => {
      const { currentIndex, playlist } = get()
      if (currentIndex < playlist.length - 1) await playItemAtIndex(currentIndex + 1)
    },

    prev: async () => {
      const { currentIndex } = get()
      if (currentIndex > 0) await playItemAtIndex(currentIndex - 1)
    },

    seek: (time) => {
      audio.currentTime = time
      set({ currentTime: time })
    },

    removeFromPlaylist: (index) => {
      const { playlist, currentIndex } = get()
      const newPlaylist = playlist.filter((_, i) => i !== index)

      if (index === currentIndex) {
        if (newPlaylist.length === 0) {
          audio.pause()
          audio.src = ''
          set({ playlist: [], currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0 })
        } else {
          const newIndex = Math.min(currentIndex, newPlaylist.length - 1)
          const nextItem = newPlaylist[newIndex]
          if (nextItem?.audioUrl) {
            playAudio(nextItem.audioUrl)
            set({ playlist: newPlaylist, currentIndex: newIndex, isPlaying: true })
          } else {
            set({ playlist: newPlaylist, currentIndex: newIndex })
          }
        }
      } else {
        set({ playlist: newPlaylist, currentIndex: index < currentIndex ? currentIndex - 1 : currentIndex })
      }
    },

    playPage: async (index, pageIndex) => {
      const item = get().playlist[index]
      if (!item?.pages || pageIndex >= item.pages.length) return

      const page = item.pages[pageIndex]
      if (!page.cid) return

      const audioInfo = await getAudioUrl(page.bvid, page.cid)
      if (!audioInfo) return

      const newPlaylist = [...get().playlist]
      newPlaylist[index] = { ...item, cid: page.cid, audioUrl: audioInfo.url, audioBitrate: audioInfo.bitrate }
      set({ playlist: newPlaylist, currentIndex: index, isPlaying: true })
      playAudio(audioInfo.url)
    },
  }
})

// 音频事件监听
audio.addEventListener('timeupdate', () => usePlayerStore.getState().setCurrentTime(audio.currentTime))
audio.addEventListener('loadedmetadata', () => usePlayerStore.getState().setDuration(audio.duration))
audio.addEventListener('pause', () => usePlayerStore.setState({ isPlaying: false }))
audio.addEventListener('play', () => usePlayerStore.setState({ isPlaying: true }))

const ERROR_MESSAGES: Record<number, string> = {
  [MediaError.MEDIA_ERR_ABORTED]: '播放已中止',
  [MediaError.MEDIA_ERR_NETWORK]: '网络连接失败，请检查网络或代理配置',
  [MediaError.MEDIA_ERR_DECODE]: '无法解码音频格式',
  [MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED]: '不支持此音频格式',
}

// 刷新当前播放项的音频 URL（用于链接过期时）
const refreshCurrentAudioUrl = async (): Promise<boolean> => {
  const { playlist, currentIndex } = usePlayerStore.getState()
  const item = playlist[currentIndex]
  if (!item?.bvid || !item?.cid) return false

  // 清除旧的缓存
  clearAudioUrlCache()

  // 重新获取音频 URL
  const audioInfo = await getAudioUrl(item.bvid, item.cid)
  if (!audioInfo) return false

  // 更新播放列表中的 URL
  const newPlaylist = [...playlist]
  newPlaylist[currentIndex] = { ...item, audioUrl: audioInfo.url, audioBitrate: audioInfo.bitrate }
  usePlayerStore.setState({ playlist: newPlaylist })

  // 播放新的 URL
  playAudio(audioInfo.url)
  usePlayerStore.setState({ isPlaying: true, error: null })
  return true
}

audio.addEventListener('error', async () => {
  if (!audio.src || usePlayerStore.getState().playlist.length === 0) {
    return usePlayerStore.setState({ isPlaying: false, error: null })
  }

  const code = audio.error?.code ?? 0

  // 网络错误或不支持的格式可能是链接过期，尝试刷新
  if ((code === MediaError.MEDIA_ERR_NETWORK || code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) 
      && refreshRetryCount < MAX_REFRESH_RETRIES) {
    refreshRetryCount++
    usePlayerStore.setState({ isLoading: true, error: null })
    
    try {
      const success = await refreshCurrentAudioUrl()
      if (success) return // 刷新成功，静默处理
    } catch {
      // 刷新失败，继续走下面的错误处理
    }
    
    // 刷新失败才打印日志
    if (refreshRetryCount >= MAX_REFRESH_RETRIES) {
      console.error('[Player] 链接刷新失败，已达重试上限')
    }
    usePlayerStore.setState({ isLoading: false })
  }

  // 刷新失败或达到重试上限，显示错误
  usePlayerStore.setState({ isPlaying: false, error: ERROR_MESSAGES[code] || `音频错误: ${code}` })
})

// 成功播放时重置重试计数器
audio.addEventListener('playing', () => {
  refreshRetryCount = 0
})

audio.addEventListener('ended', async () => {
  const { playlist, currentIndex } = usePlayerStore.getState()
  const { playMode, gangType } = useSettingsStore.getState()

  if (currentIndex < 0 || currentIndex >= playlist.length) return

  const currentItem = playlist[currentIndex]
  const currentPageIndex = currentItem.pages?.findIndex((p) => p.cid === currentItem.cid) ?? -1
  const hasNextPage = currentPageIndex >= 0 && currentPageIndex < (currentItem.pages?.length ?? 0) - 1

  // 合集自动播放下一分P（单曲循环除外）
  if (isCollection(currentItem) && hasNextPage && playMode !== 'single') {
    return usePlayerStore.getState().playPage(currentIndex, currentPageIndex + 1)
  }

  const hasNext = currentIndex < playlist.length - 1

  switch (playMode) {
    case 'single':
      audio.currentTime = 0
      audio.playbackRate = useSettingsStore.getState().playbackRate
      audio.play()
      break
    case 'loop':
      if (hasNext) {
        usePlayerStore.getState().next()
      } else if (playlist[0]?.audioUrl) {
        playAudio(playlist[0].audioUrl)
        usePlayerStore.setState({ currentIndex: 0, isPlaying: true })
      }
      break
    case 'auto':
      hasNext
        ? usePlayerStore.getState().next()
        : gangType === 'dui'
          ? usePlayerStore.getState().gangDuiKou()
          : usePlayerStore.getState().gangDanKou()
      break
    default:
      if (hasNext) usePlayerStore.getState().next()
  }
})

// 睡眠定时器
setInterval(() => {
  const { sleepTimerDeadline, setSleepTimer } = useSettingsStore.getState()
  if (sleepTimerDeadline && Date.now() >= sleepTimerDeadline) {
    audio.pause()
    usePlayerStore.setState({ isPlaying: false })
    setSleepTimer(null)
  }
}, 1000)

// Android MediaSession 桥接
declare global {
  interface Window {
    AndroidMediaSession?: {
      updatePlaybackState: (isPlaying: boolean) => void
      updateMetadata: (title: string) => void
    }
  }
}

if (isAndroid && window.AndroidMediaSession) {
  // 同步播放状态到原生 MediaSession
  audio.addEventListener('play', () => {
    window.AndroidMediaSession?.updatePlaybackState(true)
  })
  
  audio.addEventListener('pause', () => {
    window.AndroidMediaSession?.updatePlaybackState(false)
  })

  // 监听来自原生层的媒体控制事件（蓝牙耳机、锁屏界面等）
  window.addEventListener('mediacontrol', ((event: CustomEvent<string>) => {
    const action = event.detail
    switch (action) {
      case 'play':
        usePlayerStore.getState().play()
        break
      case 'pause':
        usePlayerStore.getState().pause()
        break
      case 'next':
        usePlayerStore.getState().next()
        break
      case 'prev':
        usePlayerStore.getState().prev()
        break
    }
  }) as EventListener)

  // 监听播放列表变化，更新媒体元数据
  usePlayerStore.subscribe((state, prevState) => {
    const currentItem = state.playlist[state.currentIndex]
    const prevItem = prevState.playlist[prevState.currentIndex]
    
    // 当切换曲目时更新元数据
    if (currentItem?.title && currentItem.title !== prevItem?.title) {
      window.AndroidMediaSession?.updateMetadata(currentItem.title)
    }
  })
}
