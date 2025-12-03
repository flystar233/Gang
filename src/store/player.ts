import { create } from 'zustand'
import { getRandomVideo, getRandomDanKouVideo, getRandomDuiKouVideo, getAudioUrl, type VideoItem } from '@/api/bilibili'
import { useSettingsStore } from '@/store/settings'

interface PlayItem extends VideoItem {
  audioUrl?: string
  audioBitrate?: number // 音频码率 kbps
  pages?: VideoItem[]
}

interface PlayerState {
  isPlaying: boolean
  currentIndex: number
  playlist: PlayItem[]
  currentTime: number
  duration: number
  isLoading: boolean
  error: string | null
}

interface PlayerActions {
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
audio.crossOrigin = 'anonymous'

export const getAudioElement = () => audio

// 同步设置到音频元素
const syncAudioSettings = () => {
  const { volume, playbackRate } = useSettingsStore.getState()
  audio.volume = volume
  audio.playbackRate = playbackRate
}
syncAudioSettings()
useSettingsStore.subscribe(syncAudioSettings)

// 播放指定URL的音频
const playAudio = (url: string) => {
  audio.src = url
  audio.playbackRate = useSettingsStore.getState().playbackRate
  audio.play()
}

// 检查是否为合集
const isCollection = (item: PlayItem) => item.pages && item.pages.length > 1

// 处理视频结果，获取音频URL并返回PlayItem
type VideoResult = VideoItem | VideoItem[] | (VideoItem & { pages?: VideoItem[] })

const processVideoResult = async (result: VideoResult): Promise<PlayItem | null> => {
  // 合集（数组形式，来自 gangDanKou/gangDuiKou）
  if (Array.isArray(result)) {
    const firstPage = result[0]
    if (!firstPage?.cid) return null
    const audioInfo = await getAudioUrl(firstPage.bvid, firstPage.cid)
    if (!audioInfo) return null
    return { ...firstPage, audioUrl: audioInfo.url, audioBitrate: audioInfo.bitrate, pages: result }
  }
  
  // 合集（pages属性形式，来自 gangYiXia）
  if ('pages' in result && result.pages) {
    const firstPage = result.pages[0]
    if (!firstPage?.cid) return null
    const audioInfo = await getAudioUrl(firstPage.bvid, firstPage.cid)
    if (!audioInfo) return null
    return {
      bvid: result.bvid,
      title: result.title,
      pic: result.pic,
      duration: result.duration,
      cid: firstPage.cid,
      audioUrl: audioInfo.url,
      audioBitrate: audioInfo.bitrate,
      pages: result.pages,
    }
  }
  
  // 单个视频
  if (!result.cid) return null
  const audioInfo = await getAudioUrl(result.bvid, result.cid)
  if (!audioInfo) return null
  return { ...result, audioUrl: audioInfo.url, audioBitrate: audioInfo.bitrate }
}

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => {
  // 通用的获取视频并播放函数
  const fetchAndPlay = async (fetchFn: () => Promise<VideoResult | null>) => {
    set({ isLoading: true, error: null })
    try {
      const result = await fetchFn()
      if (!result) {
        set({ isLoading: false })
        return
      }
      
      const newItem = await processVideoResult(result)
      if (!newItem) {
        set({ isLoading: false })
        return
      }

      const { playlist } = get()
      set({
        playlist: [...playlist, newItem],
        currentIndex: playlist.length,
        isLoading: false,
        isPlaying: true,
      })
      playAudio(newItem.audioUrl!)
    } catch {
      set({ isLoading: false, error: '网络连接失败，请检查网络' })
    }
  }

  // 播放指定索引的项目（合集从第一P开始）
  const playItemAtIndex = async (index: number) => {
    const { playlist } = get()
    const item = playlist[index]
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

    gangYiXia: () => fetchAndPlay(getRandomVideo),
    gangDanKou: () => fetchAndPlay(getRandomDanKouVideo),
    gangDuiKou: () => fetchAndPlay(getRandomDuiKouVideo),

    play: () => {
      const { playlist, currentIndex } = get()
      const item = playlist[currentIndex]
      if (item?.audioUrl) {
        if (audio.src !== item.audioUrl) {
          audio.src = item.audioUrl
        }
        audio.playbackRate = useSettingsStore.getState().playbackRate
        audio.play()
        set({ isPlaying: true })
      }
    },

    pause: () => {
      audio.pause()
      set({ isPlaying: false })
    },

    togglePlay: () => {
      get().isPlaying ? get().pause() : get().play()
    },

    next: async () => {
      const { currentIndex, playlist } = get()
      if (currentIndex < playlist.length - 1) {
        await playItemAtIndex(currentIndex + 1)
      }
    },

    prev: async () => {
      const { currentIndex } = get()
      if (currentIndex > 0) {
        await playItemAtIndex(currentIndex - 1)
      }
    },

    seek: (time: number) => {
      audio.currentTime = time
      set({ currentTime: time })
    },

    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),

    removeFromPlaylist: (index: number) => {
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
        const newIndex = index < currentIndex ? currentIndex - 1 : currentIndex
        set({ playlist: newPlaylist, currentIndex: newIndex })
      }
    },

