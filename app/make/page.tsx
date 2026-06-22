'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { STUDENTS } from '@/app/lib/gallery-shared'
import { pauseAudio } from '@/app/lib/audio-manager'

const Scene = dynamic(() => import('./scene'), { ssr: false })

const CANVAS_RATIO = 830 / 1020
const mono: React.CSSProperties = { fontFamily: 'var(--font-dm-mono)', fontSize: 11 }
const btn: React.CSSProperties = { ...mono, cursor: 'pointer', background: 'none', border: 'none', color: 'rgba(0,0,0,0.45)', padding: '0 4px' }
const btnOn: React.CSSProperties = { ...btn, color: 'rgba(0,0,0,0.85)', fontWeight: 600 }

export default function MakePage() {
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [size, setSize] = useState(0.08)
  const [repeat, setRepeat] = useState(5)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [shuffleSeed, setShuffleSeed] = useState(0)
const [layersOpen, setLayersOpen] = useState(false)
  useEffect(() => { pauseAudio() }, [])

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarH, setToolbarH] = useState(160)
  useEffect(() => {
    if (!isMobile || !toolbarRef.current) return
    const ro = new ResizeObserver(() => setToolbarH(toolbarRef.current!.offsetHeight))
    ro.observe(toolbarRef.current)
    return () => ro.disconnect()
  }, [isMobile])

  // Save modal
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [uploadToGallery, setUploadToGallery] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const captureRef = useRef<(() => string) | null>(null)
  const frozenDataUrl = useRef<string | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  // Music player
  const [musicOpen, setMusicOpen] = useState(false)
  const [musicSongs, setMusicSongs] = useState<{ title: string; url: string }[]>([])
  const [musicSongsLoaded, setMusicSongsLoaded] = useState(false)
  const [musicIndex, setMusicIndex] = useState(-1)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [audioSrcModal, setAudioSrcModal] = useState(false)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const musicAnalyserRef = useRef<AnalyserNode | null>(null)
  const makeMusicRef = useRef<HTMLAudioElement | null>(null)
  const musicAudioCtxRef = useRef<AudioContext | null>(null)
  const musicBlobUrlsRef = useRef<string[]>([])
  const musicSongsRef = useRef<{ title: string; url: string }[]>([])
  const musicIdxRef = useRef(-1)
  const musicPlayingRef = useRef(false)
  musicSongsRef.current = musicSongs
  musicIdxRef.current = musicIndex
  musicPlayingRef.current = musicPlaying

  const loadMusicSongs = async () => {
    const { data } = await supabase.storage.from('audio').list('', { limit: 200, sortBy: { column: 'name', order: 'asc' } })
    if (!data) return
    const list = data
      .filter(f => /\.(mp3|aac|m4a|ogg|wav)$/i.test(f.name))
      .map(f => ({
        title: f.name.replace(/\.[^.]+$/, '').replace(/^Chris Zabriskie\s*[-–]\s*Short Songs \d{6}\s*[-–]\s*\d{6}\s*[-–]\s*/i, ''),
        url: supabase.storage.from('audio').getPublicUrl(f.name).data.publicUrl,
      }))
    musicSongsRef.current = list
    setMusicSongs(list)
    setMusicSongsLoaded(true)
  }

  const playMusicAt = (i: number) => {
    const songs = musicSongsRef.current
    if (songs.length === 0) return
    const next = ((i % songs.length) + songs.length) % songs.length
    if (!makeMusicRef.current) {
      // Create audio element and wire into Web Audio so analyserRef picks up the signal
      const audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.volume = 0.7
      makeMusicRef.current = audio
      try {
        const ctx = new AudioContext()
        const source = ctx.createMediaElementSource(audio)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.8
        source.connect(analyser)
        analyser.connect(ctx.destination)
        musicAudioCtxRef.current = ctx
        musicAnalyserRef.current = analyser
        if (micAnalyserRef.current) {
          setAudioSrcModal(true)
        } else {
          analyserRef.current = analyser
        }
        ctx.resume().catch(() => {})
      } catch {}
    }
    musicAudioCtxRef.current?.resume().catch(() => {})
    const audio = makeMusicRef.current
    audio.onended = () => playMusicAt(next + 1)
    if (musicIdxRef.current === next) {
      if (musicPlayingRef.current) { audio.pause(); setMusicPlaying(false) }
      else { audio.play().catch(() => {}); setMusicPlaying(true) }
    } else {
      audio.src = songs[next].url
      audio.play().catch(() => {})
      setMusicIndex(next)
      setMusicPlaying(true)
    }
  }

  const handleMusicUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    const url = URL.createObjectURL(file)
    musicBlobUrlsRef.current.push(url)
    const title = file.name.replace(/\.[^.]+$/, '')
    const newList = [...musicSongsRef.current, { title, url }]
    musicSongsRef.current = newList
    setMusicSongs(newList)
    playMusicAt(newList.length - 1)
  }

  useEffect(() => {
    return () => {
      makeMusicRef.current?.pause()
      musicAudioCtxRef.current?.close().catch(() => {})
      musicBlobUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
    }
  }, [])

  const [studentOpen, setStudentOpen] = useState(false)
  const [loadingStudent, setLoadingStudent] = useState<string | null>(null)

  async function loadStudentImages(name: string) {
    setLoadingStudent(name)
    setStudentOpen(false)
    const { data } = await supabase.from('posts').select('image_url').eq('student_name', name)
    if (data && data.length > 0) setImageUrls(data.map(p => p.image_url))
    setLoadingStudent(null)
  }

  const toggleCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      micStreamRef.current = null
      audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
      micAnalyserRef.current = null
      analyserRef.current = musicAnalyserRef.current
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        setCameraStream(stream)
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          micStreamRef.current = mic
          const ctx = new AudioContext()
          const source = ctx.createMediaStreamSource(mic)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          analyser.smoothingTimeConstant = 0.8
          source.connect(analyser)
          audioCtxRef.current = ctx
          micAnalyserRef.current = analyser
          if (musicAnalyserRef.current) {
            setAudioSrcModal(true)
          } else {
            analyserRef.current = analyser
          }
          ctx.resume().catch(() => {})
        } catch { /* mic denied — camera still works */ }
      } catch { /* camera denied */ }
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const urls = Array.from(files).map(f => URL.createObjectURL(f))
    setImageUrls(prev => [...prev, ...urls])
  }

  const openModal = () => {
    frozenDataUrl.current = captureRef.current?.() ?? null
    setPreviewDataUrl(frozenDataUrl.current)
    setSaved(false)
    setUploadError(null)
    setModal(true)
  }
  const closeModal = () => setModal(false)

  // Crop full-screen capture to CANVAS_RATIO (centered) and flatten transparency against bgColor
  const cropToRatio = (rawDataUrl: string): Promise<string> =>
    new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const cw = img.width, ch = img.height
        let cropW = ch * CANVAS_RATIO, cropH = ch
        if (cropW > cw) { cropW = cw; cropH = cw / CANVAS_RATIO }
        const x = (cw - cropW) / 2, y = (ch - cropH) / 2
        const OUT_W = 830 * 2, OUT_H = 1020 * 2
        const out = document.createElement('canvas')
        out.width = OUT_W; out.height = OUT_H
        const ctx = out.getContext('2d')!
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, OUT_W, OUT_H)
        ctx.drawImage(img, x, y, cropW, cropH, 0, 0, OUT_W, OUT_H)
        resolve(out.toDataURL('image/png'))
      }
      img.src = rawDataUrl
    })

  const handleShareDownload = async () => {
    const rawDataUrl = frozenDataUrl.current
    if (!rawDataUrl) return
    setSaving(true)

    const dataUrl = await cropToRatio(rawDataUrl)

    // Download
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'reply-artwork.png'
    a.click()

    // Upload to gallery if opted in
    if (uploadToGallery) {
      try {
        const blob = await fetch(dataUrl).then(r => r.blob())
        const file = new File([blob], 'artwork.png', { type: 'image/png' })
        const fd = new FormData()
        fd.append('image', file)
        fd.append('visitor_name', name.trim() || 'UNKNOWN')
        const res = await fetch('/api/visitor-posts', { method: 'POST', body: fd })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setSaving(false)
          setUploadError(body.error ?? `Upload failed (${res.status})`)
          return
        }
      } catch {
        setSaving(false)
        setUploadError('Network error — upload failed')
        return
      }
    }

    setSaving(false)
    setSaved(true)
  }

  return (
    <>
      <Link href="/circle" style={{
        position: 'fixed', top: 24, left: 24, zIndex: 20,
        textDecoration: 'none', lineHeight: 1,
      }}>
        <img src="/arrow.svg" alt="back" style={{ height: 20, width: 'auto', opacity: 0.45 }} />
      </Link>

      <style>{`
        *, *::before, *::after, canvas { cursor: default !important; }
        .toolbar-scroll::-webkit-scrollbar { display: none; }
        button, input[type="color"], input[type="range"], .make-clickable { cursor: pointer !important; }
        input[type="range"] { -webkit-appearance: none; appearance: none; background: transparent; height: 14px; }
        input[type="range"]::-webkit-slider-runnable-track { background: #d4d4d4; height: 2px; border-radius: 1px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px; border-radius: 50%; background: #555; margin-top: -5.5px; cursor: pointer; }
        input[type="range"]::-moz-range-track { background: #d4d4d4; height: 2px; border-radius: 1px; border: none; }
        input[type="range"]::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; background: #555; border: none; cursor: pointer; }
        input[type="color"] { border: none; outline: none; padding: 0; border-radius: 2px; }
        input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
        input[type="color"]::-webkit-color-swatch { border: 1px solid rgba(0,0,0,0.15); border-radius: 2px; }
      `}</style>

      {/* Canvas — full-screen on desktop, page card on mobile */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: isMobile ? toolbarH : 0 }}>
        <Scene imageUrls={imageUrls} size={size} repeat={repeat} shuffleSeed={shuffleSeed} bgColor={bgColor} bgImage={bgImage} cameraStream={cameraStream} captureRef={captureRef} analyserRef={analyserRef} />
      </div>

      {/* Crop guide — desktop only */}
      {!isMobile && (
        <div style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 5,
        }}>
          <div style={{
            aspectRatio: `830 / 1020`,
            height: '100%', maxWidth: '100%', maxHeight: '100%',
            border: '1px dashed rgba(0,0,0,0.18)',
            boxSizing: 'border-box',
          }} />
        </div>
      )}

      {/* Layers panel */}
      {layersOpen && imageUrls.length > 0 && (
        <div onClick={() => setLayersOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8 }} />
      )}
      {layersOpen && imageUrls.length > 0 && (
        <div onClick={e => e.stopPropagation()} style={{
          ...(isMobile
            ? { position: 'fixed', bottom: toolbarH + 8, left: '50%', transform: 'translateX(-50%)' }
            : { position: 'fixed', bottom: 108, left: '50%', transform: 'translateX(-50%)' }),
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
          padding: '14px 16px', zIndex: 9,
          maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 40px)', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 32 }}>
            <span style={{ ...mono, color: 'rgba(0,0,0,0.4)' }}>layers ({imageUrls.length})</span>
            <button onClick={() => { setImageUrls([]); setLayersOpen(false) }} style={btn}>clear all</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 72px)', gap: 8, maxHeight: 312, overflowY: 'auto' }}>
            {imageUrls.map((url, i) => (
              <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden' }}>
                <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => setImageUrls(prev => prev.filter((_, j) => j !== i))}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.65)', border: 'none',
                    color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Music panel */}
      {musicOpen && (
        <div onClick={() => setMusicOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8 }} />
      )}
      {musicOpen && (
        <div onClick={e => e.stopPropagation()} style={{
          ...(isMobile
            ? { position: 'fixed', bottom: toolbarH + 8, left: '50%', transform: 'translateX(-50%)' }
            : { position: 'fixed', bottom: 108, left: '50%', transform: 'translateX(-50%)' }),
          background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,0,0,0.08)', borderRadius: 10,
          width: 320, maxWidth: 'calc(100vw - 32px)',
          maxHeight: 360, display: 'flex', flexDirection: 'column', zIndex: 9,
        }}>
          <div style={{ ...mono, padding: '12px 16px 8px', color: 'rgba(0,0,0,0.35)', fontSize: 10, letterSpacing: '0.1em', flexShrink: 0 }}>MUSIC</div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {!musicSongsLoaded && <div style={{ ...mono, padding: '8px 16px', color: 'rgba(0,0,0,0.3)' }}>loading…</div>}
            {musicSongsLoaded && musicSongs.length === 0 && <div style={{ ...mono, padding: '8px 16px', color: 'rgba(0,0,0,0.3)' }}>no songs yet</div>}
            {musicSongs.map((song, i) => (
              <div
                key={song.url}
                onClick={() => playMusicAt(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: 'pointer',
                  background: musicIndex === i ? 'rgba(0,0,0,0.04)' : 'none',
                }}
                onMouseEnter={e => { if (musicIndex !== i) e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
                onMouseLeave={e => { if (musicIndex !== i) e.currentTarget.style.background = 'none' }}
              >
                <span style={{ ...mono, fontSize: 9, color: 'rgba(0,0,0,0.35)', flexShrink: 0, width: 10, textAlign: 'center' }}>
                  {musicIndex === i && musicPlaying ? '■' : '▶'}
                </span>
                <span style={{ ...mono, fontSize: 10, color: 'rgba(0,0,0,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.title}
                </span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <label className="make-clickable" style={{ ...btn, color: 'rgba(0,0,0,0.55)' }}>
              + add song
              <input
                type="file"
                accept=".mp3,.aac,.m4a,.ogg,.wav,audio/*"
                style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                onChange={e => { handleMusicUpload(e.target.files); e.target.value = '' }}
              />
            </label>
          </div>
        </div>
      )}

      {/* Controls */}
      {isMobile ? (
        /* Mobile: vertical bottom panel */
        <div ref={toolbarRef} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', padding: '10px 16px', gap: 8, zIndex: 10, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
          {/* Camera + Music + Save row */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={toggleCamera} style={{
              ...mono, cursor: 'pointer', flex: 1,
              background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 6, padding: '11px 12px',
              color: cameraStream ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', fontWeight: cameraStream ? 600 : 400,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>
              {'camera'}
            </button>
            <button onClick={() => { setMusicOpen(o => !o); if (!musicSongsLoaded) loadMusicSongs() }} style={{
              ...mono, cursor: 'pointer', flex: 1,
              background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 6, padding: '11px 12px',
              color: musicOpen ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', fontWeight: musicOpen ? 600 : 400,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>music</button>
            <button onClick={openModal} style={{
              ...mono, cursor: 'pointer', flex: 1,
              background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 6, padding: '11px 12px', color: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            }}>publish</button>
          </div>

          {/* Main controls pill */}
          <div style={{
            background: 'rgba(255,255,255,0.78)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6, padding: '14px 16px',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column', gap: 13,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, ...mono, color: 'rgba(0,0,0,0.4)', flexShrink: 0, paddingTop: 2 }}>
                <span>Color</span>
                <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgImage(null) }} style={{ width: 22, height: 16 }} />
              </label>
              {(imageUrls.length > 0 || cameraStream) && (<>
                <label style={{ flex: 1, ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>size</span><span style={{ opacity: 0.7 }}>{size.toFixed(2)}</span>
                  </span>
                  <input type="range" min={0.01} max={0.3} step={0.005} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: '100%' }} />
                </label>
                <label style={{ flex: 1, ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>repeat</span><span style={{ opacity: 0.7 }}>{repeat}</span>
                  </span>
                  <input type="range" min={1} max={99} step={1} value={repeat} onChange={e => setRepeat(Number(e.target.value))} style={{ width: '100%' }} />
                </label>
              </>)}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label className="make-clickable" style={{ ...btn }}>
                {bgImage ? 'change bg' : '+ bg image'}
                <input type="file" accept="image/*" style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setBgImage(URL.createObjectURL(f)); e.target.value = '' }} />
              </label>
              {bgImage && <button onClick={() => setBgImage(null)} style={btn}>remove bg</button>}
                <label style={{ ...btn }}>
                + upload
                <input type="file" accept="image/*" multiple style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
              </label>
              {imageUrls.length > 0 && <button onClick={() => setShuffleSeed(s => s + 1)} style={btn}>shuffle</button>}
              {imageUrls.length > 0 && <button onClick={() => setLayersOpen(o => !o)} style={layersOpen ? btnOn : btn}>layers</button>}
              <button onClick={() => setStudentOpen(o => !o)} style={studentOpen ? btnOn : btn}>
                {loadingStudent ? 'loading…' : 'artist'}
              </button>
              {studentOpen && (
                <>
                  <div onClick={() => setStudentOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8 }} />
                  <div style={{
                    position: 'fixed', bottom: toolbarH + 8, left: 16, zIndex: 9,
                    background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 8, padding: '8px 0',
                    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                    minWidth: 200,
                  }}>
                    {STUDENTS.map(name => (
                      <button key={name} onClick={() => loadStudentImages(name)} style={{
                        ...mono, cursor: 'pointer', display: 'block', width: '100%',
                        textAlign: 'left', padding: '8px 16px',
                        background: 'none', border: 'none', color: 'rgba(0,0,0,0.75)',
                      }}>{name}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Desktop: horizontal bottom toolbar */
        <div className="toolbar-scroll" style={{ position: 'fixed', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10, paddingInline: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>

          {/* Camera pill */}
          <button onClick={toggleCamera} style={{
            ...mono, cursor: 'pointer',
            background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6, padding: '20px 24px', whiteSpace: 'nowrap',
            color: cameraStream ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', fontWeight: cameraStream ? 600 : 400,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>
            {'camera'}
          </button>

          {/* Main toolbar */}
          <div style={{
            display: 'flex', gap: 20, alignItems: 'center',
            background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6, padding: '20px 24px', whiteSpace: 'nowrap',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.4)' }}>
              Color
              <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgImage(null) }} style={{ width: 24, height: 18 }} />
            </label>
            {(imageUrls.length > 0 || cameraStream) && (<>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.4)' }}>
                size
                <input type="range" min={0.01} max={0.3} step={0.005} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: 90 }} />
                {size.toFixed(3)}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.4)' }}>
                repeat
                <input type="range" min={1} max={99} step={1} value={repeat} onChange={e => setRepeat(Number(e.target.value))} style={{ width: 90 }} />
                {repeat}
              </label>
            </>)}
            <label className="make-clickable" style={{ ...btn, display: 'inline-block' }}>
              {bgImage ? 'change bg image' : '+ bg image'}
              <input type="file" accept="image/*" style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setBgImage(URL.createObjectURL(f)); e.target.value = '' }} />
            </label>
            {bgImage && <button onClick={() => setBgImage(null)} style={btn}>remove bg</button>}
            <label style={{ ...btn, display: 'inline-block' }}>
              + upload images
              <input type="file" accept="image/*" multiple style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
            </label>
            {imageUrls.length > 0 && <button onClick={() => setShuffleSeed(s => s + 1)} style={btn}>shuffle</button>}
            {imageUrls.length > 0 && <button onClick={() => setLayersOpen(o => !o)} style={layersOpen ? btnOn : btn}>layers</button>}
          </div>

          {/* Music pill */}
          <button onClick={() => { setMusicOpen(o => !o); if (!musicSongsLoaded) loadMusicSongs() }} style={{
            ...mono, cursor: 'pointer',
            background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6, padding: '20px 24px', whiteSpace: 'nowrap',
            color: musicOpen ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', fontWeight: musicOpen ? 600 : 400,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>music</button>

          {/* Student pill */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setStudentOpen(o => !o)} style={{
              ...mono, cursor: 'pointer',
              background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: 6, padding: '20px 24px', color: studentOpen ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              fontWeight: studentOpen ? 600 : 400,
            }}>
              {loadingStudent ? `loading…` : 'artist'}
            </button>
            {studentOpen && (
              <>
                <div onClick={() => setStudentOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8 }} />
                <div style={{
                  position: 'fixed', bottom: 108, left: '50%', transform: 'translateX(-50%)',
                  zIndex: 9,
                  background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 8, padding: '8px 0',
                  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                  minWidth: 200,
                }}>
                  {STUDENTS.map(name => (
                    <button key={name} onClick={() => loadStudentImages(name)} style={{
                      ...mono, cursor: 'pointer', display: 'block', width: '100%',
                      textAlign: 'left', padding: '8px 16px',
                      background: 'none', border: 'none', color: 'rgba(0,0,0,0.75)',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >{name}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Save pill */}
          <button onClick={openModal} style={{
            ...mono, cursor: 'pointer',
            background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 6, padding: '20px 24px', color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>publish</button>

        </div>
        </div>
      )}

      {/* Save modal */}
      {modal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: '32px 36px', width: 520, display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--font-dm-mono)' }}>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.1em', color: '#222' }}>SAVE ARTWORK</p>

            {/* Preview */}
            {previewDataUrl && (
              <div style={{ width: '100%', aspectRatio: `${830 / 1020}`, overflow: 'hidden', borderRadius: 4, border: '1px solid rgba(0,0,0,0.08)' }}>
                <img src={previewDataUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)' }}>YOUR NAME</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Name"
                style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '7px 10px', outline: 'none', color: '#333' }}
              />
            </div>

            {/* Gallery checkbox */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}>
              <input type="checkbox" checked={uploadToGallery} onChange={e => setUploadToGallery(e.target.checked)} style={{ width: 14, height: 14 }} />
              Upload artwork to Reply Gallery
            </label>

            {uploadError && (
              <p style={{ margin: 0, fontSize: 10, color: '#c0392b', letterSpacing: '0.05em' }}>{uploadError}</p>
            )}

            {saved ? (
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(0,0,0,0.4)', textAlign: 'center', letterSpacing: '0.1em' }}>
                ✓ {uploadToGallery ? 'Downloaded & uploaded to gallery' : 'Downloaded'}
              </p>
            ) : (
              <button
                onClick={handleShareDownload}
                disabled={saving}
                style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer', padding: '11px 0', textAlign: 'center', opacity: saving ? 0.5 : 1, background: '#000', color: '#fff', border: 'none', borderRadius: 4 }}
              >
                {saving ? 'saving...' : 'SHARE & DOWNLOAD'}
              </button>
            )}

            <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 10, color: 'rgba(0,0,0,0.3)', letterSpacing: '0.15em', padding: 0, alignSelf: 'center' }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
      {/* Audio source picker */}
      {audioSrcModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--font-dm-mono)', width: 300 }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.12em', color: 'rgba(0,0,0,0.5)', textAlign: 'center' }}>WHAT SHOULD IMAGES REACT TO?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { analyserRef.current = micAnalyserRef.current; setAudioSrcModal(false) }}
                style={{ flex: 1, ...mono, cursor: 'pointer', padding: '12px 0', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: 'none', color: 'rgba(0,0,0,0.75)', fontSize: 11 }}
              >Mic</button>
              <button
                onClick={() => { analyserRef.current = musicAnalyserRef.current; setAudioSrcModal(false) }}
                style={{ flex: 1, ...mono, cursor: 'pointer', padding: '12px 0', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: 'none', color: 'rgba(0,0,0,0.75)', fontSize: 11 }}
              >Music</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
