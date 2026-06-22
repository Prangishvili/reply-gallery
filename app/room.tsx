'use client'

import React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, Html, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'
import { saveCircleCam } from '@/app/lib/circle-cam-state'
import { NoiseGlobe } from './globe'
import {
  IS_MOBILE, TEX_MAX_DIM, POSTS_PER_FIGURE,
  WireframeStyle,
  sampleVerticesWithNormals,
  getCachedTex, prefetchPostImages,
  FigureVertexImages, FigureWireframe, FigureRings,
} from './lib/figure-parts'
export { FigureVertexImages, FigureWireframe, FigureRings, prefetchPostImages }
export type { WireframeStyle }

// ── Constants ─────────────────────────────────────────────────────────────────
const W   = 480   // room width = depth (square)
const H   = 400   // room height
const D   = W     // square floor plan
const EYE = 22.5  // camera eye height

const MAX_DPR = IS_MOBILE ? 1.5 : 2

// ── Background ────────────────────────────────────────────────────────────────
function BackgroundSetter({ color, image }: { color: string; image: string | null }) {
  const { scene } = useThree()
  useEffect(() => {
    if (image) {
      let cancelled = false
      let tex: THREE.Texture | null = null
      new THREE.TextureLoader().load(image, t => {
        if (cancelled) { t.dispose(); return }
        t.colorSpace = THREE.SRGBColorSpace; tex = t; scene.background = t
      })
      return () => { cancelled = true; tex?.dispose(); scene.background = null }
    }
    scene.background = new THREE.Color(color)
    return () => { scene.background = null }
  }, [color, image, scene])
  return null
}

// ── Free-roam controls ────────────────────────────────────────────────────────
function RoomControls({ camX, camY, camZ, disabled = false }: { camX: number; camY: number; camZ: number; disabled?: boolean }) {
  const { camera, gl } = useThree()
  const yaw   = useRef(0)
  const pitch = useRef(0)
  const pos   = useRef(new THREE.Vector3(camX, camY, camZ))
  const vel   = useRef({ yaw: 0, pitch: 0 })
  const down  = useRef(false)
  const last  = useRef({ x: 0, y: 0 })
  const keys  = useRef({ w: false, a: false, s: false, d: false })

  useEffect(() => { pos.current.set(camX, camY, camZ) }, [camX, camY, camZ])

  useEffect(() => {
    const c = gl.domElement
    const onDown = (e: PointerEvent) => {
      if (disabled) return
      down.current = true; vel.current = { yaw: 0, pitch: 0 }
      last.current = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (disabled || !down.current) return
      const dx = (e.clientX - last.current.x) * 0.004
      const dy = (e.clientY - last.current.y) * 0.004
      yaw.current   -= dx
      pitch.current  = Math.max(-1.5, Math.min(1.5, pitch.current - dy))
      vel.current    = { yaw: -dx, pitch: -dy }
      last.current   = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => { down.current = false }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')    keys.current.w = true
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown')  keys.current.s = true
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  keys.current.a = true
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.current.d = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')    keys.current.w = false
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown')  keys.current.s = false
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  keys.current.a = false
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') keys.current.d = false
    }
    c.addEventListener('pointerdown', onDown)
    c.addEventListener('pointermove', onMove)
    c.addEventListener('pointerup', onUp)
    c.addEventListener('pointercancel', onUp)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      c.removeEventListener('pointerdown', onDown)
      c.removeEventListener('pointermove', onMove)
      c.removeEventListener('pointerup', onUp)
      c.removeEventListener('pointercancel', onUp)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [gl, disabled])

  useFrame((_, delta) => {
    if (!down.current) {
      yaw.current   += vel.current.yaw
      pitch.current  = Math.max(-1.5, Math.min(1.5, pitch.current + vel.current.pitch))
      vel.current.yaw   *= 0.88
      vel.current.pitch *= 0.88
    }
    const speed = 80 * delta
    const cy = Math.cos(pitch.current), sy = Math.sin(pitch.current)
    const fwd   = new THREE.Vector3(-Math.sin(yaw.current) * cy, sy,  -Math.cos(yaw.current) * cy)
    const right = new THREE.Vector3( Math.cos(yaw.current),      0,   -Math.sin(yaw.current))
    if (keys.current.w) pos.current.addScaledVector(fwd,   speed)
    if (keys.current.s) pos.current.addScaledVector(fwd,  -speed)
    if (keys.current.a) pos.current.addScaledVector(right, -speed)
    if (keys.current.d) pos.current.addScaledVector(right,  speed)
    camera.position.copy(pos.current)
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
  })

  return null
}

function GLBAtVertex({ url, position, size, mouseTargetRef, volRef }: { url: string; position: [number, number, number]; size: number; mouseTargetRef: React.RefObject<THREE.Vector3>; volRef: React.RefObject<number> }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef<THREE.Group>(null)
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const toBasic = (mat: THREE.Material) => {
        const src = mat as THREE.MeshStandardMaterial
        const bm = new THREE.MeshBasicMaterial({
          map: src.map ?? null,
          color: src.map ? 0xffffff : (src.color ?? new THREE.Color(0xffffff)),
          transparent: src.transparent,
          alphaTest: src.alphaTest,
          side: src.side ?? THREE.FrontSide,
        })
        bm.needsUpdate = true
        return bm
      }
      m.material = Array.isArray(m.material) ? m.material.map(toBasic) : toBasic(m.material as THREE.Material)
    })
    return c
  }, [scene])
  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.lookAt(mouseTargetRef.current)
    const s = size * (1 + volRef.current * 3)
    groupRef.current.scale.setScalar(s)
  })
  return (
    <group ref={groupRef} position={position} scale={size}>
      <primitive object={cloned} />
    </group>
  )
}

