import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PlayMode, CloseAction, AudioQuality, GangType } from '@/types'
import { DEFAULT_KEYWORDS, PLAY_MODES, PLAYBACK_RATES } from '@/constants'
import { platformAPI, isTauri } from '@/utils/platform'

// 重新导出类型以便向后兼容
export type { PlayMode, CloseAction, AudioQuality }

interface SettingsState {
  // 自定义搜索关键词
  customKeywords: string[]
  // 播放模式
  playMode: PlayMode
  // Gang 类型（单口/对口）
  gangType: GangType
  // 睡眠定时到期时间（时间戳，毫秒）
  sleepTimerDeadline: number | null
  // 音量 (0-1)
  volume: number
  // 静音前的音量，用于恢复
  previousVolume: number
  // 是否静音
  isMuted: boolean
  // 播放速度 (0.5-2.0)
  playbackRate: number
  // 设置面板是否打开
  isSettingsOpen: boolean
  // 默认下载路径
  downloadPath: string
  // 关闭行为
  closeAction: CloseAction
  // 音频品质
  audioQuality: AudioQuality
}

interface SettingsActions {
  setCustomKeywords: (keywords: string[]) => void
  addKeyword: (keyword: string) => void
  removeKeyword: (keyword: string) => void
  setPlayMode: (mode: PlayMode) => void
  setGangType: (type: GangType) => void
  setSleepTimer: (minutes: number | null) => void
  cyclePlayMode: () => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  cyclePlaybackRate: () => void
  openSettings: () => void
  closeSettings: () => void
  toggleSettings: () => void
  setDownloadPath: (path: string) => void
  setCloseAction: (action: CloseAction) => void
  setAudioQuality: (quality: AudioQuality) => void
}

// 常量已移至 @/constants

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set, get) => ({
      customKeywords: [],
      playMode: 'auto',
      gangType: 'dan',
      sleepTimerDeadline: null,
      volume: 0.8,
      previousVolume: 0.8,
      isMuted: false,
      playbackRate: 1.0,
      isSettingsOpen: false,
      downloadPath: '',
      closeAction: 'quit',
      audioQuality: 'high',

      setCustomKeywords: (keywords) => set({ customKeywords: keywords }),
      
      addKeyword: (keyword) => {
        const { customKeywords } = get()
        if (keyword.trim() && !customKeywords.includes(keyword.trim())) {
          set({ customKeywords: [...customKeywords, keyword.trim()] })
        }
      },
      
      removeKeyword: (keyword) => {
        const { customKeywords } = get()
        set({ customKeywords: customKeywords.filter(k => k !== keyword) })
      },
      
      setPlayMode: (mode) => set({ playMode: mode }),
      setGangType: (type) => set({ gangType: type }),
      setSleepTimer: (minutes) => {
        if (minutes === null) {
          set({ sleepTimerDeadline: null })
        } else {
          const deadline = Date.now() + minutes * 60 * 1000
          set({ sleepTimerDeadline: deadline })
        }
      },
      
      cyclePlayMode: () => {
        const { playMode } = get()
        const currentIndex = PLAY_MODES.indexOf(playMode)
        const nextIndex = (currentIndex + 1) % PLAY_MODES.length
        set({ playMode: PLAY_MODES[nextIndex] })
      },
      
      setVolume: (volume) => {
        const newVolume = Math.max(0, Math.min(1, volume))
        set({ 
          volume: newVolume,
          previousVolume: newVolume > 0 ? newVolume : get().previousVolume,
          isMuted: newVolume === 0
        })
      },
      
      toggleMute: () => {
        const { isMuted, volume, previousVolume } = get()
        if (isMuted) {
          // 取消静音，恢复之前的音量
          set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 0.8 })
        } else {
          // 静音，保存当前音量
          set({ isMuted: true, previousVolume: volume, volume: 0 })
        }
      },
      
      setPlaybackRate: (rate) => set({ playbackRate: Math.max(0.5, Math.min(2.0, rate)) }),
      
      cyclePlaybackRate: () => {
        const { playbackRate } = get()
        const rates = [...PLAYBACK_RATES] as number[]
        const currentIndex = rates.indexOf(playbackRate)
        const nextIndex = (currentIndex + 1) % rates.length
        set({ playbackRate: rates[nextIndex] })
      },
      
      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      toggleSettings: () => set(state => ({ isSettingsOpen: !state.isSettingsOpen })),

      setDownloadPath: (path) => set({ downloadPath: path }),
      setCloseAction: (action) => {
        set({ closeAction: action })
        // 同步到后端（仅 Tauri 桌面端）
        if (isTauri && platformAPI.setCloseAction) {
          platformAPI.setCloseAction(action).catch(() => {
            // 忽略错误
          })
        }
      },
      setAudioQuality: (quality) => set({ audioQuality: quality }),
    }),
    {
      name: 'gang-yi-xia-settings',
      partialize: (state) => ({
        customKeywords: state.customKeywords,
        playMode: state.playMode,
        gangType: state.gangType,
        sleepTimerDeadline: state.sleepTimerDeadline,
        volume: state.volume,
        previousVolume: state.previousVolume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        downloadPath: state.downloadPath,
        closeAction: state.closeAction,
        audioQuality: state.audioQuality,
      }),
    }
  )
)

// 获取所有关键词（自定义 + 默认）
export function getAllKeywords(): string[] {
  const { customKeywords } = useSettingsStore.getState()
  return customKeywords.length > 0 ? customKeywords : [...DEFAULT_KEYWORDS]
}
