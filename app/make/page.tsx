'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./scene'), { ssr: false })

const CANVAS_RATIO = 830 / 1020
const mono: React.CSSProperties = { fontFamily: 'var(--font-dm-mono)', fontSize: 11 }
const btn: React.CSSProperties = { ...mono, cursor: 'pointer', background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '5px 14px', color: 'rgba(0,0,0,0.6)' }

export default function MakePage() {
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [size, setSize] = useState(0.08)
  const [repeat, setRepeat] = useState(5)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

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
    // Build URLs synchronously NOW — before the input value is reset, which would
    // empty this FileList. Doing it inside the setState updater (called async) risks
    // reading an already-cleared FileList → no images added.
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

  const handleShareDownload = async () => {
    const dataUrl = frozenDataUrl.current
    if (!dataUrl) return
    setSaving(true)

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
        button, input[type="color"], input[type="range"], .make-clickable { cursor: pointer !important; }
      `}</style>

      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#e8e8e8' }}>

        {/* Canvas */}
        <div style={{ aspectRatio: `${830} / ${1020}`, maxHeight: 'calc(100vh - 100px)', maxWidth: `calc((100vh - 100px) * ${CANVAS_RATIO})`, width: '100%', position: 'relative', flexShrink: 0 }}>
          <Scene imageUrls={imageUrls} size={size} repeat={repeat} bgColor={bgColor} bgImage={bgImage} cameraStream={cameraStream} captureRef={captureRef} />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '8px 16px', flexWrap: 'wrap', flexShrink: 0 }}>
          {(imageUrls.length > 0 || cameraStream) && (<>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.55)' }}>
              size
              <input type="range" min={0.01} max={0.3} step={0.005} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: 90 }} />
              {size.toFixed(3)}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.55)' }}>
              repeat
              <input type="range" min={1} max={99} step={1} value={repeat} onChange={e => setRepeat(Number(e.target.value))} style={{ width: 90 }} />
              {repeat}
            </label>
          </>)}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...mono, color: 'rgba(0,0,0,0.55)' }}>
            bg
            <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgImage(null) }} style={{ width: 28, height: 20, border: 'none', padding: 0 }} />
          </label>
          <label className="make-clickable" style={{ ...mono, color: 'rgba(0,0,0,0.55)' }}>
            {bgImage ? 'change bg image' : '+ bg image'}
            <input type="file" accept="image/*" style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setBgImage(URL.createObjectURL(f)); e.target.value = '' }} />
          </label>
          {bgImage && <button onClick={() => setBgImage(null)} style={{ ...mono, background: 'none', border: 'none', color: 'rgba(0,0,0,0.35)', padding: 0 }}>remove bg</button>}
          <button onClick={openModal} style={btn}>save png</button>
          <button onClick={toggleCamera} style={{ ...btn, background: cameraStream ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)', color: cameraStream ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)' }}>
            {cameraStream ? '⏹ camera' : '⏺ camera'}
          </button>
          <label style={{ ...btn, display: 'inline-block' }}>
            + upload images
            <input type="file" accept="image/*" multiple style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
          </label>
          {imageUrls.length > 0 && <button onClick={() => setImageUrls([])} style={{ ...mono, background: 'none', border: 'none', color: 'rgba(0,0,0,0.35)', padding: 0 }}>clear</button>}
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
