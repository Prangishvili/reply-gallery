'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ARTIST_NAME, ARTIST_URL, COVER_ART } from '@/app/lib/songs'

type Song = { title: string; url: string }

const MONO: React.CSSProperties = {
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 11,
  lineHeight: '14px',
  color: '#000000',
}

const btn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: '0 3px', fontSize: 9, color: 'rgba(0,0,0,0.45)', lineHeight: 1,
}

export function SongPlayer({
  onPlay,
  onPause,
  style,
}: {
  onPlay: (url: string, onEnded: () => void) => void
  onPause: () => void
  style?: React.CSSProperties
}) {
  const [songs, setSongs] = useState<Song[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Refs avoid stale closures in auto-advance callbacks
  const songsRef = useRef<Song[]>([])
  const onPlayRef = useRef(onPlay)
  onPlayRef.current = onPlay

  function playAt(i: number) {
    const list = songsRef.current
    if (list.length === 0) return
    const next = ((i % list.length) + list.length) % list.length
    setIndex(next)
    setPlaying(true)
    onPlayRef.current(list[next].url, () => playAt(next + 1))
  }

  useEffect(() => {
    supabase.storage.from('audio').list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } })
      .then(({ data }) => {
        if (!data) return
        const list = data
          .filter(f => /\.(mp3|aac|m4a|ogg|wav)$/i.test(f.name))
          .map(f => ({
            title: f.name.replace(/\.[^.]+$/, '').replace(/^Chris Zabriskie\s*[-–]\s*Short Songs \d{6}\s*[-–]\s*\d{6}\s*[-–]\s*/i, ''),
            url: supabase.storage.from('audio').getPublicUrl(f.name).data.publicUrl,
          }))
        songsRef.current = list
        setSongs(list)
        // Auto-play first track on mount (component only mounts after user enters gallery)
        if (list.length > 0) {
          setIndex(0)
          setPlaying(true)
          onPlayRef.current(list[0].url, () => playAt(1))
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    if (playing) { onPause(); setPlaying(false) }
    else playAt(index)
  }

  const current = songs[index]
  const loaded = songs.length > 0

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
      background: '#fff',
      padding: '12px 20px 12px 12px',
      userSelect: 'none',
      ...style,
    }}>
      <img src={COVER_ART} alt="cover" style={{ width: 24, height: 24, objectFit: 'cover', flexShrink: 0, display: 'block' }} />
      <div style={{ ...MONO, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: loaded ? '#000' : 'rgba(0,0,0,0.3)' }}>
        {loaded ? (
          <>
            {current.title}
            <span style={{ opacity: 0.45 }}> by </span>
            <a href={ARTIST_URL} target="_blank" rel="noopener noreferrer"
              style={{ color: '#000', textDecoration: 'underline' }}>
              {ARTIST_NAME}
            </a>
          </>
        ) : '…'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <button style={btn} onClick={() => playAt(index - 1)} disabled={!loaded}>&#9664;</button>
        <button style={btn} onClick={toggle} disabled={!loaded}>{playing ? '■' : '▶'}</button>
        <button style={btn} onClick={() => playAt(index + 1)} disabled={!loaded}>&#9654;</button>
      </div>
    </div>
  )
}
