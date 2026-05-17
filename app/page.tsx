'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { Post } from '@/lib/supabase'

const GlobeCanvas = dynamic(() => import('./globe'), { ssr: false })

type ImageItem = { file: File; preview: string; caption: string }

function fileToCaption(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

type Phase = 'entry' | 'loading' | 'video' | 'gallery'

function HomeInner() {
  const [phase, setPhase] = useState<Phase>('entry')
  const [withSound, setWithSound] = useState(true)
  const [barWidth, setBarWidth] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [items, setItems] = useState<ImageItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [rotateSpeed, setRotateSpeed] = useState(0.5)
  const [globeScale, setGlobeScale] = useState(1)
  const isAdmin = useSearchParams().get('admin') === 'true'
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Loading bar animation → auto-advance to video
  useEffect(() => {
    if (phase !== 'loading') return
    requestAnimationFrame(() => setBarWidth(100))
    const t = setTimeout(() => setPhase('video'), 2800)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'video' || !videoRef.current) return
    const v = videoRef.current
    v.muted = !withSound
    v.play().catch(() => {})
  }, [phase])

  function goToGallery() {
    setFadeOut(true)
    setTimeout(() => setPhase('gallery'), 600)
  }

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => { setPosts(data); setLoading(false) })
  }, [])

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter(f => f.type.startsWith('image/'))
    setItems(prev => [
      ...prev,
      ...incoming.map(f => ({ file: f, preview: URL.createObjectURL(f), caption: fileToCaption(f) })),
    ])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function updateCaption(index: number, caption: string) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, caption } : item))
  }

  function closeModal() {
    setShowUpload(false)
    setItems([])
    setError(null)
    setProgress(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Add at least one image.'); return }
    setSubmitting(true)
    setError(null)
    setProgress({ done: 0, total: items.length })

    const newPosts: Post[] = []
    for (const item of items) {
      const fd = new FormData()
      fd.append('image', item.file)
      fd.append('text', item.caption.trim() || fileToCaption(item.file))
      const res = await fetch('/api/posts', { method: 'POST', body: fd })
      if (res.ok) newPosts.push(await res.json())
      setProgress(p => p ? { ...p, done: p.done + 1 } : null)
    }

    if (newPosts.length > 0) setPosts(p => [...newPosts.reverse(), ...p])
    if (newPosts.length < items.length) {
      setError(`${items.length - newPosts.length} image(s) failed to upload.`)
      setSubmitting(false)
      return
    }
    closeModal()
    setSubmitting(false)
  }

  return (
    <div className="w-screen h-screen overflow-hidden bg-white relative">
      {/* Logo */}
      <div className="fixed top-9 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
        <img src="/logo.svg" alt="Reply" className="h-10 w-auto" />
      </div>

      {/* Globe */}
      <div className="absolute inset-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-gray-300 text-sm animate-pulse">loading…</span>
          </div>
        )}
        {!loading && posts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-gray-300 text-sm">nothing here yet — be first.</span>
          </div>
        )}
        {!loading && posts.length > 0 && <GlobeCanvas posts={posts} rotateSpeed={rotateSpeed} scale={globeScale} />}
      </div>

      {/* Upload FAB */}
      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-9 left-1/2 -translate-x-1/2 z-20 bg-white shadow-md rounded-full px-7 py-[18px] font-mono text-black text-xl leading-none hover:shadow-lg transition-shadow border border-gray-100"
        aria-label="Upload"
      >
        +
      </button>

      {/* Controls — admin only */}
      {isAdmin && <div className="fixed bottom-9 right-6 z-20 flex flex-col gap-2 bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">Speed</span>
          <input
            type="range" min={0} max={5} step={0.1} value={rotateSpeed}
            onChange={e => setRotateSpeed(Number(e.target.value))}
            className="w-28 accent-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">Size</span>
          <input
            type="range" min={0.4} max={2} step={0.05} value={globeScale}
            onChange={e => setGlobeScale(Number(e.target.value))}
            className="w-28 accent-black"
          />
        </label>
      </div>}

      {/* Intro overlay */}
      {phase !== 'gallery' && (
        <div
          className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center"
          style={{ opacity: fadeOut ? 0 : 1, transition: 'opacity 0.6s ease' }}
        >
          {phase === 'entry' && (
            <div className="flex flex-col items-center gap-8">
              <p className="font-mono text-black/60 text-[11px] tracking-[0.2em] uppercase">
                play with sound?
              </p>
              <div className="flex items-center gap-6">
                <button
                  onClick={() => { setWithSound(true); setBarWidth(0); setPhase('loading') }}
                  className="font-mono text-[11px] tracking-[0.2em] uppercase text-black border border-black px-5 py-2.5 hover:bg-black hover:text-white transition-colors"
                >
                  yes
                </button>
                <button
                  onClick={() => { setWithSound(false); setBarWidth(0); setPhase('loading') }}
                  className="font-mono text-[11px] tracking-[0.2em] uppercase text-black/40 hover:text-black transition-colors"
                >
                  no
                </button>
              </div>
            </div>
          )}

          {phase === 'loading' && (
            <>
              <div className="w-48 h-px bg-black/10 relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-black/60"
                  style={{ width: `${barWidth}%`, transition: 'width 2.6s cubic-bezier(0.4,0,0.2,1)' }}
                />
              </div>
              <p className="mt-10 font-mono text-black/60 text-[11px] tracking-[0.2em] uppercase">
                for full experience turn the sound on
              </p>
            </>
          )}

          {phase === 'video' && (
            <>
              <video
                ref={videoRef}
                src="/intro.mp4"
                playsInline
                className="h-[60vh] w-auto max-w-full object-contain"
                onEnded={goToGallery}
              />
              <button
                onClick={goToGallery}
                className="absolute bottom-9 right-9 font-mono text-black/50 hover:text-black text-[11px] tracking-[0.2em] uppercase transition-colors"
              >
                skip →
              </button>
            </>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-mono text-sm font-semibold tracking-tight">Share something</span>
              <button onClick={closeModal} className="text-gray-400 hover:text-black transition-colors text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 min-h-0">
              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                className={`shrink-0 cursor-pointer rounded-xl border-2 border-dashed h-20 flex items-center justify-center transition-colors
                  ${dragging ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <p className="font-mono text-xs text-gray-400">
                  {items.length > 0 ? '+ add more images' : 'drop images or click to browse'}
                </p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {/* Image list */}
              {items.length > 0 && (
                <div className="overflow-y-auto flex flex-col gap-2 min-h-0">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-200">
                        <Image src={item.preview} alt="" fill className="object-cover" />
                      </div>
                      <input
                        type="text"
                        value={item.caption}
                        onChange={e => updateCaption(i, e.target.value)}
                        placeholder={fileToCaption(item.file)}
                        className="flex-1 font-mono text-xs bg-transparent border-b border-gray-200 focus:border-black outline-none py-1 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="shrink-0 text-gray-300 hover:text-black transition-colors text-sm leading-none"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="font-mono text-xs text-red-500 shrink-0">{error}</p>}

              <button
                type="submit"
                disabled={submitting || items.length === 0}
                className="shrink-0 w-full bg-black text-white font-mono text-sm py-3 rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                {submitting && progress
                  ? `uploading ${progress.done}/${progress.total}…`
                  : items.length > 1
                  ? `post ${items.length} images`
                  : 'post'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  )
}
