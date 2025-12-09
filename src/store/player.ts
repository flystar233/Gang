import { create } from 'zustand'
import { getRandomVideo, getRandomDanKouVideo, getRandomDuiKouVideo, getAudioUrl } from '@/api/bilibili'
import { useSettingsStore } from '@/store/settings'
import { isAndroid } from '@/utils/platform'
import type { PlayItem, VideoItem } from '@/types'
import { isCollection } from '@/utils/video'

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
// Android 上不使用 crossOrigin，避免 CORS 问题（代理服务器已处理）
if (!isAndroid) {
  audio.crossOrigin = 'anonymous'
}
audio.preload = 'auto' // 预加载音频数据，减少缓冲问题

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
  if (!url) return
  
  // 先暂停当前播放，避免切换时的杂音
  audio.pause()
  audio.currentTime = 0
  
  // Android 平台需要更长的缓冲时间，使用不同的策略
  if (isAndroid) {
    // Android 上使用 loadeddata 事件，并增加延迟确保缓冲充足
    const handleLoadedData = () => {
      audio.removeEventListener('loadeddata', handleLoadedData)
      
      // Android 上等待更多缓冲数据
      const checkBuffer = () => {
        // 检查是否有足够的缓冲数据（至少 3 秒）
        if (audio.buffered.length > 0) {
          const bufferedEnd = audio.buffered.end(audio.buffered.length - 1)
          if (bufferedEnd >= 3 || audio.readyState >= 3) {
            audio.playbackRate = useSettingsStore.getState().playbackRate
            audio.play().catch((error) => {
              usePlayerStore.setState({ 
                isPlaying: false, 
                error: `播放失败: ${error.message || '未知错误'}` 
              })
            })
          } else {
            // 缓冲不足，继续等待
            setTimeout(checkBuffer, 100)
          }
        } else {
          // 没有缓冲数据，继续等待
          setTimeout(checkBuffer, 100)
        }
      }
      
      // 延迟检查，确保有足够缓冲
      setTimeout(checkBuffer, 200)
    }
    
    audio.addEventListener('loadeddata', handleLoadedData, { once: true })
    audio.src = url
    audio.load()
  } else {
    // Windows/桌面平台使用 canplaythrough 事件
    const handleCanPlayThrough = () => {
      audio.removeEventListener('canplaythrough', handleCanPlayThrough)
      audio.playbackRate = useSettingsStore.getState().playbackRate
      
      audio.play().catch((error) => {
        usePlayerStore.setState({ 
          isPlaying: false, 
          error: `播放失败: ${error.message || '未知错误'}` 
        })
      })
    }
    
    audio.addEventListener('canplaythrough', handleCanPlayThrough, { once: true })
    audio.src = url
    audio.load()
  }
}

