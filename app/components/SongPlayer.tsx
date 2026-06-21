'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ARTIST_NAME, ARTIST_URL, COVER_ART } from '@/app/lib/songs'

type Song = { title: string; url: string }

const MONO: React.CSSProperties = {
  fontFamily: "'DM Mono', ui-monospace, monospace",
  fontStyle: 'normal',
  fontWeight: 400,
  fontSize: 12,
  lineHeight: '16px',
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

  useEffect(() => {
    supabase.storage.from('audio').list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } })
      .then(({ data }) => {
        if (!data) return
        setSongs(
          data
            .filter(f => /\.(mp3|aac|m4a|ogg|wav)$/i.test(f.name))
            .map(f => ({
              title: f.name.replace(/\.[^.]+$/, '').replace(/^Chris Zabriskie\s*[-–]\s*Short Songs \d{6}\s*[-–]\s*\d{6}\s*[-–]\s*/i, ''),
              url: supabase.storage.from('audio').getPublicUrl(f.name).data.publicUrl,
            }))
        )
      })
  }, [])

  function playAt(i: number) {
    if (songs.length === 0) return
    const next = ((i % songs.length) + songs.length) % songs.length
    setIndex(next)
    setPlaying(true)
    onPlay(songs[next].url, () => playAt(next + 1))
  }

  function toggle() {
    if (playing) { onPause(); setPlaying(false) }
    else playAt(index)
  }

  if (songs.length === 0) return null
  const current = songs[index]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      background: '#fff',
      padding: '12px 20px 12px 12px',
      userSelect: 'none',
      ...style,
    }}>
      <img src={COVER_ART} alt="cover" style={{ width: 38, height: 38, objectFit: 'cover', flexShrink: 0, display: 'block' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {current.title}
        </div>
        <div style={MONO}>
          by{' '}
          <a href={ARTIST_URL} target="_blank" rel="noopener noreferrer"
            style={{ color: '#000', textDecoration: 'underline' }}>
            {ARTIST_NAME}
          </a>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
        <button style={btn} onClick={() => playAt(index - 1)}>&#9664;</button>
        <button style={btn} onClick={toggle}>{playing ? '■' : '▶'}</button>
        <button style={btn} onClick={() => playAt(index + 1)}>&#9654;</button>
      </div>
    </div>
  )
}