    playPage: async (index: number, pageIndex: number) => {
      const { playlist } = get()
      const item = playlist[index]
      if (!item?.pages || pageIndex >= item.pages.length) return

      const page = item.pages[pageIndex]
      if (!page.cid) return

      const audioInfo = await getAudioUrl(page.bvid, page.cid)
      if (!audioInfo) return

      const newPlaylist = [...playlist]
      newPlaylist[index] = { ...item, cid: page.cid, audioUrl: audioInfo.url, audioBitrate: audioInfo.bitrate }

      set({ playlist: newPlaylist, currentIndex: index, isPlaying: true })
      playAudio(audioInfo.url)
    },
  }
})

// 音频事件监听
audio.addEventListener('timeupdate', () => {
  usePlayerStore.getState().setCurrentTime(audio.currentTime)
})

audio.addEventListener('loadedmetadata', () => {
  usePlayerStore.getState().setDuration(audio.duration)
})

audio.addEventListener('ended', async () => {
  const { playlist, currentIndex } = usePlayerStore.getState()
  const { playMode } = useSettingsStore.getState()
  
  if (currentIndex < 0 || currentIndex >= playlist.length) return
  
  const currentItem = playlist[currentIndex]
  
  // 合集自动播放下一个分P
  if (isCollection(currentItem) && currentItem.cid) {
    const currentPageIndex = currentItem.pages!.findIndex(page => page.cid === currentItem.cid)
    if (currentPageIndex >= 0 && currentPageIndex < currentItem.pages!.length - 1) {
      await usePlayerStore.getState().playPage(currentIndex, currentPageIndex + 1)
      return
    }
  }
  
  // 根据播放模式处理
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
      } else if (playlist.length > 0) {
        const firstItem = playlist[0]
        if (firstItem?.audioUrl) {
          playAudio(firstItem.audioUrl)
          usePlayerStore.setState({ currentIndex: 0, isPlaying: true })
        }
      }
      break
    case 'auto':
      hasNext ? usePlayerStore.getState().next() : usePlayerStore.getState().gangYiXia()
      break
    case 'sequence':
    default:
      if (hasNext) usePlayerStore.getState().next()
      break
  }
})

audio.addEventListener('pause', () => usePlayerStore.setState({ isPlaying: false }))
audio.addEventListener('play', () => usePlayerStore.setState({ isPlaying: true }))

audio.addEventListener('error', () => {
  if (audio.error?.code === MediaError.MEDIA_ERR_NETWORK) {
    usePlayerStore.setState({ isPlaying: false, error: '网络连接失败，请检查网络' })
  }
})