function FigureVertexGLBModels({ scene, glbUrls, size, repeat, analyserRef }: { scene: THREE.Object3D; glbUrls: string[]; size: number; repeat: number; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  const { camera, pointer } = useThree()
  const mouseTargetRef = useRef(new THREE.Vector3())
  const _ray = useRef(new THREE.Vector3())
  const volRef = useRef(0)
  const dataArrRef = useRef<Uint8Array | null>(null)
  useFrame(() => {
    _ray.current.set(pointer.x, pointer.y, 0.5).unproject(camera)
    _ray.current.sub(camera.position).normalize()
    mouseTargetRef.current.copy(camera.position).addScaledVector(_ray.current, 800)
    if (analyserRef?.current) {
      const a = analyserRef.current
      if (!dataArrRef.current || dataArrRef.current.length !== a.frequencyBinCount)
        dataArrRef.current = new Uint8Array(a.frequencyBinCount)
      a.getByteFrequencyData(dataArrRef.current as Uint8Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < dataArrRef.current.length; i++) sum += dataArrRef.current[i]
      volRef.current = Math.min((sum / dataArrRef.current.length / 255) * 2, 1)
    } else {
      volRef.current = 0
    }
  })
  const samples = useMemo(() => {
    return sampleVerticesWithNormals(scene, repeat).map(v => ({
      pos: [v.pos.x + v.normal.x * 0.02, v.pos.y + v.normal.y * 0.02, v.pos.z + v.normal.z * 0.02] as [number, number, number],
    }))
  }, [scene, repeat])
  return (
    <>
      {samples.map((s, i) => (
        <Suspense key={i} fallback={null}>
          <GLBAtVertex url={glbUrls[i % glbUrls.length]} position={s.pos} size={size} mouseTargetRef={mouseTargetRef} volRef={volRef} />
        </Suspense>
      ))}
    </>
  )
}

export type RoomCameraMode = 'freeroam' | 'perspective' | 'orthographic' | 'panoramic'

// ── Graffiti paint figure ─────────────────────────────────────────────────────
const GRAFFITI_SIZE = 2048

type GraffitiDrip = {
  x: number; y: number; startY: number; color: string
  r: number; speed: number; life: number; decay: number; maxDist: number
}

function sprayPaint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  // Soft dense core
  ctx.save()
  ctx.filter = `blur(${Math.max(1, r * 0.35)}px)`
  ctx.beginPath()
  ctx.arc(x, y, r * 0.6, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.78
  ctx.fill()
  ctx.restore()

  // Spray particles — exponential distance falloff from center
  const count = Math.min(450, Math.max(20, Math.floor(r * r * 0.28)))
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.min(r * 2.4, -Math.log(Math.random() + 0.001) * r * 0.38)
    const px = x + Math.cos(angle) * dist
    const py = y + Math.sin(angle) * dist
    const norm = dist / r
    const pr = Math.max(0.4, (0.8 + Math.random() * 1.8) * Math.max(0.2, 1 - norm * 0.55))
    ctx.globalAlpha = Math.max(0, (0.5 + Math.random() * 0.5) * (1 - norm * 0.38))
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // A few random larger splats at the fringe
  ctx.save()
  ctx.fillStyle = color
  const splats = 1 + Math.floor(Math.random() * 4)
  for (let i = 0; i < splats; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = (0.45 + Math.random() * 1.2) * r
    ctx.globalAlpha = 0.5 + Math.random() * 0.4
    ctx.beginPath()
    ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 1.5 + Math.random() * 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function GraffitiPaintFigure({ scene, brushColor, brushSize, clearKey, active }: {
  scene: THREE.Object3D; brushColor: string; brushSize: number; clearKey: number; active: boolean
}) {
  const { gl } = useThree()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const texRef    = useRef<THREE.CanvasTexture | null>(null)
  const painting  = useRef(false)
  const colorRef  = useRef(brushColor)
  const sizeRef   = useRef(brushSize)
  const dripsRef  = useRef<GraffitiDrip[]>([])
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => { colorRef.current = brushColor }, [brushColor])
  useEffect(() => { sizeRef.current  = brushSize  }, [brushSize])

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = Array.isArray(m.material)
        ? m.material.map((mt: THREE.Material) => mt.clone())
        : (m.material as THREE.Material).clone()
    })
    return c
  }, [scene])

  useEffect(() => {
    cloned.updateMatrixWorld(true)
    const rootInv = new THREE.Matrix4().copy(cloned.matrixWorld).invert()
    const bbox = new THREE.Box3()
    cloned.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const pos = m.geometry.getAttribute('position')
      const mat = new THREE.Matrix4().copy(m.matrixWorld).premultiply(rootInv)
      for (let i = 0; i < pos.count; i++) {
        bbox.expandByPoint(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mat))
      }
    })
    const bsize = new THREE.Vector3(); bbox.getSize(bsize)

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = GRAFFITI_SIZE
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#a0a0a0'
    ctx.fillRect(0, 0, GRAFFITI_SIZE, GRAFFITI_SIZE)
    canvasRef.current = canvas

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    texRef.current = tex

    cloned.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const pos = m.geometry.getAttribute('position')
      const mat = new THREE.Matrix4().copy(m.matrixWorld).premultiply(rootInv)
      const uvs = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mat)
        const rawU = bsize.x > 0 ? (v.x - bbox.min.x) / bsize.x : 0
        // Z-split: front half (z ≥ center) → U in [0, 0.5], back half → [0.5, 1]
        // Keeps front and back UV regions non-overlapping so paint only shows on the hit side
        const normZ = bsize.z > 0 ? (v.z - bbox.min.z) / bsize.z : 0.5
        uvs[i * 2]     = normZ >= 0.5 ? rawU * 0.5 : 0.5 + rawU * 0.5
        uvs[i * 2 + 1] = bsize.y > 0 ? (v.y - bbox.min.y) / bsize.y : 0
      }
      m.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
      m.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    })

    return () => { tex.dispose(); texRef.current = null; canvasRef.current = null }
  }, [cloned])

  useEffect(() => {
    gl.domElement.style.cursor = active ? 'crosshair' : ''
    return () => { gl.domElement.style.cursor = '' }
  }, [active, gl])

  useEffect(() => {
    if (clearKey === 0 || !canvasRef.current || !texRef.current) return
    dripsRef.current = []
    const ctx = canvasRef.current.getContext('2d')!
    ctx.fillStyle = '#a0a0a0'
    ctx.fillRect(0, 0, GRAFFITI_SIZE, GRAFFITI_SIZE)
    texRef.current.needsUpdate = true
  }, [clearKey])

  // Animate drips each frame — each drip has its own max travel distance
  useFrame((_, delta) => {
    const drips = dripsRef.current
    if (drips.length === 0) return
    const canvas = canvasRef.current; const tex = texRef.current
    if (!canvas || !tex) return
    const ctx = canvas.getContext('2d')!
    let dirty = false
    for (const d of drips) {
      if (d.life <= 0) continue
      // Stop drip once it has traveled its random max distance
      const traveled = d.y - d.startY
      if (traveled >= d.maxDist) { d.life = 0; continue }
      dirty = true
      const prevY = d.y
      // Slow down as drip approaches its limit
      const remaining = Math.max(0, 1 - traveled / d.maxDist)
      d.y    += d.speed * delta * (0.3 + remaining * 0.7)
      d.life -= d.decay * delta
      ctx.save()
      ctx.filter = `blur(${Math.max(0.5, d.r * 0.6)}px)`
      ctx.beginPath()
      ctx.moveTo(d.x, prevY)
      ctx.lineTo(d.x, d.y + d.r * 0.4)
      ctx.strokeStyle = d.color
      ctx.lineWidth = d.r * 1.8 * remaining  // taper toward tip
      ctx.lineCap = 'round'
      ctx.globalAlpha = Math.max(0, d.life) * 0.82 * remaining
      ctx.stroke()
      ctx.restore()
    }
    if (dirty) tex.needsUpdate = true
    dripsRef.current = drips.filter(d => d.life > 0 && d.y - d.startY < d.maxDist)
  })

  const spawnDrips = useCallback((x: number, y: number, r: number, color: string) => {
    if (dripsRef.current.length >= 60) return
    const count = 1 + (Math.random() < 0.45 ? 1 : 0)
    for (let i = 0; i < count; i++) {
      // maxDist: random 1.5×–5.5× brush radius, capped at 600px
      const maxDist = Math.min(600, r * (1.5 + Math.random() * 2))
      dripsRef.current.push({
        x: x + (Math.random() - 0.5) * r * 1.2,
        y: y + r * 0.6,
        startY: y + r * 0.6,
        color,
        r: r * (0.09 + Math.random() * 0.08),
        speed: 140 + Math.random() * 230,
        life: 0.9 + Math.random() * 0.1,
        decay: 0.18 + Math.random() * 0.25,
        maxDist,
      })
    }
  }, [])

  const doPaint = useCallback((e: any, isDown: boolean) => {
    if (!e.uv || !canvasRef.current || !texRef.current) return
    const x = e.uv.x * GRAFFITI_SIZE
    const y = (1 - e.uv.y) * GRAFFITI_SIZE
    const r = sizeRef.current * 5
    const color = colorRef.current
    const ctx = canvasRef.current.getContext('2d')!

    sprayPaint(ctx, x, y, r, color)
    texRef.current.needsUpdate = true

    const last = lastPosRef.current
    const dist = last ? Math.hypot(x - last.x, y - last.y) : Infinity
    if (isDown || dist > r * 2.5) {
      spawnDrips(x, y, r, color)
      lastPosRef.current = { x, y }
    }
  }, [spawnDrips])

  return (
    <primitive
      object={cloned}
      onPointerDown={(e: any) => {
        if (!active) return
        painting.current = true
        lastPosRef.current = null
        doPaint(e, true)
        e.stopPropagation()
      }}
      onPointerMove={(e: any) => {
        if (!active || !painting.current) return
        doPaint(e, false)
        e.stopPropagation()
      }}
      onPointerUp={() => { painting.current = false; lastPosRef.current = null }}
      onPointerLeave={() => { painting.current = false; lastPosRef.current = null }}
    />
  )
}


