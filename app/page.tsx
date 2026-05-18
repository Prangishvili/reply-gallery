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

// ─── Admin panel components ───────────────────────────────────────────────────

const P = {
  bg: '#0a0a0a',
  surface: '#131313',
  surface2: '#1a1a1a',
  border: '#232323',
  borderStrong: '#2e2e2e',
  text: '#e8e8e6',
  dim: '#7a7a78',
  low: '#4a4a48',
  accent: '#f0eb5c',
  font: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${P.border}`, padding: '16px 20px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        fontSize: 9, fontWeight: 600, letterSpacing: 2.5, color: P.dim, textTransform: 'uppercase' as const,
      }}>
        {title}
        <div style={{ flex: 1, height: 1, background: P.border }} />
      </div>
      {children}
    </div>
  )
}

function PanelSlider({ label, value, min, max, step, decimals = 0, onChange }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number; onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: P.text }}>{label}</span>
        <span style={{ fontSize: 11, color: P.accent, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
          {decimals === 0 ? value : value.toFixed(decimals)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: P.accent, cursor: 'pointer' }}
      />
    </div>
  )
}

function PanelToggle({ options, value, onChange }: {
  options: { label: string; value: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      background: P.surface2, border: `1px solid ${P.border}`, padding: 2, marginBottom: 12,
    }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            fontFamily: P.font, fontSize: 10, fontWeight: 500, letterSpacing: 1,
            padding: '7px 10px', border: 'none', cursor: 'pointer', textTransform: 'uppercase' as const,
            background: value === opt.value ? P.text : 'transparent',
            color: value === opt.value ? '#0a0a0a' : P.dim,
            transition: 'all 0.1s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function AdminPanel({
  rotateSpeed, setRotateSpeed,
  globeScale, setGlobeScale,
  tileSize, setTileSize,
  tileStyle, setTileStyle,
  audioVolume, setAudioVolume,
  showNames, setShowNames,
  nameSize, setNameSize,
  timebombActive, setTimebombActive,
  hiddenCount, resetTimebomb,
  phase,
}: {
  rotateSpeed: number; setRotateSpeed: (v: number) => void
  globeScale: number; setGlobeScale: (v: number) => void
  tileSize: number; setTileSize: (v: number) => void
  tileStyle: 'billboard' | 'outward'; setTileStyle: (v: 'billboard' | 'outward') => void
  audioVolume: number; setAudioVolume: (v: number) => void
  showNames: boolean; setShowNames: (v: boolean) => void
  nameSize: number; setNameSize: (v: number) => void
  timebombActive: boolean; setTimebombActive: (v: boolean) => void
  hiddenCount: number; resetTimebomb: () => void
  phase: Phase
}) {
  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 280, zIndex: 100,
      background: P.surface, borderLeft: `1px solid ${P.border}`,
      overflowY: 'auto', fontFamily: P.font, userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${P.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 3, color: P.text }}>REPLY.</div>
          <div style={{ fontSize: 9, color: P.dim, letterSpacing: 1.5, marginTop: 2 }}>LIVE EDITOR</div>
        </div>
        <div style={{
          fontSize: 9, letterSpacing: 1, padding: '3px 7px',
          border: `1px solid ${P.border}`, color: P.dim,
        }}>
          {phase.toUpperCase()}
        </div>
      </div>

      <PanelSection title="Audio">
        <PanelSlider label="Volume" value={audioVolume} min={0} max={1} step={0.01} decimals={2} onChange={setAudioVolume} />
      </PanelSection>

      <PanelSection title="Globe">
        <PanelSlider label="Rotation speed" value={rotateSpeed} min={0} max={5} step={0.1} decimals={1} onChange={setRotateSpeed} />
        <PanelSlider label="Globe scale" value={globeScale} min={0.4} max={2} step={0.05} decimals={2} onChange={setGlobeScale} />
        <PanelSlider label="Tile size" value={tileSize} min={0.3} max={1.8} step={0.05} decimals={2} onChange={setTileSize} />
      </PanelSection>

      <PanelSection title="Tiles">
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Orientation</div>
        <PanelToggle
          options={[{ label: 'Billboard', value: 'billboard' }, { label: 'Outward', value: 'outward' }]}
          value={tileStyle}
          onChange={v => setTileStyle(v as 'billboard' | 'outward')}
        />
        <div style={{ fontSize: 10, color: P.low, lineHeight: 1.6 }}>
          <strong style={{ color: P.dim }}>Billboard</strong> — always faces camera<br />
          <strong style={{ color: P.dim }}>Outward</strong> — rotates with globe
        </div>
      </PanelSection>

      <PanelSection title="Names">
        <div style={{ fontSize: 11, color: P.dim, marginBottom: 8 }}>Visibility</div>
        <PanelToggle
          options={[{ label: 'Show', value: 'show' }, { label: 'Hide', value: 'hide' }]}
          value={showNames ? 'show' : 'hide'}
          onChange={v => setShowNames(v === 'show')}
        />
        <PanelSlider label="Font size" value={nameSize} min={6} max={24} step={0.5} decimals={1} onChange={setNameSize} />
      </PanelSection>

      <PanelSection title="Timebomb">
        <PanelToggle
          options={[{ label: 'Armed', value: 'on' }, { label: 'Safe', value: 'off' }]}
          value={timebombActive ? 'on' : 'off'}
          onChange={v => setTimebombActive(v === 'on')}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: P.dim }}>
            {hiddenCount} image{hiddenCount !== 1 ? 's' : ''} hidden
          </span>
          <button
            onClick={resetTimebomb}
            style={{
              fontFamily: P.font, fontSize: 10, letterSpacing: 0.5,
              padding: '4px 10px', background: 'transparent',
              color: P.dim, border: `1px solid ${P.border}`, cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </PanelSection>

      <PanelSection title="About">
        <div style={{ fontSize: 10, color: P.low, lineHeight: 1.7 }}>
          <strong style={{ color: P.dim }}>URL</strong> ?admin=true<br />
          <strong style={{ color: P.dim }}>Stack</strong> Next.js · Three.js · Supabase<br />
          <strong style={{ color: P.dim }}>Repo</strong> Prangishvili/reply-gallery
        </div>
      </PanelSection>
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────

function HomeInner() {
  const [phase, setPhase] = useState<Phase>('entry')
  const [withSound, setWithSound] = useState(true)
  const [barWidth, setBarWidth] = useState(0)
  const [fadeOut, setFadeOut] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bgAudioRef = useRef<HTMLAudioElement | null>(null)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [items, setItems] = useState<ImageItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [rotateSpeed, setRotateSpeed] = useState(0.05)
  const [globeScale, setGlobeScale] = useState(1.5)
  const [tileSize, setTileSize] = useState(0.40)
  const [tileStyle, setTileStyle] = useState<'billboard' | 'outward'>('billboard')
  const [audioVolume, setAudioVolume] = useState(0.10)
  const [showNames, setShowNames] = useState(true)
  const [nameSize, setNameSize] = useState(10)
  const [timebombActive, setTimebombActive] = useState(false)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  const isAdmin = useSearchParams().get('admin') === 'true'

  // Sync audio volume live
  useEffect(() => {
    if (bgAudioRef.current) bgAudioRef.current.volume = audioVolume
  }, [audioVolume])

  // Timebomb: hide one random post every 2s, restore all when disarmed
  useEffect(() => {
    if (!timebombActive) { setHiddenIds(new Set()); return }
    const timer = setInterval(() => {
      setHiddenIds(prev => {
        const visible = posts.filter(p => !prev.has(p.id))
        if (visible.length === 0) return prev
        const pick = visible[Math.floor(Math.random() * visible.length)]
        return new Set([...prev, pick.id])
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [timebombActive, posts])

  // Loading bar → video
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

  function startBgAudio(sound: boolean) {
    if (!sound) return
    const audio = new Audio('/fx_bg.mp3')
    audio.loop = true
    audio.volume = audioVolume
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

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
      <div className="absolute inset-0" style={isAdmin ? { right: 280 } : {}}>
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
        {!loading && posts.length > 0 && (
          <GlobeCanvas
            posts={posts.filter(p => !hiddenIds.has(p.id))}
            rotateSpeed={rotateSpeed}
            scale={globeScale}
            tileSize={tileSize}
            tileStyle={tileStyle}
            showNames={showNames}
            nameSize={nameSize}
          />
        )}
      </div>

      {/* Upload FAB */}
      <button
        onClick={() => setShowUpload(true)}
        className="fixed bottom-9 left-1/2 -translate-x-1/2 z-20 bg-white shadow-md rounded-full px-7 py-[18px] font-mono text-black text-xl leading-none hover:shadow-lg transition-shadow border border-gray-100"
        aria-label="Upload"
        style={isAdmin ? { transform: 'translateX(calc(-50% - 140px))' } : {}}
      >
        +
      </button>

      {/* Admin panel */}
      {isAdmin && (
        <AdminPanel
          rotateSpeed={rotateSpeed} setRotateSpeed={setRotateSpeed}
          globeScale={globeScale} setGlobeScale={setGlobeScale}
          tileSize={tileSize} setTileSize={setTileSize}
          tileStyle={tileStyle} setTileStyle={setTileStyle}
          audioVolume={audioVolume} setAudioVolume={setAudioVolume}
          showNames={showNames} setShowNames={setShowNames}
          nameSize={nameSize} setNameSize={setNameSize}
          timebombActive={timebombActive} setTimebombActive={setTimebombActive}
          hiddenCount={hiddenIds.size} resetTimebomb={() => setHiddenIds(new Set())}
          phase={phase}
        />
      )}

      {/* Intro overlay */}
      {phase !== 'gallery' && (
        <div
          className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center"
          style={{ opacity: fadeOut ? 0 : 1, transition: 'opacity 0.6s ease', right: isAdmin ? 280 : 0 }}
        >
          {phase === 'entry' && (
            <div className="flex flex-col items-center gap-8">
              <p className="font-mono text-black/60 text-[11px] tracking-[0.2em] uppercase">
                play with sound?
              </p>
              <div className="flex items-center gap-6">
                <button
                  onClick={() => { setWithSound(true); setBarWidth(0); setPhase('loading'); startBgAudio(true) }}
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
                className="h-screen w-full min-[960px]:h-[60vh] min-[960px]:w-auto object-contain"
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
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={isAdmin ? { right: 280 } : {}}>
          <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <span className="font-mono text-sm font-semibold tracking-tight">Share something</span>
              <button onClick={closeModal} className="text-gray-400 hover:text-black transition-colors text-lg leading-none">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 min-h-0">
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
