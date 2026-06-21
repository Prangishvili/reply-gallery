'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'

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
  const [orthographic, setOrthographic] = useState(false)

  // Save modal
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('')
  const [uploadToGallery, setUploadToGallery] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const captureRef = useRef<(() => string) | null>(null)
  const frozenDataUrl = useRef<string | null>(null)

  const toggleCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        setCameraStream(stream)
      } catch { /* permission denied */ }
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const urls = Array.from(files).map(f => URL.createObjectURL(f))
    setImageUrls(prev => [...prev, ...urls])
  }

  const openModal = () => {
    frozenDataUrl.current = captureRef.current?.() ?? null
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
        const out = document.createElement('canvas')
        out.width = Math.round(cropW)
        out.height = Math.round(cropH)
        const ctx = out.getContext('2d')!
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, out.width, out.height)
        ctx.drawImage(img, x, y, cropW, cropH, 0, 0, out.width, out.height)
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
        if (name.trim()) fd.append('visitor_name', name.trim())
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

      {/* Full-screen canvas */}
      <div style={{ position: 'fixed', inset: 0 }}>
        <Scene imageUrls={imageUrls} size={size} repeat={repeat} shuffleSeed={shuffleSeed} bgColor={bgColor} bgImage={bgImage} cameraStream={cameraStream} captureRef={captureRef} orthographic={orthographic} />
      </div>

      {/* Crop guide */}
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

      {/* Controls */}
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
          {cameraStream ? '⏹ camera' : '⏺ camera'}
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
          <button onClick={() => setOrthographic(o => !o)} style={orthographic ? btnOn : btn}>{orthographic ? 'ortho' : 'persp'}</button>
          <label style={{ ...btn, display: 'inline-block' }}>
            + upload images
            <input type="file" accept="image/*" multiple style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          </label>
          {imageUrls.length > 0 && <button onClick={() => setShuffleSeed(s => s + 1)} style={btn}>shuffle</button>}
          {imageUrls.length > 0 && <button onClick={() => setImageUrls([])} style={btn}>clear</button>}
        </div>

        {/* Save pill */}
        <button onClick={openModal} style={{
          ...mono, cursor: 'pointer',
          background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 6, padding: '20px 24px', color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        }}>save png</button>

      </div>
      </div>

      {/* Save modal */}
      {modal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 8, padding: '32px 36px', width: 360, display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'var(--font-dm-mono)' }}>
            <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.1em', color: '#222' }}>SAVE ARTWORK</p>

            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)' }}>YOUR NAME</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Mamniashvili Anna"
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
                style={{ ...btn, padding: '9px 0', textAlign: 'center', opacity: saving ? 0.5 : 1, fontSize: 11, letterSpacing: '0.1em' }}
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
    </>
  )
}
