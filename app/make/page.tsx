'use client'

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { STUDENTS } from '@/app/lib/gallery-shared'
import { crumb, debugEnabled } from '@/app/lib/crash-log'
import { onAudioReady, getAudioAnalyser } from '@/app/lib/audio-manager'

const Scene = dynamic(() => import('./scene'), { ssr: false })
const DebugOverlay = dynamic(() => import('@/app/components/DebugOverlay').then(m => ({ default: m.DebugOverlay })), { ssr: false })

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
  const [bgVideo, setBgVideo] = useState<string | null>(null)
  const [bgSize, setBgSize] = useState(1.0)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [shuffleSeed, setShuffleSeed] = useState(0)
  const [sizeRandomize, setSizeRandomize] = useState(false)
  const [drift, setDrift] = useState(false)
  const [driftSpeed, setDriftSpeed] = useState(0.5)
  const [driftAmp, setDriftAmp] = useState(1.0)
  const [layersOpen, setLayersOpen] = useState(false)
  const [sizeOpen, setSizeOpen] = useState(false)

  const [showDebug] = useState(() => debugEnabled())
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const dm = (navigator as unknown as { deviceMemory?: number }).deviceMemory
    crumb(`=== make page mount === vp ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio} mem ${dm ?? '?'}GB`)
    const params = new URLSearchParams(window.location.search)
    if (params.get('admin') === 'true') setIsAdmin(true)
    const url = params.get('image')
    if (url) setImageUrls([decodeURIComponent(url)])
    const artist = params.get('artist')
    if (artist) loadStudentImages(decodeURIComponent(artist))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!toolbarRef.current) return
    const ro = new ResizeObserver(() => { if (toolbarRef.current) setToolbarH(toolbarRef.current.offsetHeight) })
    ro.observe(toolbarRef.current)
    return () => ro.disconnect()
  }, [])

  // Save modal
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('')
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [uploadToGallery, setUploadToGallery] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const captureRef = useRef<(() => string) | null>(null)
  const recordRef = useRef<{ start: () => void; stop: () => void } | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const frozenDataUrl = useRef<string | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  const [audioSrcModal, setAudioSrcModal] = useState(false)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)

  // Wire analyserRef to the shared top player (audio-manager singleton)
  useEffect(() => onAudioReady(analyser => { analyserRef.current = analyser }), [])

  const [studentOpen, setStudentOpen] = useState(false)
  const [loadingStudent, setLoadingStudent] = useState<string | null>(null)

  async function loadStudentImages(name: string) {
    setLoadingStudent(name)
    setStudentOpen(false)
    crumb(`loadStudentImages: query "${name}"`)
    const { data, error } = await supabase.from('posts').select('image_url').eq('student_name', name)
    crumb(`loadStudentImages: got ${data?.length ?? 0} rows${error ? ' ERR ' + error.message : ''}`)
    if (data && data.length > 0) {
      const isMob = typeof window !== 'undefined' && window.innerWidth < 768
      const urls = data.map(p => p.image_url).slice(0, isMob ? 30 : data.length)
      crumb(`loadStudentImages: setImageUrls ${urls.length} (mobile=${isMob})`)
      setImageUrls(urls)
    }
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
      analyserRef.current = getAudioAnalyser()
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
          if (getAudioAnalyser()) {
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
    const MAX_FILE_MB = isMobile ? 15 : Infinity
    const MAX_UPLOADS = isMobile ? 80 : Infinity
    const allowed = Array.from(files).filter(f => f.type.startsWith('video/') || f.size <= MAX_FILE_MB * 1024 * 1024)
    const urls = allowed.map(f => URL.createObjectURL(f))
    setImageUrls(prev => {
      const slots = Math.max(0, MAX_UPLOADS - prev.length)
      return [...prev, ...urls.slice(0, slots)]
    })
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
        const OUT_W = 830 * 3, OUT_H = 1020 * 3
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
      {showDebug && <DebugOverlay />}
      <Link href="/circle" style={{
        position: 'fixed', top: 24, left: 24, zIndex: 20,
        textDecoration: 'none', lineHeight: 1,
      }}>
        <img src="/arrow-back.svg" alt="back" style={{ height: 20, width: 'auto', opacity: 0.45 }} />
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Scene imageUrls={imageUrls} size={size} repeat={repeat} shuffleSeed={shuffleSeed} sizeRandomize={sizeRandomize} drift={drift} driftSpeed={driftSpeed} driftAmp={driftAmp} bgColor={bgColor} bgImage={bgImage} bgVideo={bgVideo} bgSize={bgSize} cameraStream={cameraStream} captureRef={captureRef} recordRef={recordRef} analyserRef={analyserRef} />
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
          position: 'fixed', bottom: toolbarH + 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(242,242,242,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: 'none', borderRadius: 10,
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


      {/* Size / repeat popup */}
      {sizeOpen && (imageUrls.length > 0 || cameraStream) && (
        <div onClick={() => setSizeOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 8 }} />
      )}
      {sizeOpen && (imageUrls.length > 0 || cameraStream) && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'fixed', bottom: toolbarH + 32, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(242,242,242,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: 'none', borderRadius: 10,
          padding: '16px 20px', zIndex: 9, width: 260, maxWidth: 'calc(100vw - 32px)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <label style={{ ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>size</span><span style={{ opacity: 0.7 }}>{size.toFixed(2)}</span>
            </span>
            <input type="range" min={0.01} max={0.3} step={0.005} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          {isAdmin && (bgImage || bgVideo) && (
            <label style={{ ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>bg size</span><span style={{ opacity: 0.7 }}>{bgSize.toFixed(2)}</span>
              </span>
              <input type="range" min={0.1} max={3} step={0.05} value={bgSize} onChange={e => setBgSize(Number(e.target.value))} style={{ width: '100%' }} />
            </label>
          )}
          <label style={{ ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>repeat</span><span style={{ opacity: 0.7 }}>{repeat}</span>
            </span>
            <input type="range" min={1} max={isMobile ? 20 : 99} step={1} value={repeat} onChange={e => setRepeat(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...mono, color: 'rgba(0,0,0,0.4)' }}>randomize size</span>
            <button onClick={() => { setSizeRandomize(o => !o); if (!sizeRandomize) setShuffleSeed(s => s + 1) }} style={sizeRandomize ? btnOn : btn}>
              {sizeRandomize ? 'on' : 'off'}
            </button>
          </div>
          {isAdmin && <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ ...mono, color: 'rgba(0,0,0,0.4)' }}>drift</span>
              <button onClick={() => setDrift(o => !o)} style={drift ? btnOn : btn}>
                {drift ? 'on' : 'off'}
              </button>
            </div>
            {drift && <>
              <label style={{ ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>drift speed</span><span style={{ opacity: 0.7 }}>{driftSpeed.toFixed(2)}</span>
                </span>
                <input type="range" min={0.05} max={3} step={0.05} value={driftSpeed} onChange={e => setDriftSpeed(Number(e.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ ...mono, color: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>drift amount</span><span style={{ opacity: 0.7 }}>{driftAmp.toFixed(2)}</span>
                </span>
                <input type="range" min={0.1} max={5} step={0.1} value={driftAmp} onChange={e => setDriftAmp(Number(e.target.value))} style={{ width: '100%' }} />
              </label>
            </>}
          </>}
        </div>
      )}

      {/* Artist popup */}
      {studentOpen && (
        <div onClick={() => setStudentOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 11 }} />
      )}
      {studentOpen && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'fixed', bottom: toolbarH + 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 12,
          background: 'rgba(242,242,242,0.97)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: 'none',
          borderRadius: 8, padding: '8px 0', minWidth: 200,
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
      )}

      {/* Controls — unified horizontal scrollable row */}
      <div ref={toolbarRef} className="toolbar-scroll" style={{ position: 'fixed', bottom: 24, left: 0, right: 0, display: 'flex', justifyContent: isMobile ? 'flex-start' : 'center', zIndex: 10, paddingInline: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>

          {/* Camera pill */}
          <button onClick={toggleCamera} style={{
            ...mono, cursor: 'pointer',
            background: 'rgba(247,247,247,0.82)', border: 'none',
            borderRadius: 9999, padding: '20px 24px', whiteSpace: 'nowrap',
            color: cameraStream ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', fontWeight: cameraStream ? 600 : 400,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>camera</button>

          {/* Main toolbar pill */}
          <div style={{
            display: 'flex', gap: 20, alignItems: 'center',
            background: 'rgba(247,247,247,0.82)', border: 'none',
            borderRadius: 9999, padding: '20px 24px', whiteSpace: 'nowrap',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.4)' }}>
              Color
              <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgImage(null); setBgVideo(null) }} style={{ width: 24, height: 18 }} />
            </label>
            <label className="make-clickable" style={{ ...btn, display: 'inline-block' }}>
              {bgImage || bgVideo ? 'change bg' : '+ bg'}
              <input type="file" accept="image/*,video/*" style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => {
                const f = e.target.files?.[0]; if (!f) return
                const url = URL.createObjectURL(f)
                if (f.type.startsWith('video/')) { setBgVideo(url); setBgImage(null) }
                else { setBgImage(url); setBgVideo(null) }
                e.target.value = ''
              }} />
            </label>
            {(bgImage || bgVideo) && <button onClick={() => { setBgImage(null); setBgVideo(null) }} style={btn}>remove bg</button>}
            <label style={{ ...btn, display: 'inline-block' }}>
              + upload images
              <input type="file" accept="image/*,video/*" multiple style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
            </label>
            {(imageUrls.length > 0 || cameraStream) && <button onClick={() => setSizeOpen(o => !o)} style={sizeOpen ? btnOn : btn}>size</button>}
            {imageUrls.length > 0 && <button onClick={() => setShuffleSeed(s => s + 1)} style={btn}>shuffle</button>}
            {imageUrls.length > 0 && <button onClick={() => setLayersOpen(o => !o)} style={layersOpen ? btnOn : btn}>layers</button>}
          </div>

          {/* Artist pill */}
          <button onClick={() => setStudentOpen(o => !o)} style={{
            ...mono, cursor: 'pointer',
            background: 'rgba(247,247,247,0.82)', border: 'none',
            borderRadius: 9999, padding: '20px 24px', whiteSpace: 'nowrap',
            color: studentOpen ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)', fontWeight: studentOpen ? 600 : 400,
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>
            {loadingStudent ? 'loading…' : 'artist'}
          </button>

          {/* Record pill — admin only */}
          {isAdmin && <button onClick={() => {
            if (isRecording) { recordRef.current?.stop(); setIsRecording(false) }
            else { recordRef.current?.start(); setIsRecording(true) }
          }} style={{
            ...mono, cursor: 'pointer',
            background: isRecording ? 'rgba(200,0,0,0.08)' : 'rgba(247,247,247,0.82)', border: 'none',
            borderRadius: 9999, padding: '20px 24px', whiteSpace: 'nowrap',
            color: isRecording ? 'rgba(200,0,0,0.8)' : 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>{isRecording ? '● stop' : 'record'}</button>}

          {/* Publish pill */}
          <button onClick={openModal} style={{
            ...mono, cursor: 'pointer',
            background: 'rgba(247,247,247,0.82)', border: 'none',
            borderRadius: 9999, padding: '20px 24px', whiteSpace: 'nowrap', color: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          }}>publish</button>

        </div>
      </div>

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
                onClick={() => { analyserRef.current = getAudioAnalyser(); setAudioSrcModal(false) }}
                style={{ flex: 1, ...mono, cursor: 'pointer', padding: '12px 0', borderRadius: 6, border: '1px solid rgba(0,0,0,0.12)', background: 'none', color: 'rgba(0,0,0,0.75)', fontSize: 11 }}
              >Music</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