// ── Orbiting figure pair (original + mirror) ──────────────────────────────────
function studentGlb(_name: string | null | undefined): string {
  return '/figure.glb'
}

type FigurePairProps = {
  roomDepth: number; radius: number; speed: number
  x: number; y: number; z: number
  figureScale: number; figureFacing: number; figureWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  posts: Post[]; mirrorPosts: Post[]; showVertexImages: boolean
  origImgSize: number; origRepeat: number; origAudioImgSize?: number; origAudioRepeat?: number; origFacing?: 'camera' | 'normal'; origDriftSpeed?: number; origDriftAmp?: number; origDriftEnabled?: boolean
  mirrorImgSize: number; mirrorRepeat: number; mirrorAudioImgSize?: number; mirrorAudioRepeat?: number; mirrorFacing?: 'camera' | 'normal'; mirrorDriftSpeed?: number; mirrorDriftAmp?: number; mirrorDriftEnabled?: boolean
  orbiting: boolean
  meshTexture: string | null
  texScale: number; texOffsetX: number; texOffsetY: number; texRotation: number
  transitionKey: number
  figureRingsOrig: boolean; figureRingsMirror: boolean
  soloReact: boolean
  graffitiOrig: boolean; graffitiMirror: boolean
  graffitiMode: boolean; graffitiColor: string; graffitiBrushSize: number; graffitiClearKey: number
  analyserRef?: React.RefObject<AnalyserNode | null>
  origStudent?: string | null; mirrorStudent?: string | null
  nutsaGlbs?: string[]
  nutsaGlbScale?: number; nutsaGlbRepeat?: number
  drift?: boolean
  origShuffleSeed?: number; mirrorShuffleSeed?: number
}
function FigurePair({ roomDepth, radius, speed, x, y, z, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, posts, mirrorPosts, showVertexImages, origImgSize, origRepeat, origAudioImgSize, origAudioRepeat, origFacing, origDriftSpeed, origDriftAmp, origDriftEnabled, mirrorImgSize, mirrorRepeat, mirrorAudioImgSize, mirrorAudioRepeat, mirrorFacing, mirrorDriftSpeed, mirrorDriftAmp, mirrorDriftEnabled, orbiting, meshTexture, texScale, texOffsetX, texOffsetY, texRotation, transitionKey, figureRingsOrig, figureRingsMirror, soloReact, graffitiOrig, graffitiMirror, graffitiMode, graffitiColor, graffitiBrushSize, graffitiClearKey, analyserRef, origStudent, mirrorStudent, nutsaGlbs, nutsaGlbScale = 0.025, nutsaGlbRepeat = 1, drift = false, origShuffleSeed = 0, mirrorShuffleSeed = 0 }: FigurePairProps) {
  const { scene: origScene }   = useGLTF(studentGlb(origStudent))
  const { scene: mirrorScene } = useGLTF(studentGlb(mirrorStudent))

  const cloneWithMats = (s: THREE.Object3D) => {
    const c = s.clone(true)
    c.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = Array.isArray(m.material) ? m.material.map(mt => mt.clone()) : (m.material as THREE.Material).clone()
    })
    return c
  }

  const orig   = useMemo(() => cloneWithMats(origScene),   [origScene])
  const mirror = useMemo(() => cloneWithMats(mirrorScene), [mirrorScene])

  const [activeReact, setActiveReact] = useState(0)
  const soloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (soloTimerRef.current) clearTimeout(soloTimerRef.current)
    if (!soloReact) return
    const schedule = () => {
      const delay = (1 + Math.random() * 2) * 1000
      soloTimerRef.current = setTimeout(() => {
        setActiveReact(p => p === 0 ? 1 : 0)
        schedule()
      }, delay)
    }
    schedule()
    return () => { if (soloTimerRef.current) clearTimeout(soloTimerRef.current) }
  }, [soloReact])
  const groupRef = useRef<THREE.Group>(null)
  const loadedTexRef = useRef<THREE.Texture | null>(null)

  const [origLoaded, setOrigLoaded]     = useState(false)
  const [mirrorLoaded, setMirrorLoaded] = useState(false)
  useEffect(() => { setOrigLoaded(false) },   [origStudent, showVertexImages])
  useEffect(() => { setMirrorLoaded(false) }, [mirrorStudent, showVertexImages])

  const origAnalyser   = !soloReact || activeReact === 0 ? analyserRef : undefined
  const mirrorAnalyser = !soloReact || activeReact === 1 ? analyserRef : undefined

  // Mesh visibility: always show when texture applied, otherwise hide when wireframe on
  useEffect(() => {
    ;[orig, mirror].forEach(s => s.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material as THREE.Material]
      mats.forEach((mt: THREE.Material) => { mt.visible = meshTexture ? true : !figureWireframe })
    }))
  }, [orig, mirror, figureWireframe, meshTexture])

  // Mesh texture: swap material to MeshBasicMaterial (no lighting needed) when texture set
  useEffect(() => {
    const getMeshes = (root: THREE.Object3D) => {
      const meshes: THREE.Mesh[] = []
      root.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
      return meshes
    }

    if (!meshTexture) {
      // Restore original cloned materials (dispose any basic mat we added)
      ;[[orig, origScene], [mirror, mirrorScene]].forEach(([root, src]) => {
        getMeshes(root as THREE.Object3D).forEach(m => {
          if ((m.material as THREE.Material).type === 'MeshBasicMaterial') {
            ;(m.material as THREE.MeshBasicMaterial).map?.dispose()
            ;(m.material as THREE.Material).dispose()
            const srcMeshes = getMeshes(src as THREE.Object3D)
            const match = srcMeshes.find(s => s.name === m.name)
            if (match) m.material = (match.material as THREE.Material).clone()
          }
        })
      })
      return
    }

    // Generate planar UV coords from bounding box (x→U, y→V)
    const generateUVs = (geo: THREE.BufferGeometry) => {
      geo.computeBoundingBox()
      const bbox = geo.boundingBox!
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const pos = geo.attributes.position
      const uvs = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2]     = size.x > 0 ? (pos.getX(i) - bbox.min.x) / size.x : 0
        uvs[i * 2 + 1] = size.y > 0 ? (pos.getY(i) - bbox.min.y) / size.y : 0
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    }

    let cancelled = false
    new THREE.TextureLoader().load(meshTexture, tex => {
      if (cancelled) { tex.dispose(); return }
      tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      loadedTexRef.current = tex
      ;[orig, mirror].forEach(root => {
        getMeshes(root).forEach(m => {
          generateUVs(m.geometry)
          if ((m.material as THREE.Material).type === 'MeshBasicMaterial') {
            ;(m.material as THREE.Material).dispose()
          }
          m.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.01 })
        })
      })
    })
    return () => { cancelled = true; loadedTexRef.current = null }
  }, [meshTexture, orig, mirror, origScene, mirrorScene])

  // Live-update texture mapping controls
  useEffect(() => {
    const tex = loadedTexRef.current
    if (!tex) return
    tex.repeat.set(texScale, texScale)
    tex.offset.set(texOffsetX, texOffsetY)
    tex.rotation = texRotation * (Math.PI / 180)
    tex.center.set(0.5, 0.5)
    tex.needsUpdate = true
  }, [texScale, texOffsetX, texOffsetY, texRotation])

  useFrame((_, delta) => {
    if (groupRef.current && orbiting) groupRef.current.rotation.y += speed * delta
  })

  return (
    <group ref={groupRef} position={[x, y, -(roomDepth / 2) + z]}>
      <group position={orbiting ? [radius, 0, 0] : [0, 0, 0]} scale={figureScale} rotation={[0, figureFacing, 0]}>
        {graffitiOrig ? (
          <GraffitiPaintFigure scene={orig} brushColor={graffitiColor} brushSize={graffitiBrushSize} clearKey={graffitiClearKey} active={graffitiMode} />
        ) : (
          <>
            <primitive object={orig} />
            {figureWireframe && !figureRingsOrig && !(showVertexImages && origLoaded) && origStudent !== 'Sesili Gurgenidze' && <FigureWireframe scene={orig} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={transitionKey} flicker />}
            {figureRingsOrig && <FigureRings scene={orig} analyserRef={origAnalyser} />}
            {showVertexImages && origStudent === 'Nutsa Kavtelishvili' && !!nutsaGlbs?.length && (
              <FigureVertexGLBModels scene={orig} glbUrls={nutsaGlbs} size={nutsaGlbScale} repeat={nutsaGlbRepeat} analyserRef={origAnalyser} />
            )}
            {showVertexImages && !(origStudent === 'Nutsa Kavtelishvili' && nutsaGlbs?.length) && posts.length > 0 && (
              <Suspense fallback={null}>
                <FigureVertexImages key={origStudent ?? 'none'} scene={orig} posts={posts} size={origImgSize} repeat={origRepeat} audioImgSize={origAudioImgSize} audioRepeat={origAudioRepeat} facing={origFacing} analyserRef={origAnalyser} showConnections={origStudent === 'Sesili Gurgenidze'} drift={drift && origDriftEnabled !== false} driftSpeed={origDriftSpeed} driftAmp={origDriftAmp} onLoaded={() => setOrigLoaded(true)} shuffleSeed={origShuffleSeed} />
              </Suspense>
            )}
          </>
        )}
      </group>
      {orbiting && (
        <group position={[-radius, 0, 0]} scale={[-figureScale, figureScale, figureScale]} rotation={[0, -figureFacing, 0]}>
          {graffitiMirror ? (
            <GraffitiPaintFigure scene={mirror} brushColor={graffitiColor} brushSize={graffitiBrushSize} clearKey={graffitiClearKey} active={graffitiMode} />
          ) : (
            <>
              <primitive object={mirror} />
              {figureWireframe && !figureRingsMirror && !(showVertexImages && mirrorLoaded) && mirrorStudent !== 'Sesili Gurgenidze' && <FigureWireframe scene={mirror} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={transitionKey} />}
              {figureRingsMirror && <FigureRings scene={mirror} analyserRef={mirrorAnalyser} />}
              {showVertexImages && mirrorStudent === 'Nutsa Kavtelishvili' && !!nutsaGlbs?.length && (
                <FigureVertexGLBModels scene={mirror} glbUrls={nutsaGlbs} size={nutsaGlbScale} repeat={nutsaGlbRepeat} analyserRef={mirrorAnalyser} />
              )}
              {showVertexImages && !(mirrorStudent === 'Nutsa Kavtelishvili' && nutsaGlbs?.length) && mirrorPosts.length > 0 && (
                <Suspense fallback={null}>
                  <FigureVertexImages key={mirrorStudent ?? 'none'} scene={mirror} posts={mirrorPosts} size={mirrorImgSize} repeat={mirrorRepeat} audioImgSize={mirrorAudioImgSize} audioRepeat={mirrorAudioRepeat} facing={mirrorFacing} analyserRef={mirrorAnalyser} showConnections={mirrorStudent === 'Sesili Gurgenidze'} drift={drift && mirrorDriftEnabled !== false} driftSpeed={mirrorDriftSpeed} driftAmp={mirrorDriftAmp} onLoaded={() => setMirrorLoaded(true)} shuffleSeed={mirrorShuffleSeed} />
                </Suspense>
              )}
            </>
          )}
        </group>
      )}
    </group>
  )
}

