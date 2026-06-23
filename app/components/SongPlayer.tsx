'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Song = { title: string; url: string }

const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "'DM Mono', ui-monospace, monospace"

export function SongPlayer({
  autoPlay = true,
  onPlay,
  onPause,
  onCollapse,
  style,
}: {
  autoPlay?: boolean
  onPlay: (url: string, onEnded: () => void) => void
  onPause: () => void
  onCollapse?: () => void
  style?: React.CSSProperties
}) {
  const [songs, setSongs] = useState<Song[]>([])
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [listOpen, setListOpen] = useState(false)

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
        if (list.length > 0 && autoPlay) {
          setIndex(0)
          setPlaying(true)
          onPlayRef.current(list[0].url, () => playAt(1))
        } else if (list.length > 0) {
          setIndex(0)
        }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    if (playing) { onPause(); setPlaying(false) }
    else playAt(index)
  }

  const current = songs[index]
  const loaded = songs.length > 0

  const circleBtn = (onClick: () => void, label: string, content: React.ReactNode) => (
    <button
      onClick={onClick}
      aria-label={label}
      disabled={!loaded}
      style={{
        width: 28, height: 28, borderRadius: '50%',
        background: '#F5F5F5', border: 'none', cursor: loaded ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => { if (loaded) (e.currentTarget as HTMLButtonElement).style.background = '#E8E8E8' }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F5' }}
    >
      {content}
    </button>
  )

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Song list popover */}
      {listOpen && (
        <>
          <div onClick={() => setListOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 28 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)',
            zIndex: 29,
            background: 'rgba(242,242,242,0.97)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            borderRadius: 16,
            width: 320,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)' }}>MUSIC BY CHRIS ZABRISKIE</span>
              <button onClick={toggle} style={{ background: '#F5F5F5', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={playing ? '/pause.svg' : '/play.svg'} alt={playing ? 'pause' : 'play'} style={{ width: 16, height: 16, display: 'block' }} />
              </button>
            </div>
            <div className="about-scroll" style={{ maxHeight: 320, overflowY: 'auto', paddingBottom: 8 }}>
              {songs.map((song, i) => (
                <button
                  key={i}
                  onClick={() => { playAt(i); setListOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '10px 20px',
                    background: i === index ? 'rgba(0,0,0,0.06)' : 'none',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (i !== index) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)' }}
                  onMouseLeave={e => { if (i !== index) (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 11, color: i === index && playing ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)', flexShrink: 0, width: 10 }}>
                    {i === index && playing ? '▶' : '▶'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: i === index ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {song.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Player bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 16, userSelect: 'none', padding: 0,
        ...style,
      }}>
        {/* Play/pause */}
        {false && circleBtn(toggle, playing ? 'pause' : 'play', <img src={playing ? '/pause.svg' : '/play.svg'} alt="" style={{ width: 16, height: 16, display: 'block' }} />)}

        {/* Title + shuffle */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <button
            onClick={() => loaded && setListOpen(o => !o)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: loaded ? 'pointer' : 'default',
              fontFamily: SERIF, fontSize: 14, lineHeight: 1.15,
              color: loaded ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.2)',
              whiteSpace: 'nowrap',
            }}
          >
            {loaded ? current.title : '…'}
          </button>
          <button
            onClick={() => playAt(Math.floor(Math.random() * songsRef.current.length))}
            disabled={!loaded}
            style={{ background: 'none', border: 'none', cursor: loaded ? 'pointer' : 'default', padding: 0, fontFamily: SERIF, fontSize: 14, color: 'rgba(0,0,0,0.4)', lineHeight: 1.15 }}
          >Shuffle</button>
        </div>
      </div>
    </div>
  )
}
