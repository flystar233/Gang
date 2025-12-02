import { create } from 'zustand'
import { getRandomVideo, getRandomDanKouVideo, getRandomDuiKouVideo, getAudioUrl, type VideoItem } from '../api/bilibili'
import { useSettingsStore } from './settings'

interface PlayItem extends VideoItem {
  audioUrl?: string
}

interface PlayerState {
  isPlaying: boolean
  currentIndex: number
  playlist: PlayItem[]
  currentTime: number
  duration: number
  isLoading: boolean
}

interface PlayerActions {
  gangYiXia: () => Promise<void>
  gangDanKou: () => Promise<void>
  gangDuiKou: () => Promise<void>
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  seek: (time: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  removeFromPlaylist: (index: number) => void
}

const audio = new Audio()
audio.crossOrigin = 'anonymous'

// 暴露 audio 元素供音形可视化使用
export const getAudioElement = () => audio

// 同步音量和播放速度设置
const syncSettings = () => {
  const { volume, playbackRate } = useSettingsStore.getState()
  audio.volume = volume
  audio.playbackRate = playbackRate
}
syncSettings()
useSettingsStore.subscribe((state) => {
  audio.volume = state.volume
  audio.playbackRate = state.playbackRate
})

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  isPlaying: false,
  currentIndex: -1,
  playlist: [],
  currentTime: 0,
  duration: 0,
  isLoading: false,

  gangYiXia: async () => {
    set({ isLoading: true })
    try {
      const video = await getRandomVideo()
      if (!video || !video.cid) {
        console.error('没有找到视频')
        set({ isLoading: false })
        return
      }

      // 获取音频地址
      const audioUrl = await getAudioUrl(video.bvid, video.cid)
      if (!audioUrl) {
        console.error('获取音频地址失败')
        set({ isLoading: false })
        return
      }

      const newItem: PlayItem = { ...video, audioUrl }
      const { playlist } = get()
      const newPlaylist = [...playlist, newItem]
      const newIndex = newPlaylist.length - 1

      set({ playlist: newPlaylist, currentIndex: newIndex, isLoading: false })

      // 播放
      audio.src = audioUrl
      audio.playbackRate = useSettingsStore.getState().playbackRate
      audio.play()
      set({ isPlaying: true })
    } catch (error) {
      console.error('纲一下失败:', error)
      set({ isLoading: false })
    }
  },

  gangDanKou: async () => {
    set({ isLoading: true })
    try {
      const video = await getRandomDanKouVideo()
      if (!video || !video.cid) {
        console.error('没有找到单口相声')
        set({ isLoading: false })
        return
      }

      // 获取音频地址
      const audioUrl = await getAudioUrl(video.bvid, video.cid)
      if (!audioUrl) {
        console.error('获取音频地址失败')
        set({ isLoading: false })
        return
      }

      const newItem: PlayItem = { ...video, audioUrl }
      const { playlist } = get()
      const newPlaylist = [...playlist, newItem]
      const newIndex = newPlaylist.length - 1

      set({ playlist: newPlaylist, currentIndex: newIndex, isLoading: false })

      // 播放
      audio.src = audioUrl
      audio.playbackRate = useSettingsStore.getState().playbackRate
      audio.play()
      set({ isPlaying: true })
    } catch (error) {
      console.error('Gang单口失败:', error)
      set({ isLoading: false })
    }
  },

  gangDuiKou: async () => {
    set({ isLoading: true })
    try {
      const video = await getRandomDuiKouVideo()
      if (!video || !video.cid) {
        console.error('没有找到对口相声')
        set({ isLoading: false })
        return
      }

      // 获取音频地址
      const audioUrl = await getAudioUrl(video.bvid, video.cid)
      if (!audioUrl) {
        console.error('获取音频地址失败')
        set({ isLoading: false })
        return
      }

      const newItem: PlayItem = { ...video, audioUrl }
      const { playlist } = get()
      const newPlaylist = [...playlist, newItem]
      const newIndex = newPlaylist.length - 1

      set({ playlist: newPlaylist, currentIndex: newIndex, isLoading: false })

      // 播放
      audio.src = audioUrl
      audio.playbackRate = useSettingsStore.getState().playbackRate
      audio.play()
      set({ isPlaying: true })
    } catch (error) {
      console.error('Gang对口失败:', error)
      set({ isLoading: false })
    }
  },

