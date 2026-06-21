'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Post } from '@/lib/supabase'

type ViewMode = 'globe' | 'room' | 'circle' | 'self'
const ROUTE_FOR: Record<'room' | 'circle' | 'self', string> = { room: '/room', circle: '/', self: '/self' }

const GlobeCanvas  = dynamic(() => import('./globe'), { ssr: false })
const RoomCanvas   = dynamic(() => import('./room'),  { ssr: false })
const CircleCanvas = dynamic(() => import('./room').then(m => ({ default: m.CircleCanvas })), { ssr: false })
const SelfCanvas   = dynamic(() => import('./self'),  { ssr: false })
import type { TextureMapping } from './room'
import { STUDENTS, STUDENT_VERTEX_DEFAULTS, fileToCaption, ADMIN_DEFAULTS, AdminPanel } from './lib/gallery-shared'
import type { VertexSettings, AdminSettings, ImageItem, Phase } from './lib/gallery-shared'


// ─── Main app ─────────────────────────────────────────────────────────────────

export function GalleryApp({ initialView = 'circle', showEntry = false }: { initialView?: ViewMode; showEntry?: boolean }) {
  const [phase, setPhase] = useState<Phase>(showEntry ? 'entry' : 'gallery')
  const [withSound, setWithSound] = useState(true)
  const [showQuote, setShowQuote] = useState(false)
  const [replyFrame, setReplyFrame] = useState(0)
  useEffect(() => {
    if (phase !== 'entry') return
    const id = setInterval(() => setReplyFrame(f => (f + 1) % 3), 250)
    return () => clearInterval(id)
  }, [phase])
  // Native cursor — custom orange cursor removed

  // Block iOS Safari's native page pinch-zoom (it ignores the viewport flag
  // for accessibility) — canvas pinch still reaches OrbitControls
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()
    document.addEventListener('gesturestart', prevent)
    document.addEventListener('gesturechange', prevent)
    return () => {
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
    }
  }, [])

  const bgAudioRef = useRef<HTMLAudioElement | null>(null)
  const bgAudioBlobRef = useRef<string | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const soundInputRef = useRef<HTMLInputElement>(null)

  const [posts, setPosts] = useState<Post[]>([])
  const [visitorPosts, setVisitorPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [items, setItems] = useState<ImageItem[]>([])
  const [uploadStudentName, setUploadStudentName] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [roomKey, setRoomKey] = useState(0)
  const captureRef = useRef<(() => void) | null>(null)

  const [admin, setAdmin] = useState<AdminSettings>(ADMIN_DEFAULTS)
  const {
    audioVolume, timebombActive,
    showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing,
    figureWireframe, wireframeStyle, dotSize, circleDotSize, circleDotSizeMobile, circleShowImages, dotColor, dotCount, circleDotCountMobile,
    meshTexture, texScale, texOffsetX, texOffsetY, texRotation, showVertexImages,
    figureRings, figureDrift,
    soloReact, circleRadius, circleFigureFacing, circleFigureY, circleCameraMode, circleCamX, circleCamY, circleCamZ, circleCamXM, circleCamYM, circleCamZM, circleCamZoomM, circleFigureYM,
    circleCamFov, circleCamZoom, circleCamXLoop, circleCamXLoopSpeed, camX, camY, camZ,
    roomCameraMode, roomCamFov, roomCamZoom, roomCamXLoop, roomCamXLoopSpeed, nutsaGlbScale, nutsaGlbRepeat,
  } = admin

  const isMobileVp = typeof window !== 'undefined' && window.innerWidth < 1000
  // Safari (and all iOS browsers) — the only engines exposing GestureEvent
  const isWebKit = typeof window !== 'undefined' && 'GestureEvent' in window

  const [showNames, setShowNames] = useState(true)
  const [nameSize, setNameSize] = useState(10)
  const [showNoiseGlobe, setShowNoiseGlobe] = useState(false)
  const [noiseColor1, setNoiseColor1] = useState('#08003a')
  const [noiseColor2, setNoiseColor2] = useState('#8c1aff')
  const [noiseSpeed, setNoiseSpeed] = useState(0.5)
  const [noiseScale, setNoiseScale] = useState(1.0)
  const [showWireframe, setShowWireframe] = useState(false)
  const [wireframeSegments, setWireframeSegments] = useState(16)
  const [wireframeOpacity, setWireframeOpacity] = useState(0.15)
  const [wireframeColor, setWireframeColor] = useState('#000000')
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showAbout, setShowAbout] = useState(false)
  const [shuffledGlobePosts, setShuffledGlobePosts] = useState<Post[] | null>(null)
  const [roomShuffleSeeds, setRoomShuffleSeeds] = useState<Record<string, number>>({})

  const [viewMode, setViewMode] = useState<ViewMode>(initialView)
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [personalRoomKey, setPersonalRoomKey] = useState(0)
  const [circleKey, setCircleKey] = useState(0)
  const [studentTextures, setStudentTextures] = useState<Record<string, string | null>>({})
  const [studentTextureMappings, setStudentTextureMappings] = useState<Record<string, TextureMapping>>({})
  const [activeEditStudent, setActiveEditStudent] = useState<string | null>(null)

  const handleCircleTextureUpload = (student: string, url: string | null) => {
    setStudentTextures(prev => {
      const old = prev[student]
      if (old?.startsWith('blob:')) URL.revokeObjectURL(old)
      return { ...prev, [student]: url }
    })
    if (url) setActiveEditStudent(student)
    else if (activeEditStudent === student) setActiveEditStudent(null)
  }

  const switchView = (v: 'globe' | 'room' | 'circle' | 'self') => {
    if (v === 'room') setRoomKey(k => k + 1)
    setSelectedStudent(null)
    setViewMode(v)
  }

  const openStudentRoom = (name: string) => {
    setPersonalRoomKey(k => k + 1)
    setSelectedStudent(name)
  }

  const closeStudentRoom = () => {
    setSelectedStudent(null)
  }

  // Delay mounting the room/circle canvas so the GPU can release the globe context first
  const [mountedView, setMountedView] = useState<ViewMode>(initialView)
  useEffect(() => {
    if (viewMode === 'globe' || viewMode === 'self') { setMountedView(viewMode); return }
    const id = setTimeout(() => setMountedView(viewMode), 200)
    return () => clearTimeout(id)
  }, [viewMode])

  // Circle intro animation — show quote first, then animate (only once per session)
  // Images start loading only after the animation ends so it runs jank-free
  const [introImagesReady, setIntroImagesReady] = useState(false)
  const circleAnimRef = useRef<number | null>(null)
  const circleAnimPlayedRef = useRef(false)
  useEffect(() => {
    if (viewMode !== 'circle' || phase !== 'gallery') { setShowQuote(false); return }
    // Animation already ran (or was cancelled mid-way / StrictMode remount):
    // don't replay it, but make sure images aren't gated forever
    if (circleAnimPlayedRef.current) { setIntroImagesReady(true); return }
    circleAnimPlayedRef.current = true

    const targetZoom = window.innerWidth < 1000 ? 0.6 : 1.4

    // The fly-in animation always plays (it frames the scene and gates the images so
    // they appear jank-free after it ends); only the quote is limited to once per day.
    const INTRO_KEY = 'reply_circle_intro_seen'
    const INTRO_TTL_MS = 24 * 60 * 60 * 1000
    let showQuoteThisTime = true
    try {
      const ts = Number(localStorage.getItem(INTRO_KEY))
      if (ts > 0 && Date.now() - ts < INTRO_TTL_MS) showQuoteThisTime = false
    } catch { /* localStorage unavailable */ }
    if (showQuoteThisTime) { try { localStorage.setItem(INTRO_KEY, String(Date.now())) } catch { /* ignore */ } }

    if (circleAnimRef.current !== null) cancelAnimationFrame(circleAnimRef.current)
    const fromCamY = circleCamYRef.current
    const fromZoom = circleCamZoomRef.current
    const fromFigY = circleFigureYRef.current
    const duration = 5000
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const e = 1 - Math.pow(1 - t, 3)
      setAdmin(prev => ({
        ...prev,
        circleCamY: fromCamY + (400 - fromCamY) * e,
        circleCamZoom: fromZoom + (targetZoom - fromZoom) * e,
        circleFigureY: fromFigY + (160 - fromFigY) * e,
      }))
      if (t < 1) circleAnimRef.current = requestAnimationFrame(tick)
      else { setAdmin(prev => ({ ...prev, circleCamXLoop: true, circleCamXLoopSpeed: 0.1 })); setIntroImagesReady(true); setShowQuote(false) }
    }
    if (showQuoteThisTime) setShowQuote(true)
    circleAnimRef.current = requestAnimationFrame(tick)
    return () => { if (circleAnimRef.current !== null) cancelAnimationFrame(circleAnimRef.current) }
  }, [viewMode, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Delay mounting personal room canvas too
  const [mountedStudent, setMountedStudent] = useState<string | null>(null)
  useEffect(() => {
    if (!selectedStudent) { setMountedStudent(null); return }
    const id = setTimeout(() => setMountedStudent(selectedStudent), 200)
    return () => clearTimeout(id)
  }, [selectedStudent])

  const [showDoggo, setShowDoggo] = useState(false)
  const [doggoScale, setDoggoScale] = useState(40)
  const [doggoX, setDoggoX] = useState(0)
  const [doggoY, setDoggoY] = useState(0)
  const [doggoZ, setDoggoZ] = useState(0)

  // Refs so animation reads current values without stale closures
  const circleCamYRef = useRef(circleCamY)
  circleCamYRef.current = circleCamY
  const circleCamZoomRef = useRef(circleCamZoom)
  circleCamZoomRef.current = circleCamZoom
  const circleFigureYRef = useRef(circleFigureY)
  circleFigureYRef.current = circleFigureY

  const [studentVertexSettings, setStudentVertexSettings] = useState<Record<string, VertexSettings>>(() => ({ ...STUDENT_VERTEX_DEFAULTS }))
  const DEF_VS: VertexSettings = { imgSize: 0.025, repeat: 1 }
  const getVS = (name: string | null): VertexSettings => name ? (studentVertexSettings[name] ?? DEF_VS) : DEF_VS
  const setVSKey = (name: string | null, key: keyof VertexSettings, val: number) => {
    if (!name) return
    setStudentVertexSettings(p => ({ ...p, [name]: { ...(p[name] ?? DEF_VS), [key]: val } }))
  }
  const [graffitiMode, setGraffitiMode] = useState(false)
  const [graffitiColor, setGraffitiColor] = useState('#ff2222')
  const [graffitiBrushSize, setGraffitiBrushSize] = useState(8)
  const [graffitiClearKey, setGraffitiClearKey] = useState(0)
  const [transitionKey, setTransitionKey] = useState(0)
  const [selfStream, setSelfStream] = useState<MediaStream | null>(null)
  const [selfPermission, setSelfPermission] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [selfImgSize, setSelfImgSize] = useState(0.1)
  const [selfImgCount, setSelfImgCount] = useState(60)
  const [selfImages, setSelfImages] = useState<{ url: string; isVideo: boolean }[]>([])
  const selfImagesBlobsRef = useRef<string[]>([])
  const [selfFacing, setSelfFacing] = useState<'camera' | 'surface'>('camera')
  const [selfSoundReact, setSelfSoundReact] = useState(false)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [bgImage, setBgImage] = useState<string | null>(null)
  const bgImageBlobRef = useRef<string | null>(null)
  const dissolveInitRef = useRef(false)
  const circleCameraInfoRef = useRef<HTMLDivElement>(null)
  const [nutsaGlbs, setNutsaGlbs] = useState<string[]>([])

  const [selectedStudents, setSelectedStudents] = useState<string[]>(['Salome Shalvashvili', 'Sergi Sarajevi'])
  const figureStudent  = selectedStudents[0] ?? null
  const figureStudent2 = selectedStudents[1] ?? null
  const figureOrbiting = selectedStudents.length === 2

  const handleStudentSelect = (name: string) => {
    if (name === 'SELF') {
      switchView(viewMode === 'self' ? 'room' : 'self')
      return
    }
    setSelectedStudents(prev => {
      const idx = prev.indexOf(name)
      if (idx !== -1) return prev.filter(s => s !== name)
      if (prev.length < 2) return [...prev, name]
      return [prev[1], name]
    })
  }

  // Increment transitionKey when student selection changes (skip first render)
  useEffect(() => {
    if (!dissolveInitRef.current) { dissolveInitRef.current = true; return }
    setTransitionKey(k => k + 1)
  }, [figureStudent, figureStudent2])

  // Stop webcam stream when leaving the SELF view
  useEffect(() => {
    if (viewMode !== 'self') {
      selfStream?.getTracks().forEach(t => t.stop())
      setSelfStream(null)
      setSelfPermission('idle')
    }
  }, [viewMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const [panelHidden, setPanelHidden] = useState(false)
  const [uiHidden, setUiHidden] = useState(false)

  const isAdmin = useSearchParams().get('admin') === 'true'

  // H key toggles admin panel
  useEffect(() => {
    if (!isAdmin) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') {
        setPanelHidden(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isAdmin])

  // X key toggles all UI visibility
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'x' || e.key === 'X') setUiHidden(v => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Z key toggles sound on/off
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'z' || e.key === 'Z') {
        const audio = bgAudioRef.current
        if (!audio) return
        if (audio.paused) {
          const ctx = audioCtxRef.current
          const resume = ctx && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
          resume.then(() => audio.play()).catch(() => {})
        } else {
          audio.pause()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Sub-pages (/room, /self) have no entry/sound gate. Start background audio on
  // mount; browser autoplay policy keeps it suspended until the first interaction,
  // so resume it on the first pointer/key event.
  useEffect(() => {
    if (showEntry || bgAudioRef.current) return
    startBgAudio(true)
    const resume = () => {
      audioCtxRef.current?.resume().catch(() => {})
      bgAudioRef.current?.play().catch(() => {})
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync audio volume live via gain node so analyser always sees full signal
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = audioVolume
    else if (bgAudioRef.current) bgAudioRef.current.volume = audioVolume
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



  function startBgAudio(sound: boolean) {
    const audio = new Audio('/fx_bg.mp3')
    audio.loop = true
    audio.volume = 1
    try {
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      const gain = ctx.createGain()
      gain.gain.value = sound ? audioVolume : 0
      source.connect(analyser)
      analyser.connect(gain)
      gain.connect(ctx.destination)
      analyserRef.current = analyser
      gainNodeRef.current = gain
      ctx.resume().catch(() => {})
    } catch {}
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

  function replaceBgAudio(file: File) {
    const old = bgAudioRef.current
    bgAudioRef.current = null
    analyserRef.current = null
    if (old) { old.pause(); old.src = '' }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null

    if (bgAudioBlobRef.current) URL.revokeObjectURL(bgAudioBlobRef.current)
    const url = URL.createObjectURL(file)
    bgAudioBlobRef.current = url
    const audio = new Audio(url)
    audio.loop = true
    audio.volume = 1
    setAdmin(prev => ({ ...prev, audioVolume: 1 }))
    try {
      const ctx = new AudioContext()
      const source = ctx.createMediaElementSource(audio)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      source.connect(analyser)
      analyser.connect(ctx.destination)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      ctx.resume().catch(() => {})
    } catch {}
    audio.play().catch(() => {})
    bgAudioRef.current = audio
  }

  function shuffleGlobe() {
    const visible = posts.filter(p => !hiddenIds.has(p.id))
    if (visible.length === 0) return
    setShuffledGlobePosts(
      Array.from({ length: visible.length }, () => visible[Math.floor(Math.random() * visible.length)])
    )
  }

  function shuffleRoomStudent(name: string) {
    setRoomShuffleSeeds(prev => ({ ...prev, [name]: (prev[name] ?? 0) + 1 }))
  }

  function goToGallery() {
    localStorage.setItem('reply_visited', 'true')
    setPhase('gallery')
  }

  // Preload the 3D chunks + figure GLB during the entry screen so the gallery
  // appears instantly when a sound option is clicked (images still load lazily)
  useEffect(() => {
    import('./room')
    import('./globe')
  }, [])

  useEffect(() => {
    const CACHE_KEY = 'reply_posts_cache'
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try { setPosts(JSON.parse(cached)); setLoading(false) } catch {}
    }
    fetch('/api/posts')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setPosts(data)
        setLoading(false)
        localStorage.setItem(CACHE_KEY, JSON.stringify(data))
      })
  }, [])

  const globeMounted = mountedView === 'globe'
  useEffect(() => {
    if (!globeMounted) return
    fetch('/api/visitor-posts')
      .then(r => r.ok ? r.json() : [])
      .then(setVisitorPosts)
  }, [globeMounted])

  // Start downloading figure images as soon as posts are known — they land in
  // the session texture cache while the user is still on the entry screen
  useEffect(() => {
    if (posts.length === 0) return
    import('./room').then(m => m.prefetchPostImages(posts))
  }, [posts])

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

  async function handleAdminUpload(file: File, studentName: string) {
    const fd = new FormData()
    fd.append('image', file)
    fd.append('text', file.name.replace(/\.[^.]+$/, ''))
    fd.append('student_name', studentName)
    const res = await fetch('/api/posts', { method: 'POST', body: fd })
    if (!res.ok) throw new Error(await res.text())
    const post: Post = await res.json()
    setPosts(p => [post, ...p])
  }

  async function handleDeletePost(id: string) {
    const post = posts.find(p => p.id === id)
    if (post?.image_url.startsWith('blob:')) {
      URL.revokeObjectURL(post.image_url)
    } else {
      await fetch(`/api/posts?id=${id}`, { method: 'DELETE' })
    }
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  function closeModal() {
    setShowUpload(false)
    setItems([])
    setUploadStudentName('')
    setError(null)
    setProgress(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Add at least one image.'); return }
    if (!uploadStudentName.trim()) { setError('Please select your name.'); return }
    setSubmitting(true)
    setError(null)

    const newPosts: Post[] = items.map(item => ({
      id: crypto.randomUUID(),
      text: item.caption.trim() || fileToCaption(item.file),
      image_url: item.preview,
      student_name: uploadStudentName.trim() || null,
      created_at: new Date().toISOString(),
    }))
    setPosts(p => [...newPosts.reverse(), ...p])
    closeModal()
    setSubmitting(false)
  }

  return (
    <div suppressHydrationWarning className="w-screen h-dvh overflow-hidden relative" style={{ background: bgImage ? `url(${bgImage}) center/cover no-repeat` : bgColor }}>
      {/* Logo */}
      {!uiHidden && (
        <div className="fixed top-9 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
          <img src="/logo.svg" alt="Reply" className="h-12 w-auto" fetchPriority="low" />
        </div>
      )}

      {/* View toggle — admin only; hidden from the public for now */}
      {phase === 'gallery' && !loading && !selectedStudent && !uiHidden && isAdmin && (
        <div
          className="fixed top-6 z-20"
          style={{ right: isAdmin && !panelHidden ? 296 : 16 }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            {(['room', 'circle', 'self'] as const).map(mode => (
              <Link
                key={mode}
                href={ROUTE_FOR[mode]}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
                  padding: 0, border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                  background: 'transparent', textDecoration: 'none',
                  color: viewMode === mode ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.3)',
                  transition: 'color 0.15s',
                }}
              >
                {mode}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Shuffle button — globe view only */}
      {phase === 'gallery' && viewMode === 'globe' && !selectedStudent && !uiHidden && (
        <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', gap: 12 }}>
          <button
            onClick={shuffleGlobe}
            style={{
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
              padding: '5px 16px', border: '1px solid rgba(0,0,0,0.18)', cursor: 'pointer',
              textTransform: 'uppercase', background: 'transparent', color: 'rgba(0,0,0,0.5)',
              transition: 'color 0.15s',
            }}
          >shuffle</button>
          {shuffledGlobePosts && (
            <button
              onClick={() => setShuffledGlobePosts(null)}
              style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
                padding: '5px 16px', border: '1px solid rgba(0,0,0,0.12)', cursor: 'pointer',
                textTransform: 'uppercase', background: 'transparent', color: 'rgba(0,0,0,0.3)',
                transition: 'color 0.15s',
              }}
            >reset</button>
          )}
        </div>
      )}

      {/* Texture mapping overlay — circle view, after upload */}
      {mountedView === 'circle' && activeEditStudent && studentTextures[activeEditStudent] && !uiHidden && (
        <div style={{
          position: 'fixed', right: 24, top: '50%', transform: 'translateY(-50%)',
          zIndex: 30, width: 160, display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase' }}>
              {activeEditStudent.split(' ')[0]}
            </span>
            <button onClick={() => setActiveEditStudent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 12, color: 'rgba(0,0,0,0.3)', padding: 0, lineHeight: 1 }}>×</button>
          </div>
          {([
            { label: 'Scale',    key: 'scale',    min: 0.1, max: 5,   step: 0.05, dec: 2 },
            { label: 'Repeat',   key: 'repeat',   min: 1,   max: 20,  step: 1,    dec: 0 },
            { label: 'Offset X', key: 'offsetX',  min: -1,  max: 1,   step: 0.01, dec: 2 },
            { label: 'Offset Y', key: 'offsetY',  min: -1,  max: 1,   step: 0.01, dec: 2 },
            { label: 'Rotation', key: 'rotation', min: 0,   max: 360, step: 1,    dec: 0 },
          ] as { label: string; key: keyof TextureMapping; min: number; max: number; step: number; dec: number }[]).map(({ label, key, min, max, step, dec }) => {
            const val = (studentTextureMappings[activeEditStudent] ?? { scale: 1, repeat: 1, offsetX: 0, offsetY: 0, rotation: 0 })[key]
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.6)', fontVariantNumeric: 'tabular-nums' }}>{dec === 0 ? val : (val as number).toFixed(dec)}</span>
                </div>
                <input type="range" min={min} max={max} step={step} value={val}
                  onChange={e => setStudentTextureMappings(prev => ({
                    ...prev,
                    [activeEditStudent]: { ...(prev[activeEditStudent] ?? { scale: 1, repeat: 1, offsetX: 0, offsetY: 0, rotation: 0 }), [key]: Number(e.target.value) }
                  }))}
                  style={{ width: '100%', accentColor: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Image controls overlay — room view */}
      {phase === 'gallery' && mountedView === 'room' && !selectedStudent && !uiHidden && (
        <div style={{
          position: 'fixed', right: isAdmin && !panelHidden ? 296 + 24 : 24,
          top: '50%', transform: 'translateY(-50%)',
          zIndex: 30, width: 160, display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'auto',
        }}>
          {posts.length > 0 && ([
            { label: 'Image size',       value: getVS(figureStudent).imgSize,       min: 0.005, max: 3,  step: 0.005, dec: 3, set: (v: number) => setVSKey(figureStudent, 'imgSize', v) },
            { label: 'Repeat',           value: getVS(figureStudent).repeat,         min: 1,     max: 20, step: 1,     dec: 0, set: (v: number) => setVSKey(figureStudent, 'repeat', v)  },
            { label: 'Audio image size', value: getVS(figureStudent).audioImgSize ?? getVS(figureStudent).imgSize, min: 0.005, max: 3,  step: 0.005, dec: 3, set: (v: number) => setVSKey(figureStudent, 'audioImgSize', v) },
            { label: 'Audio repeat',     value: getVS(figureStudent).audioRepeat  ?? getVS(figureStudent).repeat,  min: 1,     max: 20, step: 1,     dec: 0, set: (v: number) => setVSKey(figureStudent, 'audioRepeat', v)  },
            { label: 'Drift speed',      value: getVS(figureStudent).driftSpeed   ?? 1,    min: 0, max: 3,  step: 0.05,  dec: 2, set: (v: number) => setVSKey(figureStudent, 'driftSpeed', v)  },
            { label: 'Drift distance',   value: getVS(figureStudent).driftAmp     ?? 0.5,  min: 0, max: 3,  step: 0.05,  dec: 2, set: (v: number) => setVSKey(figureStudent, 'driftAmp', v)    },
          ] as { label: string; value: number; min: number; max: number; step: number; dec: number; set: (v: number) => void }[]).map(({ label, value, min, max, step, dec, set }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.6)', fontVariantNumeric: 'tabular-nums' }}>{dec === 0 ? value : value.toFixed(dec)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'rgba(0,0,0,0.5)', cursor: 'pointer' }}
              />
            </div>
          ))}

          {/* Texture upload */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: posts.length > 0 ? 6 : 0 }}>
            {meshTexture && (
              <div style={{ position: 'relative', width: 32, height: 32, flexShrink: 0 }}>
                <img src={meshTexture} style={{ width: 32, height: 32, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => { URL.revokeObjectURL(meshTexture as string); setAdmin(prev => ({ ...prev, meshTexture: null })) }}
                  style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 13, height: 13, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 8, lineHeight: '13px', textAlign: 'center',
                  }}
                >×</button>
              </div>
            )}
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
                color: 'rgba(0,0,0,0.45)',
              }}>{meshTexture ? 'texture' : '+ texture'}</span>
              <input
                type="file" accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (meshTexture) URL.revokeObjectURL(meshTexture)
                  setAdmin(prev => ({ ...prev, meshTexture: URL.createObjectURL(file) }))
                  e.target.value = ''
                }}
              />
            </label>
          </div>

          {posts.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
              <button
                onClick={() => {
                  posts.filter(p => p.image_url.startsWith('blob:')).forEach(p => URL.revokeObjectURL(p.image_url))
                  setPosts(p => p.filter(post => !post.image_url.startsWith('blob:')))
                }}
                style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >remove all</button>
            </div>
          )}

          {/* Per-student drift + facing toggles */}
          {[figureStudent, figureStudent2].filter((s): s is string => !!s).map(name => {
            const vs = studentVertexSettings[name] ?? {}
            const driftEnabled = vs.driftEnabled !== false
            const facing = vs.facing ?? 'camera'
            return (
              <div key={name} style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.4)' }}>
                    {name.split(' ')[0]} drift
                  </span>
                  <button
                    onClick={() => setStudentVertexSettings(p => ({ ...p, [name]: { ...(p[name] ?? DEF_VS), driftEnabled: !driftEnabled } }))}
                    style={{
                      fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                      fontSize: 9, padding: '3px 9px', cursor: 'pointer',
                      background: driftEnabled ? 'rgba(0,0,0,0.12)' : 'transparent',
                      border: '1px solid rgba(0,0,0,0.18)',
                      color: driftEnabled ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)',
                    }}
                  >{driftEnabled ? 'on' : 'off'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['camera', 'normal'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setStudentVertexSettings(p => ({ ...p, [name]: { ...(p[name] ?? DEF_VS), facing: f } }))}
                      style={{
                        flex: 1, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                        fontSize: 9, padding: '3px 0', cursor: 'pointer',
                        background: facing === f ? 'rgba(0,0,0,0.12)' : 'transparent',
                        border: '1px solid rgba(0,0,0,0.18)',
                        color: facing === f ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)',
                      }}
                    >{f}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  <button
                    onClick={() => shuffleRoomStudent(name)}
                    style={{
                      flex: 1, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                      fontSize: 9, padding: '3px 0', cursor: 'pointer',
                      background: (roomShuffleSeeds[name] ?? 0) > 0 ? 'rgba(0,0,0,0.12)' : 'transparent',
                      border: '1px solid rgba(0,0,0,0.18)',
                      color: (roomShuffleSeeds[name] ?? 0) > 0 ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)',
                    }}
                  >shuffle</button>
                  {(roomShuffleSeeds[name] ?? 0) > 0 && (
                    <button
                      onClick={() => setRoomShuffleSeeds(prev => { const n = { ...prev }; delete n[name]; return n })}
                      style={{
                        fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                        fontSize: 9, padding: '3px 8px', cursor: 'pointer',
                        background: 'transparent', border: '1px solid rgba(0,0,0,0.12)',
                        color: 'rgba(0,0,0,0.25)',
                      }}
                    >reset</button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Camera mode + Save PNG */}
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {(['perspective', 'orthographic', 'panoramic'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setAdmin(prev => ({ ...prev, roomCameraMode: mode }))}
                style={{
                  flex: 1, fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
                  fontSize: 9, padding: '4px 0', cursor: 'pointer',
                  background: roomCameraMode === mode ? 'rgba(0,0,0,0.12)' : 'transparent',
                  border: '1px solid rgba(0,0,0,0.18)',
                  color: roomCameraMode === mode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.35)',
                }}
              >{mode === 'orthographic' ? 'ortho' : mode === 'panoramic' ? 'pano' : 'persp'}</button>
            ))}
          </div>
          <button
            onClick={() => captureRef.current?.()}
            style={{
              width: '100%', marginTop: 6,
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
              fontSize: 10, padding: '5px 0', cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(0,0,0,0.18)',
              color: 'rgba(0,0,0,0.4)',
            }}
          >save 16-bit</button>
        </div>
      )}

      {/* Image controls overlay — self view */}
      {phase === 'gallery' && mountedView === 'self' && selfPermission === 'granted' && !selectedStudent && !uiHidden && (
        <div style={{
          position: 'fixed', right: isAdmin && !panelHidden ? 296 + 24 : 24,
          top: '50%', transform: 'translateY(-50%)',
          zIndex: 30, width: 160, display: 'flex', flexDirection: 'column', gap: 0,
          pointerEvents: 'auto',
        }}>
          {([
            { label: 'Image size', value: selfImgSize, min: 0.01, max: 1,   step: 0.005, dec: 3, set: setSelfImgSize  },
            { label: 'Count',      value: selfImgCount, min: 1,   max: 200,  step: 1,     dec: 0, set: setSelfImgCount },
          ] as { label: string; value: number; min: number; max: number; step: number; dec: number; set: (v: number) => void }[]).map(({ label, value, min, max, step, dec, set }) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.7)', fontVariantNumeric: 'tabular-nums' }}>{dec === 0 ? value : value.toFixed(dec)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={value}
                onChange={e => set(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'rgba(0,0,0,0.6)', cursor: 'pointer' }}
              />
            </div>
          ))}

          {/* Enable camera (shown when skipped) */}
          {!selfStream && (
            <button
              onClick={async () => {
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                  setSelfStream(stream)
                } catch {}
              }}
              style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: 'rgba(0,0,0,0.45)', display: 'block', marginBottom: 12,
              }}
            >enable camera</button>
          )}

          {/* Facing mode toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(['camera', 'surface'] as const).map(mode => (
              <button key={mode} onClick={() => setSelfFacing(mode)} style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: selfFacing === mode ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)',
                transition: 'color 0.15s',
              }}>{mode}</button>
            ))}
          </div>

          {/* Sound react toggle */}
          <button onClick={() => setSelfSoundReact(v => !v)} style={{
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: selfSoundReact ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)',
            transition: 'color 0.15s', display: 'block', marginBottom: 16,
          }}>sound react</button>

          {/* Uploaded media for mixing */}
          <div style={{ marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>mix media</span>
              {selfImages.length > 0 && (
                <button
                  onClick={() => {
                    selfImagesBlobsRef.current.forEach(u => URL.revokeObjectURL(u))
                    selfImagesBlobsRef.current = []
                    setSelfImages([])
                  }}
                  style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 9, color: 'rgba(0,0,0,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >clear all</button>
              )}
            </div>
            {selfImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {selfImages.map(({ url, isVideo }) => (
                  <div key={url} style={{ position: 'relative', width: 40, height: 40, flexShrink: 0 }}>
                    {isVideo
                      ? <video src={url} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    }
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(url)
                        selfImagesBlobsRef.current = selfImagesBlobsRef.current.filter(u => u !== url)
                        setSelfImages(prev => prev.filter(item => item.url !== url))
                      }}
                      style={{
                        position: 'absolute', top: -5, right: -5,
                        width: 14, height: 14, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.75)', color: '#fff',
                        border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 9, lineHeight: '14px', textAlign: 'center',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
            <input
              id="self-img-upload" type="file" multiple accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files || [])
                const newItems = files.map(f => {
                  const url = URL.createObjectURL(f)
                  selfImagesBlobsRef.current.push(url)
                  return { url, isVideo: f.type.startsWith('video/') }
                })
                setSelfImages(prev => [...prev, ...newItems])
                e.target.value = ''
              }}
            />
            <label
              htmlFor="self-img-upload"
              style={{
                display: 'block', textAlign: 'center', cursor: 'pointer',
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                color: 'rgba(0,0,0,0.45)',
                border: '1px dashed rgba(0,0,0,0.2)',
                padding: '5px 0',
              }}
            >+ add files</label>
          </div>
        </div>
      )}


      {/* SELF — camera permission overlay */}
      {phase === 'gallery' && viewMode === 'self' && selfPermission !== 'granted' && !uiHidden && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 25,
          background: 'rgba(8,8,8,0.94)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 24,
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase' }}>
            self
          </div>
          {selfPermission === 'idle' ? (
            <>
              <button
                onClick={async () => {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
                    setSelfStream(stream)
                    setSelfPermission('granted')
                  } catch {
                    setSelfPermission('denied')
                  }
                }}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 2,
                  textTransform: 'uppercase', padding: '10px 28px',
                  background: 'transparent', color: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
                }}
              >
                enable camera
              </button>
              <button
                onClick={() => setSelfPermission('granted')}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                skip
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
                camera access denied
              </div>
              <button
                onClick={() => setSelfPermission('idle')}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                  padding: '6px 16px', background: 'transparent',
                  color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.12)',
                  cursor: 'pointer',
                }}
              >
                try again
              </button>
              <button
                onClick={() => setSelfPermission('granted')}
                style={{
                  fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: 1,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                skip
              </button>
            </>
          )}
        </div>
      )}

      {/* About button */}
      {phase === 'gallery' && !selectedStudent && !uiHidden && (
        <button
          onClick={() => setShowAbout(v => !v)}
          style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 60,
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
            textTransform: 'uppercase', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 0,
            color: showAbout ? 'rgb(0, 0, 0)' : 'rgb(0, 0, 0)',
            transition: 'color 0.15s',
          }}
        >
          {showAbout ? 'close' : 'about'}
        </button>
      )}

      {/* About overlay */}
      {showAbout && phase === 'gallery' && !uiHidden && (
        <div
          onClick={() => setShowAbout(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '64px 24px 40px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="about-scroll"
            style={{ maxWidth: 720, width: '100%', maxHeight: '100%', overflowY: 'auto', paddingRight: 28 }}
          >
            <p style={{
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2,
              color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
            }}>{`"The action of being is so revolutionary that society rejects it and concerns itself exclusively with the action of becoming."

— Jiddu Krishnamurti

REPLY is a collaborative work by students of the Free University of Georgia, a meditation on digital identity, performed selfhood, and what gets lost in translation.

Every platform demands a different version of us. The visual self. The political self. The one who informs, the one who entertains. Collectively, they account for everything except the self that simply exists.

In search of the self, each student developed their own writing system, a personal visual language designed not for legibility, but for honesty. Something to be felt rather than decoded.

REPLY is a virtual art exhibition that abandons natural language as its framework, presenting each participant through a visual representation that resists performance and asks, instead, for presence.

Visitors are also invited to construct their own version, to reply, and in that act, to consider what genuine dialogue between selves might actually look like, to say what they truly feel, without being observed, evaluated, or judged. Only felt.`}</p>
            <img
              src="/credits.png"
              alt="Student signatures"
              style={{ width: '100%', maxWidth: 560, display: 'block', margin: '32px auto', mixBlendMode: 'multiply' }}
            />
            <p style={{
              fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2,
              color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em',
              whiteSpace: 'pre-line',
            }}>{`Students
Mariam Wulaia, Nodar Gogichaishvili,  Dominika Davshrishovi, Salome Shalvashvili, Nutsa Kavtelishvili, Ketevan Lomiashvili, Mariam Qsovreli, Ana Mamniashvili, Bako Shengelia, Sergi Sarajevi, Natali Chixelidze

Teacher
Oto Prangishvili`}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '24px 0 8px' }}>
              <img
                src="/FREEUNI.svg"
                alt="Free University of Georgia"
                style={{ height: 48, width: 'auto', display: 'block' }}
              />
              <span style={{
                fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 14, lineHeight: 2,
                color: 'rgba(0,0,0,0.75)', letterSpacing: '0.02em',
              }}>Free University of Georgia</span>
            </div>
          </div>
        </div>
      )}

      {/* Uni logo */}
      {!uiHidden && (
        <a
          href="https://www.freeuni.edu.ge/"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-20"
          style={isAdmin && !panelHidden ? { right: 286 } : {}}
        >
          <img src="/UNI.svg" alt="Free University of Tbilisi" className="h-8 w-auto" fetchPriority="low" />
        </a>
      )}

      {/* Open mark */}
      {!uiHidden && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
          <img src="/OPEN.svg" alt="Open" className="h-8 w-auto" fetchPriority="low" />
        </div>
      )}

      {/* Student selector — left panel, room view only */}
      {phase === 'gallery' && mountedView === 'room' && !selectedStudent && !uiHidden && (
        <div style={{
          position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 20,
          width: 160,
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '32px 0',
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
          overflowY: 'auto',
        }}>
          {STUDENTS.map(name => {
            const isSelf = name === 'SELF'
            const isSelected = isSelf ? viewMode === 'self' : selectedStudents.includes(name)
            return (
              <button
                key={name}
                onClick={() => handleStudentSelect(name)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '5px 16px',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  fontSize: 10, lineHeight: 1.4,
                  color: isSelected ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.35)',
                  transition: 'color 0.15s',
                }}>
                  {name}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* View — Safari/WebKit renders large blurs poorly, so it gets a plain
          opacity fade on the entry screen instead */}
      <div className="absolute inset-0" style={{
        ...(isAdmin && !panelHidden ? { right: 280 } : {}),
        filter: phase === 'entry' && !isWebKit ? 'blur(42.5px)' : undefined,
        opacity: phase === 'entry' && isWebKit ? 0.2 : undefined,
      }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-gray-300 text-sm animate-pulse">loading…</span>
          </div>
        )}
        {!loading && mountedView === 'room' && !selectedStudent && (
          <RoomCanvas key={roomKey} posts={posts.filter(p => !hiddenIds.has(p.id))} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexSettings={studentVertexSettings} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} roomCameraMode={roomCameraMode} roomCamFov={roomCamFov} roomCamZoom={roomCamZoom} roomCamXLoop={roomCamXLoop} roomCamXLoopSpeed={roomCamXLoopSpeed} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} figureRings={figureRings} soloReact={soloReact} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} nutsaGlbs={nutsaGlbs} nutsaGlbScale={nutsaGlbScale} nutsaGlbRepeat={nutsaGlbRepeat} drift={figureDrift} origShuffleSeed={roomShuffleSeeds[figureStudent ?? ''] ?? 0} mirrorShuffleSeed={roomShuffleSeeds[figureStudent2 ?? ''] ?? 0} captureRef={captureRef} />
        )}
        {!loading && !selectedStudent && (
          <div style={{ display: mountedView === 'circle' ? 'block' : 'none', position: 'absolute', inset: 0 }}>
            <CircleCanvas key={circleKey} posts={posts.filter(p => !hiddenIds.has(p.id))} students={STUDENTS.filter(s => s !== 'SELF')} circleRadius={circleRadius} figureScale={figureScale} figureY={circleFigureY + (isMobileVp ? circleFigureYM : 0)} figureFacing={circleFigureFacing} drift={figureDrift} showVertexImages={circleShowImages && introImagesReady} vertexSettings={studentVertexSettings} showWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={typeof window !== 'undefined' && window.innerWidth < 1000 ? circleDotSizeMobile : circleDotSize} dotColor={dotColor} dotCount={typeof window !== 'undefined' && window.innerWidth < 1000 ? circleDotCountMobile : dotCount} studentTextures={studentTextures} studentTextureMappings={studentTextureMappings} onTextureUpload={handleCircleTextureUpload} showNoiseGlobe={showNoiseGlobe} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} audioVolume={audioVolume} cameraMode={circleCameraMode} camX={circleCamX + (isMobileVp ? circleCamXM : 0)} camY={circleCamY + (isMobileVp ? circleCamYM : 0)} camZ={circleCamZ + (isMobileVp ? circleCamZM : 0)} camFov={circleCamFov} camZoom={circleCamZoom + (isMobileVp ? circleCamZoomM : 0)} camXLoop={circleCamXLoop} camXLoopSpeed={circleCamXLoopSpeed} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} cameraInfoRef={isAdmin ? circleCameraInfoRef : undefined} soloReact={false} isAdmin={isAdmin} frameloop={mountedView === 'circle' && phase !== 'entry' ? 'always' : 'demand'} lockPolar={introImagesReady} />
          </div>
        )}
        {!loading && (posts.length > 0 || visitorPosts.length > 0) && mountedView === 'globe' && !selectedStudent && (
          <GlobeCanvas
            posts={shuffledGlobePosts ?? visitorPosts}
            studentPosts={posts.filter(p => !hiddenIds.has(p.id))}
            vertexSettings={studentVertexSettings}
            showNames={showNames}
            nameSize={nameSize}
            showWireframe={showWireframe}
            wireframeSegments={wireframeSegments}
            wireframeOpacity={wireframeOpacity}
            wireframeColor={wireframeColor}
            showNoiseGlobe={showNoiseGlobe}
            audioVolume={audioVolume}
            analyserRef={analyserRef}
            noiseColor1={noiseColor1}
            noiseColor2={noiseColor2}
            noiseSpeed={noiseSpeed}
            noiseScale={noiseScale}
            blurNames={showAbout}
            onNameClick={openStudentRoom}
            namesClickable={phase === 'gallery'}
            bgColor={bgColor}
            bgImage={bgImage}
          />
        )}

        {/* SELF view */}
        {!loading && mountedView === 'self' && selfPermission === 'granted' && !selectedStudent && (
          <SelfCanvas stream={selfStream} figureScale={figureScale} figureFacing={figureFacing} imgSize={selfImgSize} imgCount={selfImgCount} bgColor={bgColor} bgImage={bgImage} images={selfImages} facing={selfFacing} analyserRef={selfSoundReact ? analyserRef : undefined} />
        )}

        {/* Personal student room */}
        {mountedStudent && (
          <RoomCanvas key={personalRoomKey} posts={posts.filter(p => p.student_name === mountedStudent)} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexSettings={studentVertexSettings} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} roomCameraMode={roomCameraMode} roomCamFov={roomCamFov} roomCamZoom={roomCamZoom} roomCamXLoop={roomCamXLoop} roomCamXLoopSpeed={roomCamXLoopSpeed} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} figureRings={figureRings} soloReact={soloReact} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} nutsaGlbs={nutsaGlbs} nutsaGlbScale={nutsaGlbScale} nutsaGlbRepeat={nutsaGlbRepeat} drift={figureDrift} captureRef={captureRef} />
        )}
      </div>

      {/* Student room back button */}
      {selectedStudent && !uiHidden && (
        <button
          onClick={closeStudentRoom}
          style={{
            position: 'fixed', top: 24, left: 24, zIndex: 60,
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 1.5,
            textTransform: 'uppercase', background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.7)',
            transition: 'color 0.15s',
          }}
        >
          ← back
        </button>
      )}

      {/* Student name label */}
      {selectedStudent && !uiHidden && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: 2,
          textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', pointerEvents: 'none',
        }}>
          {selectedStudent}
        </div>
      )}

      {/* Background controls — admin only */}
      {phase === 'gallery' && !selectedStudent && !uiHidden && isAdmin && (
        <div style={{
          position: 'fixed', top: 24, left: 24, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
        }}>
          {/* Color swatch — click to open color picker */}
          <label style={{ cursor: 'pointer', position: 'relative' }} title="Background color">
            <div style={{
              width: 22, height: 22,
              background: bgColor,
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: 2,
            }} />
            <input
              type="color" value={bgColor}
              onChange={e => setBgColor(e.target.value)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            />
          </label>
          {/* Upload background image */}
          <label style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, lineHeight: 1 }} title="Upload background image">
            bg
            <input
              type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file) return
                if (bgImageBlobRef.current) URL.revokeObjectURL(bgImageBlobRef.current)
                const url = URL.createObjectURL(file)
                bgImageBlobRef.current = url
                setBgImage(url)
                e.target.value = ''
              }}
            />
          </label>
          {bgImage && (
            <button
              onClick={() => {
                if (bgImageBlobRef.current) { URL.revokeObjectURL(bgImageBlobRef.current); bgImageBlobRef.current = null }
                setBgImage(null)
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 13, color: 'rgba(0,0,0,0.35)', lineHeight: 1 }}
            >×</button>
          )}
          {/* Upload post image */}
          <button
            onClick={() => setShowUpload(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, lineHeight: 1, display: 'block' }}
            title="Upload post image"
          >img</button>
          {/* Upload background audio */}
          <label style={{ cursor: 'pointer', fontSize: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: 0.5, lineHeight: 1 }} title="Replace background sound">
            mp3
            <input
              ref={soundInputRef}
              type="file" accept="audio/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) replaceBgAudio(e.target.files[0]); e.target.value = '' }}
            />
          </label>
        </div>
      )}

      {/* Intro quote overlay */}
      {phase === 'gallery' && !uiHidden && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          opacity: showQuote ? 1 : 0,
          transition: 'opacity 2s ease',
        }}>
          <p style={{
            width: isMobileVp ? '70%' : '50%', textAlign: 'center',
            fontFamily: 'var(--font-dm-mono), ui-monospace, monospace',
            fontWeight: 300, fontSize: isMobileVp ? 16 : 18, lineHeight: 1.75,
            color: 'rgba(0, 0, 0, 0.85)', textTransform: 'uppercase',
          }}>
            The action of being is so revolutionary that society rejects it{isMobileVp ? ' ' : <br/>}and concerns itself exclusively with the action of becoming.<br/>– Jiddu Krishnamurti
          </p>
        </div>
      )}

      {/* Admin panel */}
      {isAdmin && (
        <AdminPanel
          admin={admin} setAdmin={setAdmin}
          viewMode={viewMode} setViewMode={switchView}
          hiddenCount={hiddenIds.size} resetTimebomb={() => setHiddenIds(new Set())}
          vertexImgSize={getVS(figureStudent).imgSize} setVertexImgSize={v => setVSKey(figureStudent, 'imgSize', v)}
          vertexRepeat={getVS(figureStudent).repeat} setVertexRepeat={v => setVSKey(figureStudent, 'repeat', v)}
          vertexAudioImgSize={getVS(figureStudent).audioImgSize ?? getVS(figureStudent).imgSize} setVertexAudioImgSize={v => setVSKey(figureStudent, 'audioImgSize', v)}
          vertexAudioRepeat={getVS(figureStudent).audioRepeat ?? getVS(figureStudent).repeat} setVertexAudioRepeat={v => setVSKey(figureStudent, 'audioRepeat', v)}
          onAdminUpload={handleAdminUpload}
          circleCameraInfoRef={circleCameraInfoRef}
          studentTextures={studentTextures} setStudentTextures={setStudentTextures}
          nutsaGlbs={nutsaGlbs} setNutsaGlbs={setNutsaGlbs}
          hidden={panelHidden || uiHidden}
          phase={phase}
          circleFacing={studentVertexSettings[STUDENTS[0]]?.facing ?? 'camera'}
          setCircleFacing={v => setStudentVertexSettings(p => Object.fromEntries(
            STUDENTS.map(s => [s, { ...(p[s] ?? DEF_VS), facing: v }])
          ))}
          studentVertexSettings={studentVertexSettings}
          updateStudentVS={(name, updates) => setStudentVertexSettings(p => ({ ...p, [name]: { ...(p[name] ?? DEF_VS), ...updates } }))}
          onCapture={() => captureRef.current?.()}
        />
      )}

      {/* Intro overlay */}
      {phase !== 'gallery' && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ right: isAdmin && !panelHidden ? 280 : 0 }}
        >

          {phase === 'entry' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#ffffff' }}>
              {/* full-screen gradient blob */}
              <div style={{
                position: 'absolute', right: '2%', bottom: '10%',
                width: '50%', height: '70%',
                background: 'radial-gradient(ellipse at 60% 60%, rgba(210,155,165,0.45) 0%, rgba(185,145,175,0.25) 35%, transparent 68%)',
                filter: 'blur(55px)',
                pointerEvents: 'none',
              }} />
              {/* REPLY svg */}
              <div style={{ flex: 1, width: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={['/reply.svg', '/reply1.svg', '/reply2.svg'][replyFrame]} alt="REPLY" style={{ width: '88%', height: 'auto', position: 'relative' }} />
              </div>
              {/* buttons */}
              <div style={{ paddingBottom: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                <button
                  onClick={() => {
                    setWithSound(true)
                    startBgAudio(true)
                    goToGallery()
                  }}
                  style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.75)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >ENTER WITH SOUND</button>
                <button
                  onClick={() => {
                    setWithSound(false)
                    startBgAudio(false)
                    goToGallery()
                  }}
                  style={{ fontFamily: 'var(--font-dm-mono), ui-monospace, monospace', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >ENTER WITHOUT SOUND</button>
              </div>
            </div>
          )}


        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center" style={isAdmin && !panelHidden ? { right: 280 } : {}}>
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
                <input ref={fileInputRef} type="file" accept="image/*,image/svg+xml" multiple className="hidden" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {/* Student name selector */}
              <div className="shrink-0">
                <select
                  value={uploadStudentName}
                  onChange={e => setUploadStudentName(e.target.value)}
                  className="w-full font-mono text-xs border border-gray-200 rounded-lg px-3 py-2 focus:border-black outline-none bg-white"
                >
                  <option value="">— select your name —</option>
                  {STUDENTS.filter(s => s !== 'SELF').map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              {items.length > 0 && (
                <div className="overflow-y-auto flex flex-col gap-2 min-h-0">
                  <div className="flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => { items.forEach(it => URL.revokeObjectURL(it.preview)); setItems([]) }}
                      className="font-mono text-xs text-gray-400 hover:text-black transition-colors"
                    >clear all</button>
                  </div>
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
