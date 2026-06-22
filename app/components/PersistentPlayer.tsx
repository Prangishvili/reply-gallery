'use client'

import { usePathname } from 'next/navigation'
import { SongPlayer } from './SongPlayer'
import { playAudio, pauseAudio } from '@/app/lib/audio-manager'

const HIDDEN_ON = ['/', '/make']

export function PersistentPlayer() {
  const pathname = usePathname()
  if (HIDDEN_ON.includes(pathname)) return null

  const autoPlay = (() => {
    try { const s = sessionStorage.getItem('reply_sound'); if (s !== null) return s === 'true' } catch {}
    return true
  })()

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 1000

  return (
    <SongPlayer
      style={{
        position: 'fixed',
        top: isMobile ? 52 : 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        width: isMobile ? '90vw' : 400,
      }}
      autoPlay={autoPlay}
      onPlay={playAudio}
      onPause={pauseAudio}
    />
  )
}