// ── Doggo model ───────────────────────────────────────────────────────────────
type DoggoProps = { roomDepth: number; scale: number; x: number; y: number; z: number }
function Doggo({ roomDepth, scale, x, y, z }: DoggoProps) {
  const { scene } = useGLTF('/doggo.glb')
  return <primitive object={scene} position={[x, y, -(roomDepth / 2) + z]} scale={scale} />
}

// ── Room geometry ─────────────────────────────────────────────────────────────
type RoomSceneProps = {
  posts: Post[]
  showDoggo: boolean; doggoScale: number; doggoX: number; doggoY: number; doggoZ: number
  showFigure: boolean; figureRadius: number; figureSpeed: number; figureX: number; figureY: number; figureZ: number
  figureScale: number; figureFacing: number; figureWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  showVertexImages: boolean; vertexSettings: Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal'; driftSpeed?: number; driftAmp?: number; driftEnabled?: boolean }>
  figureStudent: string | null; figureStudent2: string | null
  figureOrbiting: boolean
  camX: number; camY: number; camZ: number
  roomCameraMode: RoomCameraMode; roomCamFov: number; roomCamZoom: number; roomCamXLoop: boolean; roomCamXLoopSpeed: number
  meshTexture: string | null
  texScale: number; texOffsetX: number; texOffsetY: number; texRotation: number
  transitionKey: number
  figureRings: boolean; soloReact: boolean
  graffitiMode: boolean; graffitiColor: string; graffitiBrushSize: number; graffitiClearKey: number
  bgColor: string; bgImage: string | null
  analyserRef?: React.RefObject<AnalyserNode | null>
  nutsaGlbs?: string[]
  nutsaGlbScale?: number; nutsaGlbRepeat?: number
  drift?: boolean
  origShuffleSeed?: number; mirrorShuffleSeed?: number
}
function RoomScene({ posts, showDoggo, doggoScale, doggoX, doggoY, doggoZ, showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, showVertexImages, vertexSettings, figureStudent, figureStudent2, figureOrbiting, camX, camY, camZ, roomCameraMode, roomCamFov, roomCamZoom, roomCamXLoop, roomCamXLoopSpeed, meshTexture, texScale, texOffsetX, texOffsetY, texRotation, transitionKey, figureRings, soloReact, graffitiMode, graffitiColor, graffitiBrushSize, graffitiClearKey, bgColor, bgImage, analyserRef, nutsaGlbs, nutsaGlbScale, nutsaGlbRepeat, drift = false, origShuffleSeed = 0, mirrorShuffleSeed = 0 }: RoomSceneProps) {
  const match = (a: string | null | undefined, b: string | null) =>
    a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const figurePosts  = figureStudent  ? posts.filter(p => match(p.student_name, figureStudent))  : posts
  const mirrorPosts  = figureStudent2 ? posts.filter(p => match(p.student_name, figureStudent2)) : posts
  const isSergi  = (s: string | null) => !!s?.trim().toLowerCase().includes('sergi')
  const figureRingsOrig   = figureRings && isSergi(figureStudent)
  const figureRingsMirror = figureRings && isSergi(figureStudent2)
  const graffitiOrig   = false
  const graffitiMirror = false
  const DEF = { imgSize: 0.025, repeat: 1, audioImgSize: undefined as number | undefined, audioRepeat: undefined as number | undefined, facing: 'normal' as 'camera' | 'normal', driftSpeed: undefined as number | undefined, driftAmp: undefined as number | undefined, driftEnabled: undefined as boolean | undefined }
  const origVS   = (figureStudent  ? vertexSettings[figureStudent]  : null) ?? DEF
  const mirrorVS = (figureStudent2 ? vertexSettings[figureStudent2] : null) ?? DEF

  return (
    <>
      <BackgroundSetter color={bgColor} image={bgImage} />
      {roomCameraMode === 'freeroam'
        ? <RoomControls camX={camX} camY={camY} camZ={camZ} disabled={graffitiMode} />
        : <>
            {roomCameraMode === 'orthographic'
              ? <OrthographicCamera makeDefault position={[camX, camY, camZ]} zoom={roomCamZoom} near={-10000} far={10000} />
              : <PerspectiveCamera makeDefault position={[camX, camY, camZ]} fov={roomCamFov} near={0.1} far={10000} />
            }
            <OrbitControls target={[0, 150, -(D / 2)]} enableDamping dampingFactor={0.08} autoRotate={roomCamXLoop} autoRotateSpeed={roomCamXLoopSpeed} enabled={!graffitiMode} />
          </>
      }
      {showDoggo && (
        <Suspense fallback={null}>
          <Doggo roomDepth={D} scale={doggoScale} x={doggoX} y={doggoY} z={doggoZ} />
        </Suspense>
      )}

      {showFigure && (
        <Suspense fallback={null}>
          <FigurePair roomDepth={D} radius={figureRadius} speed={figureSpeed} x={figureX} y={figureY} z={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} posts={figurePosts} mirrorPosts={mirrorPosts} showVertexImages={showVertexImages} origImgSize={origVS.imgSize} origRepeat={origVS.repeat} origAudioImgSize={origVS.audioImgSize} origAudioRepeat={origVS.audioRepeat} origFacing={origVS.facing} origDriftSpeed={origVS.driftSpeed} origDriftAmp={origVS.driftAmp} origDriftEnabled={origVS.driftEnabled} mirrorImgSize={mirrorVS.imgSize} mirrorRepeat={mirrorVS.repeat} mirrorAudioImgSize={mirrorVS.audioImgSize} mirrorAudioRepeat={mirrorVS.audioRepeat} mirrorFacing={mirrorVS.facing} mirrorDriftSpeed={mirrorVS.driftSpeed} mirrorDriftAmp={mirrorVS.driftAmp} mirrorDriftEnabled={mirrorVS.driftEnabled} orbiting={figureOrbiting} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} figureRingsOrig={figureRingsOrig} figureRingsMirror={figureRingsMirror} soloReact={soloReact} graffitiOrig={graffitiOrig} graffitiMirror={graffitiMirror} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} analyserRef={analyserRef} origStudent={figureStudent} mirrorStudent={figureStudent2} nutsaGlbs={nutsaGlbs} nutsaGlbScale={nutsaGlbScale} nutsaGlbRepeat={nutsaGlbRepeat} drift={drift} origShuffleSeed={origShuffleSeed} mirrorShuffleSeed={mirrorShuffleSeed} />
        </Suspense>
      )}

    </>
  )
}

