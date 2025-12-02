import { useEffect, useRef } from 'react'

interface AudioWaveformProps {
  audioElement: HTMLAudioElement | null
  width?: number
  height?: number
  barCount?: number
  barColor?: string
}

// 全局存储每个音频元素的 source 节点，避免重复创建
const audioSourceMap = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>()
const audioContextMap = new WeakMap<HTMLAudioElement, AudioContext>()

/**
 * 音频波形可视化组件 - 条形
 */
function AudioWaveform({
  audioElement,
  width = 32,
  height = 32,
  barCount = 12,
  barColor = '#44965B',
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    if (!audioElement || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const wasPlaying = !audioElement.paused
    const currentTime = audioElement.currentTime
    const volume = audioElement.volume

    let audioContext = audioContextMap.get(audioElement)
    let source = audioSourceMap.get(audioElement)

    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioContextMap.set(audioElement, audioContext)
      }

      if (!source) {
        source = audioContext.createMediaElementSource(audioElement)
        audioSourceMap.set(audioElement, source)
        source.connect(audioContext.destination)
      }

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8

      source.connect(analyser)

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {})
      }

      audioElement.volume = volume
      if (currentTime !== audioElement.currentTime) {
        audioElement.currentTime = currentTime
      }

      if (wasPlaying) {
        timeoutRef.current = setTimeout(() => {
          audioElement.play().catch(() => {})
        }, 0)
      }

      analyserRef.current = analyser
      canvas.width = width
      canvas.height = height

      const draw = () => {
        if (!analyser || !ctx) return

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyser.getByteFrequencyData(dataArray)

        ctx.clearRect(0, 0, width, height)

        const barWidth = width / barCount
        const barGap = barWidth * 0.3
        const actualBarWidth = barWidth - barGap

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * bufferLength)
          const barHeight = Math.max(2, (dataArray[dataIndex] / 255) * height * 0.9)

          const x = i * barWidth + barGap / 2
          const y = height - barHeight  // 从底部向上绘制

          ctx.fillStyle = barColor
          ctx.beginPath()
          ctx.roundRect(x, y, actualBarWidth, barHeight, 1)
          ctx.fill()
        }

        animationFrameRef.current = requestAnimationFrame(draw)
      }

      draw()
    } catch (error) {
      console.error('Failed to create audio context:', error)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (analyserRef.current && source) {
        try {
          source.disconnect(analyserRef.current)
        } catch {}
      }
      analyserRef.current = null
    }
  }, [audioElement, width, height, barCount, barColor])

  return <canvas ref={canvasRef} className="rounded-lg" style={{ width, height }} />
}

export default AudioWaveform
