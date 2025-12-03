import { useEffect, useState } from 'react'
import { usePlayerStore } from '../store/player'

function Toast() {
  const { error, clearError } = usePlayerStore()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (error) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(clearError, 300)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, clearError])

  if (!error) return null

  return (
    <div
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 max-w-[320px]">
        <svg 
          className="w-5 h-5 flex-shrink-0" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span className="text-sm">{error}</span>
        <button
          onClick={() => {
            setVisible(false)
            setTimeout(clearError, 300)
          }}
          className="ml-auto p-0.5 hover:bg-white/20 rounded transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default Toast