// ── Entry point — pre-loads image dimensions before mounting scene ─────────────
export default function RoomCanvas({ posts, showDoggo = true, doggoScale = 1, doggoX = 0, doggoY = 0, doggoZ = 0, showFigure = true, figureRadius = 5, figureSpeed = 0.5, figureX = 0, figureY = 0, figureZ = 0, figureScale = 1, figureFacing = 0, figureWireframe = true, wireframeStyle = 'edges', dotSize = 0.200, dotColor = '#000000', dotCount = 30000, showVertexImages = false, vertexSettings = {} as Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal' }>, figureStudent = null, figureStudent2 = null, figureOrbiting = true, camX = 0, camY = EYE, camZ = 55, roomCameraMode = 'freeroam' as RoomCameraMode, roomCamFov = 72, roomCamZoom = 1, roomCamXLoop = false, roomCamXLoopSpeed = 1, meshTexture = null, texScale = 1, texOffsetX = 0, texOffsetY = 0, texRotation = 0, transitionKey = 0, figureRings = false, soloReact = false, graffitiMode = false, graffitiColor = '#ff2222', graffitiBrushSize = 8, graffitiClearKey = 0, bgColor = '#ffffff', bgImage = null, analyserRef, nutsaGlbs, nutsaGlbScale, nutsaGlbRepeat, drift = false, origShuffleSeed = 0, mirrorShuffleSeed = 0, captureRef, recordRef }: { posts: Post[]; showDoggo?: boolean; doggoScale?: number; doggoX?: number; doggoY?: number; doggoZ?: number; showFigure?: boolean; figureRadius?: number; figureSpeed?: number; figureX?: number; figureY?: number; figureZ?: number; figureScale?: number; figureFacing?: number; figureWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number; showVertexImages?: boolean; vertexSettings?: Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal' }>; figureStudent?: string | null; figureStudent2?: string | null; figureOrbiting?: boolean; camX?: number; camY?: number; camZ?: number; roomCameraMode?: RoomCameraMode; roomCamFov?: number; roomCamZoom?: number; roomCamXLoop?: boolean; roomCamXLoopSpeed?: number; meshTexture?: string | null; texScale?: number; texOffsetX?: number; texOffsetY?: number; texRotation?: number; transitionKey?: number; figureRings?: boolean; soloReact?: boolean; graffitiMode?: boolean; graffitiColor?: string; graffitiBrushSize?: number; graffitiClearKey?: number; bgColor?: string; bgImage?: string | null; analyserRef?: React.RefObject<AnalyserNode | null>; nutsaGlbs?: string[]; nutsaGlbScale?: number; nutsaGlbRepeat?: number; drift?: boolean; origShuffleSeed?: number; mirrorShuffleSeed?: number; captureRef?: React.MutableRefObject<(() => void) | null>; recordRef?: React.MutableRefObject<{ start: () => void; stop: () => void } | null> }) {
  return (
    <Canvas
      camera={{ position: [camX, camY, camZ], fov: 72 }}
      dpr={[1, MAX_DPR]}
      gl={{ preserveDrawingBuffer: true }}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: bgColor }}
    >
      <RoomScene posts={posts} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexSettings={vertexSettings} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} roomCameraMode={roomCameraMode} roomCamFov={roomCamFov} roomCamZoom={roomCamZoom} roomCamXLoop={roomCamXLoop} roomCamXLoopSpeed={roomCamXLoopSpeed} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} figureRings={figureRings} soloReact={soloReact} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} nutsaGlbs={nutsaGlbs} nutsaGlbScale={nutsaGlbScale} nutsaGlbRepeat={nutsaGlbRepeat} drift={drift} origShuffleSeed={origShuffleSeed} mirrorShuffleSeed={mirrorShuffleSeed} />
      {captureRef && <ScreenshotCapture captureRef={captureRef} />}
      {recordRef && <VideoRecorder recordRef={recordRef} />}
    </Canvas>
  )
}

