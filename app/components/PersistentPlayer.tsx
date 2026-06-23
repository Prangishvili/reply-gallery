'use client'

import { usePathname } from 'next/navigation'
import { SongPlayer } from './SongPlayer'
import { playAudio, pauseAudio } from '@/app/lib/audio-manager'

const HIDDEN_ON = ['/']

export function PersistentPlayer() {
  const pathname = usePathname()

  if (HIDDEN_ON.includes(pathname)) return null

  const autoPlay = (() => {
    try { const s = sessionStorage.getItem('reply_sound'); if (s !== null) return s === 'true' } catch {}
    return true
  })()

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      zIndex: 30,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      pointerEvents: 'none',
      height: 64,
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        <SongPlayer
          autoPlay={autoPlay}
          onPlay={playAudio}
          onPause={pauseAudio}
        />
      </div>
    </div>
  )
}