// isCollection 函数已移至 @/utils/video

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
  // 通用的获取视频并播放函数（优化：提前显示标题）
  const fetchAndPlay = async (fetchFn: () => Promise<VideoResult | null>) => {
    set({ isLoading: true, error: null })
    try {
      const result = await fetchFn()
      if (!result) {
        set({ isLoading: false })
        return
      }
      
      // 先创建临时项（不包含 audioUrl），立即显示标题
      const { playlist } = get()
      const newIndex = playlist.length
      
      // 根据 result 类型创建临时项
      let tempItem: PlayItem
      if (Array.isArray(result)) {
        tempItem = { ...result[0], audioUrl: undefined, pages: result }
      } else if ('pages' in result && result.pages) {
        tempItem = { ...result, audioUrl: undefined }
      } else {
        tempItem = { ...result, audioUrl: undefined }
      }
      
      const tempPlaylist = [...playlist, tempItem]
      
      // 立即更新 UI，显示标题
      set({
        playlist: tempPlaylist,
        currentIndex: newIndex,
        isLoading: true, // 保持加载状态，等待音频
      })
      
      // 异步处理音频（不阻塞 UI）
      const newItem = await processVideoResult(result)
      if (!newItem) {
        set({ isLoading: false, error: '无法获取音频地址' })
        return
      }

      // 更新播放列表，添加音频 URL
      const finalPlaylist = [...tempPlaylist]
      finalPlaylist[newIndex] = newItem
      
      set({
        playlist: finalPlaylist,
        isLoading: false,
        isPlaying: true,
      })
      
      // 立即开始播放
      playAudio(newItem.audioUrl!)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '网络连接失败，请检查网络'
      set({ isLoading: false, error: errorMessage })
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
          // 如果 URL 不同，使用 playAudio 函数（已包含平台特定逻辑）
          playAudio(item.audioUrl)
          set({ isPlaying: true })
        } else {
          // URL 相同，直接播放
          audio.playbackRate = useSettingsStore.getState().playbackRate
          audio.play().catch(() => {
            set({ isPlaying: false })
          })
          set({ isPlaying: true })
        }
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

// 睡眠定时监听：到期后暂停并清空定时
let sleepWatcherStarted = false
const startSleepWatcher = () => {
  if (sleepWatcherStarted) return
  sleepWatcherStarted = true
  setInterval(() => {
    const { sleepTimerDeadline, setSleepTimer } = useSettingsStore.getState()
    if (!sleepTimerDeadline) return
    if (Date.now() >= sleepTimerDeadline) {
      audio.pause()
      usePlayerStore.setState({ isPlaying: false })
      setSleepTimer(null)
    }
  }, 1000)
}
startSleepWatcher()

audio.addEventListener('ended', async () => {
  const { playlist, currentIndex } = usePlayerStore.getState()
  const { playMode } = useSettingsStore.getState()
  
  if (currentIndex < 0 || currentIndex >= playlist.length) return
  
  const currentItem = playlist[currentIndex]
  
  // 合集自动播放下一个分P（单曲循环时不切分P）
  const hasNextPageInCollection =
    isCollection(currentItem) &&
    currentItem.cid &&
    currentItem.pages &&
    currentItem.pages.findIndex(page => page.cid === currentItem.cid) >= 0 &&
    currentItem.pages.findIndex(page => page.cid === currentItem.cid) < currentItem.pages.length - 1

  if (hasNextPageInCollection && playMode !== 'single') {
    const currentPageIndex = currentItem.pages!.findIndex(page => page.cid === currentItem.cid)
    await usePlayerStore.getState().playPage(currentIndex, currentPageIndex + 1)
    return
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
    case 'auto': {
      if (hasNext) {
        usePlayerStore.getState().next()
      } else {
        const gangType = useSettingsStore.getState().gangType
        if (gangType === 'dui') {
          usePlayerStore.getState().gangDuiKou()
        } else {
          usePlayerStore.getState().gangDanKou()
        }
      }
      break
    }
    case 'sequence':
    default:
      if (hasNext) usePlayerStore.getState().next()
      break
  }
})

audio.addEventListener('pause', () => usePlayerStore.setState({ isPlaying: false }))
audio.addEventListener('play', () => usePlayerStore.setState({ isPlaying: true }))

audio.addEventListener('error', () => {
  const error = audio.error
  let errorMessage = '播放出错'
  
  if (error) {
    switch (error.code) {
      case MediaError.MEDIA_ERR_ABORTED:
        errorMessage = '播放已中止'
        break
      case MediaError.MEDIA_ERR_NETWORK:
        errorMessage = '网络连接失败，请检查网络或 Tauri 代理配置'
        break
      case MediaError.MEDIA_ERR_DECODE:
        errorMessage = '无法解码音频格式，可能是文件格式不支持或代理失败'
        break
      case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = '浏览器不支持此音频格式或 CORS 被拒绝'
        break
      default:
        errorMessage = `音频错误 (代码: ${error.code}): ${error.message}`
    }
  }
  
  usePlayerStore.setState({ isPlaying: false, error: errorMessage })
})