// ── 16-bit PNG encoder ────────────────────────────────────────────────────────
// Renders to a FloatType WebGLRenderTarget, reads linear RGBA float pixels, applies
// linear→sRGB gamma in float space, and writes a 16-bit-per-channel RGB PNG using
// CompressionStream (no external deps). Caps at 8192px wide to stay within ~200MB
// GPU readback + raw-row budget — sufficient for A2/A1 at 300 DPI.
async function save16BitPNG(
  gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera
) {
  const canvas = gl.domElement
  const prevDpr = gl.getPixelRatio()
  const displayW = Math.round(canvas.width / prevDpr)
  const displayH = Math.round(canvas.height / prevDpr)
  // Cap at 24K; actual ceiling is gl.capabilities.maxTextureSize (usually 16384)
  const TARGET_W = Math.min(gl.capabilities.maxTextureSize, 24000)
  const TARGET_H = Math.round(TARGET_W * displayH / displayW)

  // Camera aspect adjustment
  const pCam = camera as THREE.PerspectiveCamera
  const oCam = camera as THREE.OrthographicCamera
  let prevAspect = 0, prevL = 0, prevR = 0, prevT = 0, prevB = 0
  if (pCam.isPerspectiveCamera) {
    prevAspect = pCam.aspect; pCam.aspect = TARGET_W / TARGET_H; pCam.updateProjectionMatrix()
  } else if (oCam.isOrthographicCamera) {
    prevL = oCam.left; prevR = oCam.right; prevT = oCam.top; prevB = oCam.bottom
    const halfH = (oCam.top - oCam.bottom) / 2
    oCam.left = -halfH * TARGET_W / TARGET_H; oCam.right = halfH * TARGET_W / TARGET_H
    oCam.updateProjectionMatrix()
  }

  // Render into a standard uint8 render target — proven reliable at 16K.
  // FloatType targets silently fail or get capped on some GPUs; since all source
  // textures are 8-bit JPEGs, float precision in the RT adds no real benefit.
  const savedRT = gl.getRenderTarget()
  const savedCS = gl.outputColorSpace
  gl.outputColorSpace = THREE.LinearSRGBColorSpace
  const rt = new THREE.WebGLRenderTarget(TARGET_W, TARGET_H)
  gl.setRenderTarget(rt); gl.render(scene, camera)
  gl.setRenderTarget(savedRT); gl.outputColorSpace = savedCS

  // GPU→CPU readback as uint8 linear values
  const raw8 = new Uint8Array(TARGET_W * TARGET_H * 4)
  gl.readRenderTargetPixels(rt, 0, 0, TARGET_W, TARGET_H, raw8)
  rt.dispose()

  // Restore camera
  if (pCam.isPerspectiveCamera) { pCam.aspect = prevAspect; pCam.updateProjectionMatrix() }
  else if (oCam.isOrthographicCamera) { oCam.left = prevL; oCam.right = prevR; oCam.top = prevT; oCam.bottom = prevB; oCam.updateProjectionMatrix() }

  // Build PNG raw rows: filter byte (0=None) + RGB uint16 big-endian per pixel
  // Y-flip (WebGL bottom-to-top → PNG top-to-bottom); uint8 linear → sRGB → uint16
  const rowBytes = 1 + TARGET_W * 6
  const raw = new Uint8Array(TARGET_H * rowBytes)
  for (let y = 0; y < TARGET_H; y++) {
    const srcY = TARGET_H - 1 - y
    const base = y * rowBytes
    raw[base] = 0
    for (let x = 0; x < TARGET_W; x++) {
      const s = (srcY * TARGET_W + x) * 4
      const d = base + 1 + x * 6
      for (let c = 0; c < 3; c++) {
        const lin = raw8[s + c] / 255
        const srgb = lin <= 0.0031308 ? lin * 12.92 : 1.055 * Math.pow(lin, 1 / 2.4) - 0.055
        const v = Math.round(srgb * 65535)
        raw[d + c * 2] = (v >> 8) & 0xff
        raw[d + c * 2 + 1] = v & 0xff
      }
    }
  }

  // Compress with zlib deflate (PNG IDAT format)
  const cs = new CompressionStream('deflate')
  const w = cs.writable.getWriter()
  w.write(raw); w.close()
  const parts: Uint8Array[] = []
  const r = cs.readable.getReader()
  while (true) { const { done, value } = await r.read(); if (done) break; parts.push(value) }
  const compressed = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let off = 0; for (const p of parts) { compressed.set(p, off); off += p.length }

  // CRC32 for PNG chunks
  const crcT = new Int32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); crcT[n] = c }
  const crc32 = (d: Uint8Array) => { let c = -1; for (let i = 0; i < d.length; i++) c = crcT[(c ^ d[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }
  const pngChunk = (type: string, data: Uint8Array) => {
    const t = new TextEncoder().encode(type)
    const out = new Uint8Array(12 + data.length); const dv = new DataView(out.buffer)
    dv.setUint32(0, data.length); out.set(t, 4); out.set(data, 8)
    dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
    return out
  }

  // IHDR: 16-bit RGB (bit depth 16, color type 2)
  const ihdr = new Uint8Array(13); const hv = new DataView(ihdr.buffer)
  hv.setUint32(0, TARGET_W); hv.setUint32(4, TARGET_H); ihdr[8] = 16; ihdr[9] = 2

  const blob = new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array(0)),
  ], { type: 'image/png' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `reply-${TARGET_W}x${TARGET_H}-16bit.png`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ScreenshotCapture({ captureRef }: { captureRef: React.MutableRefObject<(() => void) | null> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    captureRef.current = () => { save16BitPNG(gl, scene, camera) }
    return () => { captureRef.current = null }
  }, [gl, scene, camera, captureRef])
  return null
}

function VideoRecorder({ recordRef, prefix = 'room' }: { recordRef: React.MutableRefObject<{ start: () => void; stop: () => void } | null>; prefix?: string }) {
  const { gl } = useThree()
  useEffect(() => {
    let recorder: MediaRecorder | null = null
    let chunks: Blob[] = []
    recordRef.current = {
      start: () => {
        chunks = []
        const stream = gl.domElement.captureStream(60)
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 50_000_000 })
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `${prefix}-${Date.now()}.webm`; a.click()
          URL.revokeObjectURL(url)
        }
        recorder.start()
      },
      stop: () => { recorder?.stop(); recorder = null },
    }
    return () => { recorder?.stop(); recordRef.current = null }
  }, [gl, recordRef, prefix])
  return null
}

// ── Circle room: all students in a ring facing inward ─────────────────────────

