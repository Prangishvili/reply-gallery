'use client'

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./scene'), { ssr: false })

const CANVAS_RATIO = 830 / 1020

export default function MakePage() {
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [size, setSize] = useState(0.08)
  const [repeat, setRepeat] = useState(5)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bgInputRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<(() => void) | null>(null)

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
    if (!files) return
    const urls = Array.from(files).map(f => URL.createObjectURL(f))
    setImageUrls(prev => [...prev, ...urls])
  }

  return (
    <>
      <style>{`
        *, *::before, *::after, canvas { cursor: default !important; }
        button, input[type="color"], input[type="range"], .make-clickable { cursor: pointer !important; }
      `}</style>
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#e8e8e8' }}>

        {/* Canvas constrained to 830:1020 aspect ratio */}
        <div style={{
          aspectRatio: `${830} / ${1020}`,
          maxHeight: 'calc(100vh - 100px)',
          maxWidth: `calc((100vh - 100px) * ${CANVAS_RATIO})`,
          width: '100%',
          position: 'relative',
          flexShrink: 0,
        }}>
          <Scene imageUrls={imageUrls} size={size} repeat={repeat} bgColor={bgColor} bgImage={bgImage} cameraStream={cameraStream} captureRef={captureRef} />
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '8px 16px', flexWrap: 'wrap', flexShrink: 0 }}>
          {(imageUrls.length > 0 || cameraStream) && (<>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
              size
              <input type="range" min={0.01} max={0.3} step={0.005} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: 90 }} />
              {size.toFixed(3)}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
              repeat
              <input type="range" min={1} max={30} step={1} value={repeat} onChange={e => setRepeat(Number(e.target.value))} style={{ width: 90 }} />
              {repeat}
            </label>
          </>)}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
            bg
            <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setBgImage(null) }} style={{ width: 28, height: 20, border: 'none', cursor: 'pointer', padding: 0, background: 'none' }} />
          </label>
          <span onClick={() => bgInputRef.current?.click()} className="make-clickable" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: 'rgba(0,0,0,0.55)' }}>
            {bgImage ? 'change bg image' : '+ bg image'}
          </span>
          <input ref={bgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
            const f = e.target.files?.[0]
            if (f) setBgImage(URL.createObjectURL(f))
            e.target.value = ''
          }} />
          {bgImage && (
            <button onClick={() => setBgImage(null)} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.35)', padding: 0 }}>
              remove bg
            </button>
          )}
          <button onClick={() => captureRef.current?.()} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, cursor: 'pointer', background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '5px 14px', color: 'rgba(0,0,0,0.6)' }}>
            save png
          </button>
          <button onClick={toggleCamera} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, cursor: 'pointer', background: cameraStream ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '5px 14px', color: cameraStream ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.6)' }}>
            {cameraStream ? '⏹ camera' : '⏺ camera'}
          </button>
          <button onClick={() => inputRef.current?.click()} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, cursor: 'pointer', background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, padding: '5px 14px', color: 'rgba(0,0,0,0.6)' }}>
            + upload images
          </button>
          {imageUrls.length > 0 && (
            <button onClick={() => setImageUrls([])} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', color: 'rgba(0,0,0,0.35)', padding: 0 }}>
              clear
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        </div>
      </div>
    </>
  )
}