  play: () => {
    const { playlist, currentIndex } = get()
    if (currentIndex >= 0 && playlist[currentIndex]?.audioUrl) {
      if (audio.src !== playlist[currentIndex].audioUrl) {
        audio.src = playlist[currentIndex].audioUrl!
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
    const { isPlaying } = get()
    if (isPlaying) {
      get().pause()
    } else {
      get().play()
    }
  },

  next: () => {
    const { playlist, currentIndex } = get()
    if (currentIndex < playlist.length - 1) {
      const nextIndex = currentIndex + 1
      const nextItem = playlist[nextIndex]
      if (nextItem.audioUrl) {
        audio.src = nextItem.audioUrl
        audio.playbackRate = useSettingsStore.getState().playbackRate
        audio.play()
        set({ currentIndex: nextIndex, isPlaying: true })
      }
    }
    // 没有下一首就什么都不做
  },

  prev: () => {
    const { playlist, currentIndex } = get()
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      const prevItem = playlist[prevIndex]
      if (prevItem.audioUrl) {
        audio.src = prevItem.audioUrl
        audio.playbackRate = useSettingsStore.getState().playbackRate
        audio.play()
        set({ currentIndex: prevIndex, isPlaying: true })
      }
    }
  },

  seek: (time: number) => {
    audio.currentTime = time
    set({ currentTime: time })
  },

  setCurrentTime: (time: number) => set({ currentTime: time }),
  setDuration: (duration: number) => set({ duration }),

  removeFromPlaylist: (index: number) => {
    const { playlist, currentIndex } = get()
    const newPlaylist = playlist.filter((_, i) => i !== index)
    
    // 删除的是当前播放的项目
    if (index === currentIndex) {
      if (newPlaylist.length === 0) {
        // 列表为空，停止播放
        audio.pause()
        audio.src = ''
        set({ playlist: [], currentIndex: -1, isPlaying: false, currentTime: 0, duration: 0 })
      } else {
        // 播放下一首（或最后一首）
        const newIndex = Math.min(currentIndex, newPlaylist.length - 1)
        const nextItem = newPlaylist[newIndex]
        if (nextItem?.audioUrl) {
          audio.src = nextItem.audioUrl
          audio.playbackRate = useSettingsStore.getState().playbackRate
          audio.play()
          set({ playlist: newPlaylist, currentIndex: newIndex, isPlaying: true })
        } else {
          set({ playlist: newPlaylist, currentIndex: newIndex })
        }
      }
    } else {
      // 删除的不是当前项目，只调整索引
      let newIndex = currentIndex
      if (index < currentIndex) {
        newIndex = currentIndex - 1
      }
      set({ playlist: newPlaylist, currentIndex: newIndex })
    }
  },
}))

// 音频事件监听
audio.addEventListener('timeupdate', () => {
  usePlayerStore.getState().setCurrentTime(audio.currentTime)
})

audio.addEventListener('loadedmetadata', () => {
  usePlayerStore.getState().setDuration(audio.duration)
})

audio.addEventListener('ended', () => {
  const { playlist, currentIndex } = usePlayerStore.getState()
  const { playMode } = useSettingsStore.getState()
  
  switch (playMode) {
    case 'single':
      // 单曲循环：重新播放当前曲目
      audio.currentTime = 0
      audio.playbackRate = useSettingsStore.getState().playbackRate
      audio.play()
      break
    case 'loop':
      // 列表循环：播放下一首，如果是最后一首则回到第一首
      if (currentIndex < playlist.length - 1) {
        usePlayerStore.getState().next()
      } else if (playlist.length > 0) {
        // 回到第一首
        const firstItem = playlist[0]
        if (firstItem?.audioUrl) {
          audio.src = firstItem.audioUrl
          audio.playbackRate = useSettingsStore.getState().playbackRate
          audio.play()
          usePlayerStore.setState({ currentIndex: 0, isPlaying: true })
        }
      }
      break
    case 'auto':
      // 自动纲一下：播放下一首，如果没有则自动获取新相声
      if (currentIndex < playlist.length - 1) {
        usePlayerStore.getState().next()
      } else {
        usePlayerStore.getState().gangYiXia()
      }
      break
    case 'sequence':
    default:
      // 顺序播放：播放下一首，如果是最后一首则停止
      if (currentIndex < playlist.length - 1) {
        usePlayerStore.getState().next()
      }
      break
  }
})

audio.addEventListener('pause', () => {
  usePlayerStore.setState({ isPlaying: false })
})

audio.addEventListener('play', () => {
  usePlayerStore.setState({ isPlaying: true })
})