function CircleNameTag({ student, nameSize, blurNames, onNameClick, namesClickable }: { student: string; nameSize: number; blurNames: boolean; onNameClick: (name: string) => void; namesClickable: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Html center position={[0, 2.2, 0]} style={{ pointerEvents: namesClickable ? 'auto' : 'none' }}>
      <div
        onClick={namesClickable ? () => onNameClick(student) : undefined}
        onMouseEnter={namesClickable ? () => setHovered(true) : undefined}
        onMouseLeave={namesClickable ? () => setHovered(false) : undefined}
        style={{
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: `${nameSize}px`,
          fontWeight: 500,
          letterSpacing: '0.08em',
          color: hovered ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.55)',
          whiteSpace: 'nowrap',
          textShadow: '0 0 12px rgba(255,255,255,0.9)',
          filter: blurNames ? 'blur(6px)' : undefined,
          transition: 'filter 0.3s, color 0.15s',
          cursor: namesClickable ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        {student}
      </div>
    </Html>
  )
}

function CircleFigure({ angle, radius, figureScale, figureY, figureFacing = 4.65, posts, showVertexImages, imagesVisible = true, vertexSettings, showWireframe, wireframeStyle, dotSize, dotColor, dotCount, meshTexture, texScale, texRepeat, texOffsetX, texOffsetY, texRotation, student, onTextureUpload, analyserRef, isAdmin = false, drift = false }: {
  angle: number; radius: number; figureScale: number; figureY: number; figureFacing?: number; drift?: boolean
  posts: Post[]; showVertexImages: boolean; imagesVisible?: boolean; vertexSettings: Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal'; driftSpeed?: number; driftAmp?: number; driftEnabled?: boolean }>
  showWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  meshTexture: string | null
  texScale: number; texRepeat: number; texOffsetX: number; texOffsetY: number; texRotation: number
  student: string; onTextureUpload: (student: string, url: string | null) => void
  analyserRef?: React.RefObject<AnalyserNode | null>
  isAdmin?: boolean
}) {
  const { scene: raw } = useGLTF('/figure.glb')
  const cloned = useMemo(() => {
    const c = raw.clone(true)
    c.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = Array.isArray(m.material) ? m.material.map(mt => mt.clone()) : (m.material as THREE.Material).clone()
    })
    return c
  }, [raw])

  const loadedTexRef = useRef<THREE.Texture | null>(null)

  useEffect(() => {
    cloned.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material as THREE.Material]
      mats.forEach(mt => { mt.visible = meshTexture ? true : !showWireframe })
    })
  }, [cloned, showWireframe, meshTexture])

  useEffect(() => {
    const getMeshes = (root: THREE.Object3D) => {
      const out: THREE.Mesh[] = []
      root.traverse(o => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh) })
      return out
    }
    const generateUVs = (geo: THREE.BufferGeometry) => {
      geo.computeBoundingBox()
      const bbox = geo.boundingBox!
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const pos = geo.attributes.position
      const uvs = new Float32Array(pos.count * 2)
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2]     = size.x > 0 ? (pos.getX(i) - bbox.min.x) / size.x : 0
        uvs[i * 2 + 1] = size.y > 0 ? (pos.getY(i) - bbox.min.y) / size.y : 0
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    }

    if (!meshTexture) {
      getMeshes(cloned).forEach(m => {
        if ((m.material as THREE.Material).type === 'MeshBasicMaterial') {
          ;(m.material as THREE.MeshBasicMaterial).map?.dispose()
          ;(m.material as THREE.Material).dispose()
          const src = getMeshes(raw).find(s => s.name === m.name)
          if (src) m.material = (src.material as THREE.Material).clone()
        }
      })
      loadedTexRef.current = null
      return
    }

    let cancelled = false
    new THREE.TextureLoader().load(meshTexture, tex => {
      if (cancelled) { tex.dispose(); return }
      tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      loadedTexRef.current = tex
      getMeshes(cloned).forEach(m => {
        generateUVs(m.geometry)
        if ((m.material as THREE.Material).type === 'MeshBasicMaterial') {
          ;(m.material as THREE.Material).dispose()
        }
        m.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.01 })
      })
    })
    return () => { cancelled = true }
  }, [meshTexture, cloned, raw])

  useEffect(() => {
    const tex = loadedTexRef.current
    if (!tex) return
    tex.repeat.set(texScale * texRepeat, texScale * texRepeat)
    tex.offset.set(texOffsetX, texOffsetY)
    tex.rotation = texRotation * (Math.PI / 180)
    tex.center.set(0.5, 0.5)
    tex.needsUpdate = true
  }, [texScale, texRepeat, texOffsetX, texOffsetY, texRotation])

  const rotY = figureFacing + angle + Math.PI
  const vs = vertexSettings[student] ?? { imgSize: 0.025, repeat: 1 }
  const isSergiFigure = student.trim().toLowerCase().includes('sergi')
  const isSesili = student === 'Sesili Gurgenidze'
  // Start as loaded if showVertexImages is already true at mount (returning from another view)
  // so dots never flash on remount. Only reset when student changes.
  const [imagesLoaded, setImagesLoaded] = useState(() => showVertexImages)
  useEffect(() => { setImagesLoaded(false) }, [student])

  const figureCenter = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    const c = new THREE.Vector3()
    box.getCenter(c)
    return c
  }, [cloned])

  return (
    <group position={[radius * Math.sin(angle), figureY, radius * Math.cos(angle)]} scale={figureScale} rotation={[0, rotY, 0]} frustumCulled={false}>
      <group position={[-figureCenter.x, -figureCenter.y, -figureCenter.z]}>
        <primitive object={cloned} frustumCulled={false} />
        {showWireframe && !isSergiFigure && !(showVertexImages && imagesLoaded) && (
          <FigureWireframe scene={cloned} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={0} />
        )}
        {isSergiFigure && <FigureRings scene={cloned} analyserRef={analyserRef} />}
        {showVertexImages && posts.length > 0 && (
          <group visible={imagesVisible}>
            <Suspense fallback={null}>
              <FigureVertexImages scene={cloned} posts={posts} size={vs.imgSize} repeat={vs.repeat} audioImgSize={vs.audioImgSize} audioRepeat={vs.audioRepeat} facing={vs.facing} analyserRef={analyserRef} showConnections={isSesili} drift={drift && vs.driftEnabled !== false} driftSpeed={vs.driftSpeed} driftAmp={vs.driftAmp} onLoaded={() => setImagesLoaded(true)} />
            </Suspense>
          </group>
        )}
        {isAdmin && (
          <Html center position={[0, 2.5, 0]} style={{ pointerEvents: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', userSelect: 'none' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: 'rgba(0,0,0,0.45)', whiteSpace: 'nowrap' }}>{student}</span>
              <label style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.13)', borderRadius: '4px', padding: '3px 9px', fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
                {meshTexture ? 'change texture' : '+ texture'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const url = URL.createObjectURL(file)
                  onTextureUpload(student, url)
                  e.target.value = ''
                }} />
              </label>
              {meshTexture && (
                <button onClick={() => onTextureUpload(student, null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '10px', fontFamily: 'ui-monospace, monospace', color: 'rgba(0,0,0,0.35)', padding: '1px 0' }}>
                  remove
                </button>
              )}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

type CircleCameraMode = 'perspective' | 'orthographic' | 'panoramic'

type TextureMapping = { scale: number; repeat: number; offsetX: number; offsetY: number; rotation: number }
const DEFAULT_MAPPING: TextureMapping = { scale: 1, repeat: 1, offsetX: 0, offsetY: 0, rotation: 0 }

function CameraMonitor({ infoRef }: { infoRef: React.RefObject<HTMLDivElement | null> }) {
  const { camera } = useThree()
  useFrame(() => {
    const el = infoRef.current
    if (!el) return
    const p = camera.position
    const tx = 0, ty = 150, tz = 0
    const dx = p.x - tx, dy = p.y - ty, dz = p.z - tz
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const azimuth = Math.atan2(dx, dz) * 180 / Math.PI
    const polar = Math.acos(Math.max(-1, Math.min(1, dy / dist))) * 180 / Math.PI
    el.innerHTML =
      `<div>X: ${Math.round(p.x)}</div>` +
      `<div>Y: ${Math.round(p.y)}</div>` +
      `<div>Z: ${Math.round(p.z)}</div>` +
      `<div style="margin-top:4px">dist: ${Math.round(dist)}</div>` +
      `<div>azimuth: ${Math.round(azimuth)}°</div>` +
      `<div>polar: ${Math.round(polar)}°</div>`
  })
  return null
}

function CircleCamSaver() {
  const { camera } = useThree()
  useFrame(() => {
    saveCircleCam({
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom : 1,
    })
  })
  return null
}

function CircleCamDriver({ x, y, z, zoom, mode, initCam }: { x: number; y: number; z: number; zoom: number; mode: CircleCameraMode; initCam?: { x: number; y: number; z: number; zoom: number } }) {
  const { camera } = useThree()
  const ready = useRef(false)
  const locked = useRef(!!initCam) // when restoring saved state, hand control to OrbitControls immediately
  const prevTarget = useRef({ x, y, z, zoom })
  const settledFrames = useRef(0)
  useFrame(() => {
    if (!ready.current) {
      const init = initCam ?? { x, y, z, zoom }
      camera.position.set(init.x, init.y, init.z)
      if (camera instanceof THREE.OrthographicCamera) { camera.zoom = init.zoom; camera.updateProjectionMatrix() }
      ready.current = true
      return
    }
    if (locked.current) return // camera is under OrbitControls, don't interfere
    const p = prevTarget.current
    if (p.x !== x || p.y !== y || p.z !== z || p.zoom !== zoom) {
      prevTarget.current = { x, y, z, zoom }
      settledFrames.current = 0
    } else {
      settledFrames.current++
    }
    if (settledFrames.current >= 80) return
    const a = 0.06
    camera.position.x += (x - camera.position.x) * a
    camera.position.y += (y - camera.position.y) * a
    camera.position.z += (z - camera.position.z) * a
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom += (zoom - camera.zoom) * a
      camera.updateProjectionMatrix()
    }
  })
  return null
}

function CircleScene({ posts, students, circleRadius, figureScale, figureY, figureFacing = 4.65, showVertexImages, vertexSettings, showWireframe, wireframeStyle, dotSize, dotColor, dotCount, studentTextures, studentTextureMappings, onTextureUpload, showNoiseGlobe, noiseColor1, noiseColor2, noiseSpeed, noiseScale, audioVolume, cameraMode, camX, camY, camZ, camFov, camZoom, camXLoop, camXLoopSpeed, bgColor, bgImage, analyserRef, cameraInfoRef, soloReact = false, isAdmin = false, drift = false, lockPolar = false, initCam }: {
  posts: Post[]; students: string[]; circleRadius: number; figureScale: number; figureY: number; figureFacing?: number; drift?: boolean
  showVertexImages: boolean; vertexSettings: Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal' }>
  showWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  studentTextures: Record<string, string | null>
  studentTextureMappings: Record<string, TextureMapping>
  onTextureUpload: (student: string, url: string | null) => void
  showNoiseGlobe: boolean; noiseColor1: string; noiseColor2: string; noiseSpeed: number; noiseScale: number; audioVolume: number
  cameraMode: CircleCameraMode; camX: number; camY: number; camZ: number; camFov: number; camZoom: number
  camXLoop: boolean; camXLoopSpeed: number
  bgColor: string; bgImage: string | null
  analyserRef?: React.RefObject<AnalyserNode | null>
  cameraInfoRef?: React.RefObject<HTMLDivElement | null>
  soloReact?: boolean
  isAdmin?: boolean
  lockPolar?: boolean
  initCam?: { x: number; y: number; z: number; zoom: number }
}) {
  const [activeStudents, setActiveStudents] = useState<Set<number>>(new Set([0]))
  const soloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (soloTimerRef.current) clearTimeout(soloTimerRef.current)
    if (!soloReact || !students.length) return
    const schedule = () => {
      const delay = (1 + Math.random() * 2) * 1000
      soloTimerRef.current = setTimeout(() => {
        const count = Math.floor(Math.random() * 3) + 1
        const next = new Set<number>()
        while (next.size < Math.min(count, students.length)) {
          next.add(Math.floor(Math.random() * students.length))
        }
        setActiveStudents(next)
        schedule()
      }, delay)
    }
    schedule()
    return () => { if (soloTimerRef.current) clearTimeout(soloTimerRef.current) }
  }, [soloReact, students.length])

  return (
    <>
      <BackgroundSetter color={bgColor} image={bgImage} />
      {cameraMode === 'orthographic'
        ? <OrthographicCamera makeDefault near={-10000} far={10000} />
        : <PerspectiveCamera makeDefault fov={camFov} near={0.1} far={10000} />
      }
      <CircleCamDriver key={cameraMode} x={camX} y={camY} z={camZ} zoom={camZoom} mode={cameraMode} initCam={initCam} />
      <CircleCamSaver />
      <OrbitControls target={[0, 150, 0]} enableDamping dampingFactor={0.08} autoRotate={camXLoop} autoRotateSpeed={camXLoopSpeed} enablePan={false} minZoom={0.5} maxZoom={4} minDistance={500} maxDistance={3500} />
      {showNoiseGlobe && analyserRef && (
        <group scale={circleRadius * 0.6}>
          <NoiseGlobe audioVolume={audioVolume} analyserRef={analyserRef} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} />
        </group>
      )}
      {students.map((student, i) => {
        const angle = (i / students.length) * Math.PI * 2
        const studentPosts = posts.filter(p => p.student_name?.trim().toLowerCase() === student.trim().toLowerCase()).slice(0, POSTS_PER_FIGURE)
        return (
          <CircleFigure
            key={student}
            angle={angle}
            radius={circleRadius}
            figureScale={figureScale}
            figureY={figureY}
            figureFacing={figureFacing}
            posts={studentPosts}
            showVertexImages={showVertexImages}
            imagesVisible={!soloReact || activeStudents.has(i)}
            vertexSettings={vertexSettings}
            showWireframe={showWireframe}
            wireframeStyle={wireframeStyle}
            dotSize={dotSize}
            dotColor={dotColor}
            dotCount={dotCount}
            meshTexture={studentTextures[student] ?? null}
            texScale={(studentTextureMappings[student] ?? DEFAULT_MAPPING).scale}
            texRepeat={(studentTextureMappings[student] ?? DEFAULT_MAPPING).repeat}
            texOffsetX={(studentTextureMappings[student] ?? DEFAULT_MAPPING).offsetX}
            texOffsetY={(studentTextureMappings[student] ?? DEFAULT_MAPPING).offsetY}
            texRotation={(studentTextureMappings[student] ?? DEFAULT_MAPPING).rotation}
            student={student}
            onTextureUpload={onTextureUpload}
            analyserRef={!soloReact || activeStudents.has(i) ? analyserRef : undefined}
            isAdmin={isAdmin}
            drift={drift}
          />
        )
      })}
      {cameraInfoRef && <CameraMonitor infoRef={cameraInfoRef} />}
    </>
  )
}

export type { CircleCameraMode, TextureMapping }

export function CircleCanvas({ posts, students, circleRadius = 300, figureScale = 200, figureY = -10, figureFacing = 4.65, showVertexImages = true, vertexSettings = {} as Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal' }>, showWireframe = true, wireframeStyle = 'points' as WireframeStyle, dotSize = 0.800, dotColor = '#000000', dotCount = 30000, studentTextures = {}, studentTextureMappings = {}, onTextureUpload = () => {}, showNoiseGlobe = false, noiseColor1 = '#08003a', noiseColor2 = '#8c1aff', noiseSpeed = 0.5, noiseScale = 1.0, audioVolume = 0, cameraMode = 'orthographic' as CircleCameraMode, camX = 150, camY = 930, camZ = -1350, camFov = 60, camZoom = 1.8, camXLoop = false, camXLoopSpeed = 1.0, bgColor = '#ffffff', bgImage = null, analyserRef, cameraInfoRef, soloReact = false, isAdmin = false, frameloop = 'always', drift = false, lockPolar = false, initCam, recordRef }: {
  posts: Post[]; students: string[]
  circleRadius?: number; figureScale?: number; figureY?: number; figureFacing?: number; drift?: boolean
  showVertexImages?: boolean; vertexSettings?: Record<string, { imgSize: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal' }>
  showWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number
  studentTextures?: Record<string, string | null>
  studentTextureMappings?: Record<string, TextureMapping>
  onTextureUpload?: (student: string, url: string | null) => void
  showNoiseGlobe?: boolean; noiseColor1?: string; noiseColor2?: string; noiseSpeed?: number; noiseScale?: number; audioVolume?: number
  cameraMode?: CircleCameraMode; camX?: number; camY?: number; camZ?: number; camFov?: number; camZoom?: number
  camXLoop?: boolean; camXLoopSpeed?: number
  bgColor?: string; bgImage?: string | null
  analyserRef?: React.RefObject<AnalyserNode | null>
  cameraInfoRef?: React.RefObject<HTMLDivElement | null>
  soloReact?: boolean
  isAdmin?: boolean
  frameloop?: 'always' | 'demand' | 'never'
  lockPolar?: boolean
  initCam?: { x: number; y: number; z: number; zoom: number }
  recordRef?: React.MutableRefObject<{ start: () => void; stop: () => void } | null>
}) {
  return (
    <Canvas
      dpr={[1, MAX_DPR]}
      frameloop={frameloop}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: bgColor }}
    >
      <CircleScene
        posts={posts} students={students} circleRadius={circleRadius} figureScale={figureScale} figureY={figureY} figureFacing={figureFacing} drift={drift}
        showVertexImages={showVertexImages} vertexSettings={vertexSettings}
        showWireframe={showWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount}
        studentTextures={studentTextures}
        studentTextureMappings={studentTextureMappings}
        onTextureUpload={onTextureUpload}
        showNoiseGlobe={showNoiseGlobe} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} audioVolume={audioVolume}
        cameraMode={cameraMode} camX={camX} camY={camY} camZ={camZ} camFov={camFov} camZoom={camZoom}
        camXLoop={camXLoop} camXLoopSpeed={camXLoopSpeed}
        bgColor={bgColor} bgImage={bgImage}
        analyserRef={analyserRef}
        cameraInfoRef={cameraInfoRef}
        soloReact={soloReact}
        isAdmin={isAdmin}
        lockPolar={lockPolar}
        initCam={initCam}
      />
      {recordRef && <VideoRecorder recordRef={recordRef} prefix="circle" />}
    </Canvas>
  )
}

useGLTF.preload('/figure.glb')
