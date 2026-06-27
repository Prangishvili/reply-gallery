'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { Post } from '@/lib/supabase'

// ── Device constants ──────────────────────────────────────────────────────────
export const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 1000 || /iPhone|iPad|Android/i.test(navigator.userAgent))
export const TEX_MAX_DIM = IS_MOBILE ? 256 : 512
export const POSTS_PER_FIGURE = IS_MOBILE ? 40 : 200

// ── Types ─────────────────────────────────────────────────────────────────────
export type WireframeStyle = 'edges' | 'dense' | 'dashed' | 'points'

// ── Geometry helpers ──────────────────────────────────────────────────────────
export function sampleVerticesWithNormals(root: THREE.Object3D, count: number): { pos: THREE.Vector3; normal: THREE.Vector3 }[] {
  if (count === 0) return []
  root.updateMatrixWorld(true)
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert()

  type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; na: THREE.Vector3; nb: THREE.Vector3; nc: THREE.Vector3; area: number }
  const tris: Tri[] = []
  let totalArea = 0

  root.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry
    const posAttr = geo.getAttribute('position')
    const norAttr = geo.getAttribute('normal')
    if (!posAttr) return
    const transform = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld)
    const normalMat = new THREE.Matrix3().getNormalMatrix(transform)
    const getP = (i: number) => new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(transform)
    const getN = (i: number) => norAttr
      ? new THREE.Vector3(norAttr.getX(i), norAttr.getY(i), norAttr.getZ(i)).applyMatrix3(normalMat).normalize()
      : new THREE.Vector3(0, 1, 0)
    const idx = geo.index
    const triCount = idx ? idx.count / 3 : posAttr.count / 3
    for (let t = 0; t < triCount; t++) {
      const ia = idx ? idx.getX(t * 3) : t * 3
      const ib = idx ? idx.getX(t * 3 + 1) : t * 3 + 1
      const ic = idx ? idx.getX(t * 3 + 2) : t * 3 + 2
      const a = getP(ia), b = getP(ib), c = getP(ic)
      const area = new THREE.Triangle(a, b, c).getArea()
      totalArea += area
      tris.push({ a, b, c, na: getN(ia), nb: getN(ib), nc: getN(ic), area })
    }
  })

  if (tris.length === 0 || totalArea === 0) return []

  const cum = new Float64Array(tris.length)
  let acc = 0
  for (let i = 0; i < tris.length; i++) { acc += tris[i].area; cum[i] = acc }

  const result: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = []
  for (let s = 0; s < count; s++) {
    const target = (s + 0.5) / count * totalArea
    let lo = 0, hi = tris.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < target) lo = mid + 1; else hi = mid }
    const tri = tris[lo]
    const u = (s * 0.7548776662) % 1
    const v = (s * 0.5698402910) % 1
    const su = Math.sqrt(u)
    const r1 = 1 - su, r2 = v * su, r3 = 1 - r1 - r2
    const pos    = new THREE.Vector3().addScaledVector(tri.a, r1).addScaledVector(tri.b, r2).addScaledVector(tri.c, r3)
    const normal = new THREE.Vector3().addScaledVector(tri.na, r1).addScaledVector(tri.nb, r2).addScaledVector(tri.nc, r3).normalize()
    result.push({ pos, normal })
  }
  return result
}

// ── SVG helper ────────────────────────────────────────────────────────────────
function parseSvgRadiusFraction(svgText: string): number {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
    const vb = doc.querySelector('svg')?.getAttribute('viewBox')?.trim().split(/\s+/).map(Number)
    if (!vb || vb.length < 4 || vb[2] <= 0) return 1
    const halfW = vb[2] / 2
    let maxR = 0
    doc.querySelectorAll('circle').forEach(c => {
      const r = parseFloat(c.getAttribute('r') ?? '0')
      if (r > maxR) maxR = r
    })
    return maxR > 0 ? maxR / halfW : 1
  } catch { return 1 }
}

// ── Texture loading ───────────────────────────────────────────────────────────
function loadCappedTexMeta(url: string, maxDim = TEX_MAX_DIM): Promise<{ tex: THREE.Texture; aspect: number }> {
  return new Promise(resolve => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
    img.decode().then(() => {
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      resolve({ tex, aspect: w / h })
    }).catch(() => resolve({ tex: new THREE.Texture(), aspect: 1 }))
  })
}

const MAX_CONCURRENT_IMG_LOADS = IS_MOBILE ? 6 : 16
let activeImgLoads = 0
const pendingImgLoads: (() => void)[] = []
function queueImageLoad(task: () => Promise<void>) {
  const run = () => {
    activeImgLoads++
    task().catch(() => {}).finally(() => {
      activeImgLoads--
      pendingImgLoads.shift()?.()
    })
  }
  if (activeImgLoads < MAX_CONCURRENT_IMG_LOADS) run()
  else pendingImgLoads.push(run)
}

function makeSvgTex(url: string, aspect: number, flip: boolean): Promise<THREE.CanvasTexture> {
  return new Promise(resolve => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tW = IS_MOBILE ? 512 : 1024, tH = Math.round(tW / aspect)
      const canvas = document.createElement('canvas')
      canvas.width = tW; canvas.height = tH
      canvas.getContext('2d')!.drawImage(img, 0, 0, tW, tH)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      if (flip) { tex.repeat.x = -1; tex.offset.x = 1 }
      resolve(tex)
    }
    img.onerror = () => resolve(new THREE.CanvasTexture(document.createElement('canvas')))
    img.src = url
  })
}

type CachedTex = {
  tex: THREE.Texture
  aspect: number
  svgRadiusFraction?: number
  gif?: { img: HTMLImageElement; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }
  video?: HTMLVideoElement
}
const texCache = new Map<string, Promise<CachedTex>>()

function loadImgAspect(url: string): Promise<number> {
  return new Promise(resolve => {
    const img = new window.Image()
    img.onload  = () => resolve((img.naturalWidth || 1) / (img.naturalHeight || 1))
    img.onerror = () => resolve(1)
    img.src = url
  })
}

export function getCachedTex(url: string): Promise<CachedTex> {
  let p = texCache.get(url)
  if (p) return p
  p = new Promise<CachedTex>(resolve => {
    queueImageLoad(async () => {
      let ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
      let blobType = ''
      if (url.startsWith('blob:')) {
        try {
          blobType = (await (await fetch(url)).blob()).type
          ext = blobType.includes('svg') ? 'svg' : blobType.includes('gif') ? 'gif' : blobType.startsWith('video/') ? 'video' : 'bitmap'
        } catch { ext = 'bitmap' }
      }
      const isVideo = ext === 'video' || /\.(mp4|mov|webm|m4v|avi)$/i.test(url.split('?')[0])
      if (isVideo) {
        const video = document.createElement('video')
        video.src = url
        video.muted = true
        video.loop = true
        video.playsInline = true
        video.autoplay = true
        if (!url.startsWith('blob:')) video.crossOrigin = 'anonymous'
        await new Promise<void>(r => {
          if (video.readyState >= 1) { r(); return }
          video.addEventListener('loadedmetadata', () => r(), { once: true })
          setTimeout(r, 5000)
        })
        const aspect = (video.videoWidth || 1) / (video.videoHeight || 1)
        video.play().catch(() => {})
        const tex = new THREE.VideoTexture(video)
        tex.colorSpace = THREE.SRGBColorSpace
        resolve({ tex, aspect, video })
      } else if (ext === 'svg') {
        const [aspect, svgText] = await Promise.all([
          loadImgAspect(url),
          fetch(url).then(r => r.text()).catch(() => ''),
        ])
        const svgRadiusFraction = parseSvgRadiusFraction(svgText)
        const tex = await makeSvgTex(url, aspect, false)
        resolve({ tex, aspect, svgRadiusFraction })
      } else if (ext === 'gif') {
        const img = new window.Image()
        img.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px;top:-9999px;left:-9999px'
        document.body.appendChild(img)
        img.src = url
        await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r() })
        const aspect = (img.naturalWidth || 1) / (img.naturalHeight || 1)
        const tW = 512, tH = Math.max(1, Math.round(tW / aspect))
        const canvas = document.createElement('canvas')
        canvas.width = tW; canvas.height = tH
        const canvasTex = new THREE.CanvasTexture(canvas)
        canvasTex.colorSpace = THREE.SRGBColorSpace
        resolve({ tex: canvasTex, aspect, gif: { img, canvas, tex: canvasTex } })
      } else {
        const { tex, aspect } = await loadCappedTexMeta(url)
        resolve({ tex, aspect })
      }
    })
  })
  texCache.set(url, p)
  return p
}

export function prefetchPostImages(posts: Post[]) {
  const perStudent = new Map<string, Post[]>()
  for (const p of posts) {
    const key = p.student_name?.trim().toLowerCase() ?? ''
    const list = perStudent.get(key) ?? []
    if (list.length >= POSTS_PER_FIGURE) continue
    list.push(p)
    perStudent.set(key, list)
  }
  const groups = [...perStudent.values()].sort((a, b) => a.length - b.length)
  for (const group of groups) for (const p of group) getCachedTex(p.image_url)
}

// ── FigureVertexImages ────────────────────────────────────────────────────────
export function FigureVertexImages({ scene, posts, size, repeat, audioImgSize, audioRepeat, facing = 'normal', analyserRef, showConnections = false, drift = false, driftSpeed = 1, driftAmp = 0.5, onLoaded, shuffleSeed = 0, sizeRandomize = false, audioSizeRandomize = false }: { scene: THREE.Object3D; posts: Post[]; size: number; repeat: number; audioImgSize?: number; audioRepeat?: number; facing?: 'camera' | 'normal'; analyserRef?: React.RefObject<AnalyserNode | null>; showConnections?: boolean; drift?: boolean; driftSpeed?: number; driftAmp?: number; onLoaded?: () => void; shuffleSeed?: number; sizeRandomize?: boolean; audioSizeRandomize?: boolean }) {
  const [isAudioActive, setIsAudioActive] = useState(false)
  const isAudioActiveRef = useRef(false)
  const effectiveRepeat = isAudioActive && audioRepeat != null ? audioRepeat : repeat

  const repeatedPosts = useMemo(() => {
    const arr: Post[] = []
    if (shuffleSeed > 0 && posts.length > 0) {
      const total = Math.max(1, effectiveRepeat) * posts.length
      for (let i = 0; i < total; i++) arr.push(posts[Math.floor(Math.random() * posts.length)])
    } else {
      for (let i = 0; i < Math.max(1, effectiveRepeat); i++) arr.push(...posts)
    }
    return arr
  }, [posts, effectiveRepeat, shuffleSeed])
  const vertices = useMemo(
    () => repeatedPosts.length > 0 ? sampleVerticesWithNormals(scene, repeatedPosts.length) : [],
    [scene, repeatedPosts.length]
  )

  const sizeScales = useMemo(() => {
    if ((!sizeRandomize && !audioSizeRandomize) || vertices.length === 0) return null
    const seed = shuffleSeed === 0 ? 1 : shuffleSeed
    let a = seed >>> 0
    const rand = () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    return Array.from({ length: vertices.length }, () => 0.25 + rand() * 1.75)
  }, [sizeRandomize, audioSizeRandomize, shuffleSeed, vertices.length])

  const meshMap        = useRef<Map<number, THREE.Mesh>>(new Map())
  const dataArrRef     = useRef<Uint8Array | null>(null)
  const gifAnimRef     = useRef<Map<string, { img: HTMLImageElement; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }>>(new Map())
  const driftRef       = useRef<{ dx: number; dy: number; dz: number; phase: number; speed: number }[]>([])
  const clockRef       = useRef(0)
  const connectionsRef  = useRef<[number, number][]>([])
  const lineGeoRef      = useRef(new LineSegmentsGeometry())
  const lineMatRef      = useRef(new LineMaterial({ color: '#444444', linewidth: 0.5, transparent: true, opacity: 0.85, vertexColors: false }))
  const lineSegs2Ref    = useRef((() => { const l = new LineSegments2(lineGeoRef.current, lineMatRef.current); l.frustumCulled = false; return l })())
  const posArrRef       = useRef<Float32Array | null>(null)
  const lineGroupRef    = useRef<THREE.Group | null>(null)
  const _cvd  = useRef(new THREE.Vector3())
  const _cdl  = useRef(new THREE.Vector3())
  const _imat = useRef(new THREE.Matrix4())
  const _cdir = useRef(new THREE.Vector3())
  const _cper = useRef(new THREE.Vector3())
  const _tA   = useRef(new THREE.Vector3())
  const _tB   = useRef(new THREE.Vector3())
  const { camera } = useThree()

  const [loadedTex, setLoadedTex] = useState<Map<string, { tex: THREE.Texture; aspect: number; svgRadiusFraction?: number }>>(new Map())
  const [spriteData, setSpriteData] = useState<{ tex: THREE.Texture; aspect: number }[]>([])

  useFrame((state, delta) => {
    lineMatRef.current.resolution.set(state.size.width, state.size.height)
    gifAnimRef.current.forEach(({ img, canvas, tex }) => {
      if (img.complete && img.naturalWidth > 0) {
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        tex.needsUpdate = true
      }
    })
    if (meshMap.current.size === 0 || spriteData.length === 0) return
    let vol = 0
    if (analyserRef?.current) {
      const a = analyserRef.current
      if (!dataArrRef.current || dataArrRef.current.length !== a.frequencyBinCount)
        dataArrRef.current = new Uint8Array(a.frequencyBinCount)
      a.getByteFrequencyData(dataArrRef.current as Uint8Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < dataArrRef.current.length; i++) sum += dataArrRef.current[i]
      vol = Math.min((sum / dataArrRef.current.length / 255) * 2, 1)
    }
    const playing = vol > 0.01
    if (playing !== isAudioActiveRef.current) {
      isAudioActiveRef.current = playing
      setIsAudioActive(playing)
    }
    const activeSize = (playing && audioImgSize != null) ? audioImgSize : size
    const applyRandScale = sizeRandomize || (audioSizeRandomize && playing)
    meshMap.current.forEach((mesh, i) => {
      const aspect = spriteData[i % spriteData.length]?.aspect ?? 1
      const randScale = (applyRandScale && sizeScales) ? (sizeScales[i] ?? 1) : 1
      const s = activeSize * (1 + vol * 3) * randScale
      mesh.scale.set(s * aspect, s, 1)
    })
    if ((showConnections || drift) && driftRef.current.length > 0) {
      clockRef.current += delta
      const amp = activeSize * driftAmp
      meshMap.current.forEach((mesh, i) => {
        const d = driftRef.current[i]
        const v = vertices[i]
        if (!d || !v) return
        const t = Math.sin(clockRef.current * d.speed * Math.PI * 2 + d.phase) * amp
        mesh.position.set(
          v.pos.x + v.normal.x * 0.02 + d.dx * t,
          v.pos.y + v.normal.y * 0.02 + d.dy * t,
          v.pos.z + v.normal.z * 0.02 + d.dz * t,
        )
      })
    }
    if (showConnections && connectionsRef.current.length > 0 && lineGroupRef.current) {
      const posArr = posArrRef.current
      const instanceStart = lineGeoRef.current.getAttribute('instanceStart') as THREE.InterleavedBufferAttribute | null
      if (posArr && instanceStart) {
        camera.getWorldDirection(_cvd.current)
        _imat.current.copy(lineGroupRef.current.matrixWorld).invert()
        _cdl.current.copy(_cvd.current).transformDirection(_imat.current).normalize()
        let vi = 0
        for (const [a, b] of connectionsRef.current) {
          const ma = meshMap.current.get(a)
          const mb = meshMap.current.get(b)
          if (!ma || !mb) { vi += 4; continue }
          _cdir.current.subVectors(mb.position, ma.position)
          _cdir.current.addScaledVector(_cdl.current, -_cdir.current.dot(_cdl.current))
          const dist = _cdir.current.length()
          if (dist < 0.0001) {
            // Pair is camera-depth-aligned; use world-up projected to screen plane as fallback
            _cdir.current.set(0, 1, 0).transformDirection(_imat.current)
            _cdir.current.addScaledVector(_cdl.current, -_cdir.current.dot(_cdl.current))
            const fd = _cdir.current.length()
            if (fd < 0.0001) { vi += 4; continue }
            _cdir.current.divideScalar(fd)
          } else {
            _cdir.current.divideScalar(dist)
          }
          _cper.current.crossVectors(_cdl.current, _cdir.current).normalize()
          const urlA = posts[a % posts.length]?.image_url ?? ''
          const urlB = posts[b % posts.length]?.image_url ?? ''
          const rA = ma.scale.x * 0.5 * (loadedTex.get(urlA)?.svgRadiusFraction ?? 1)
          const rB = mb.scale.x * 0.5 * (loadedTex.get(urlB)?.svgRadiusFraction ?? 1)
          const cosφ = Math.max(-0.9999, Math.min(0.9999, (rA - rB) / dist))
          const sinφ = Math.sqrt(1 - cosφ * cosφ)
          _tA.current.copy(ma.position).addScaledVector(_cdir.current, rA * cosφ).addScaledVector(_cper.current,  rA * sinφ)
          _tB.current.copy(mb.position).addScaledVector(_cdir.current, rB * cosφ).addScaledVector(_cper.current,  rB * sinφ)
          posArr[vi*3]   = _tA.current.x; posArr[vi*3+1]   = _tA.current.y; posArr[vi*3+2]   = _tA.current.z
          posArr[vi*3+3] = _tB.current.x; posArr[vi*3+4]   = _tB.current.y; posArr[vi*3+5]   = _tB.current.z
          _tA.current.copy(ma.position).addScaledVector(_cdir.current, rA * cosφ).addScaledVector(_cper.current, -rA * sinφ)
          _tB.current.copy(mb.position).addScaledVector(_cdir.current, rB * cosφ).addScaledVector(_cper.current, -rB * sinφ)
          posArr[vi*3+6] = _tA.current.x; posArr[vi*3+7]   = _tA.current.y; posArr[vi*3+8]   = _tA.current.z
          posArr[vi*3+9] = _tB.current.x; posArr[vi*3+10]  = _tB.current.y; posArr[vi*3+11]  = _tB.current.z
          vi += 4
        }
        instanceStart.data.needsUpdate = true
      }
    }
  })

  const urlsKey = useMemo(
    () => posts.map(p => p.image_url).sort().join('\n'),
    [posts]
  )
  useEffect(() => {
    if (posts.length === 0) return
    const uniqueUrls = new Set(posts.map(p => p.image_url))
    let cancelled = false
    setLoadedTex(prev => {
      let changed = false
      const keep = new Map(prev)
      prev.forEach((_, k) => {
        if (!uniqueUrls.has(k)) { keep.delete(k); changed = true }
      })
      return changed ? keep : prev
    })
    gifAnimRef.current.forEach((_, k) => {
      if (!uniqueUrls.has(k)) gifAnimRef.current.delete(k)
    })
    uniqueUrls.forEach(url => {
      getCachedTex(url).then(r => {
        if (cancelled) return
        if (r.gif) gifAnimRef.current.set(url, r.gif)
        setLoadedTex(prev => {
          if (prev.get(url)?.tex === r.tex) return prev
          const next = new Map(prev)
          next.set(url, { tex: r.tex, aspect: r.aspect, svgRadiusFraction: r.svgRadiusFraction })
          return next
        })
      })
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  useEffect(() => {
    const uniqueCount = new Set(posts.map(p => p.image_url)).size
    if (loadedTex.size < uniqueCount || loadedTex.size === 0 || vertices.length === 0 || repeatedPosts.length === 0) {
      setSpriteData([])
      return
    }
    setSpriteData(vertices.map((_, i) => {
      const url = repeatedPosts[i % repeatedPosts.length].image_url
      return loadedTex.get(url) ?? null
    }).filter((d): d is { tex: THREE.Texture; aspect: number } => d !== null))
  }, [loadedTex, vertices, repeatedPosts, posts])

  const firedRef = useRef(false)
  useEffect(() => {
    if (spriteData.length > 0 && !firedRef.current) { firedRef.current = true; onLoaded?.() }
  }, [spriteData.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showConnections || vertices.length < 2) {
      connectionsRef.current = []
      posArrRef.current = null
      return
    }
    const k = 3
    const seen = new Set<string>()
    const pairs: [number, number][] = []
    for (let i = 0; i < vertices.length; i++) {
      const pi = vertices[i].pos
      const sorted = vertices
        .map((v, j) => ({ j, d: j === i ? Infinity : pi.distanceTo(v.pos) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, k)
      for (const { j } of sorted) {
        const key = `${Math.min(i, j)}_${Math.max(i, j)}`
        if (!seen.has(key)) { seen.add(key); pairs.push([Math.min(i, j), Math.max(i, j)]) }
      }
    }
    connectionsRef.current = pairs
    const buf = new Float32Array(pairs.length * 12)
    posArrRef.current = buf
    // Dispose old geometry and create a fresh one to avoid WebGL VAO cache issues
    // when the segment count changes (old attribute objects stay bound to stale VAO).
    lineGeoRef.current.dispose()
    const newGeo = new LineSegmentsGeometry()
    newGeo.setPositions(buf)
    lineGeoRef.current = newGeo
    lineSegs2Ref.current.geometry = newGeo
  }, [showConnections, vertices])

  useEffect(() => {
    if ((!showConnections && !drift) || vertices.length === 0) { driftRef.current = []; return }
    driftRef.current = vertices.map(() => {
      const angle = Math.random() * Math.PI * 2
      const elevation = (Math.random() - 0.5) * Math.PI
      return {
        dx: Math.cos(elevation) * Math.cos(angle),
        dy: Math.sin(elevation),
        dz: Math.cos(elevation) * Math.sin(angle),
        phase: Math.random() * Math.PI * 2,
        speed: (0.15 + Math.random() * 0.2) * driftSpeed,
      }
    })
  }, [showConnections, drift, driftSpeed, vertices])

  useEffect(() => {
    const mat = lineMatRef.current
    return () => { lineGeoRef.current.dispose(); mat.dispose() }
  }, [])

  if (vertices.length === 0 || spriteData.length === 0) return null

  const _up = new THREE.Vector3(0, 0, 1)
  return (
    <>
      {showConnections && (
        <group ref={lineGroupRef}>
          <primitive object={lineSegs2Ref.current} />
        </group>
      )}
      {vertices.map((v, i) => {
        const { tex, aspect } = spriteData[i % spriteData.length]
        const px = v.pos.x + v.normal.x * 0.02
        const py = v.pos.y + v.normal.y * 0.02
        const pz = v.pos.z + v.normal.z * 0.02
        const randScale = (sizeRandomize && sizeScales) ? (sizeScales[i] ?? 1) : 1
        if (facing === 'camera') {
          return (
            <sprite
              key={i}
              ref={(el: THREE.Sprite | null) => { if (el) meshMap.current.set(i, el as unknown as THREE.Mesh); else meshMap.current.delete(i) }}
              position={[px, py, pz]}
              scale={[size * aspect * randScale, size * randScale, 1]}
            >
              <spriteMaterial map={tex} sizeAttenuation transparent depthWrite={false} />
            </sprite>
          )
        }
        const q = new THREE.Quaternion().setFromUnitVectors(_up, v.normal)
        return (
          <mesh
            key={i}
            ref={(el: THREE.Mesh | null) => { if (el) meshMap.current.set(i, el); else meshMap.current.delete(i) }}
            position={[px, py, pz]}
            quaternion={q}
            scale={[size * aspect * randScale, size * randScale, 1]}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex} side={THREE.DoubleSide} transparent alphaTest={0.01} />
          </mesh>
        )
      })}
    </>
  )
}

// ── FigureWireframe ───────────────────────────────────────────────────────────
export function FigureWireframe({ scene, style, dotSize, dotColor, dotCount, transitionKey, flicker = false }: { scene: THREE.Object3D; style: WireframeStyle; dotSize: number; dotColor: string; dotCount: number; transitionKey: number; flicker?: boolean }) {
  const geo = useMemo(() => {
    scene.updateMatrixWorld(true)
    const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    const pts: number[] = []

    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const rel = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(rootInv)
      let srcGeo: THREE.BufferGeometry

      if (style === 'dense') {
        srcGeo = new THREE.WireframeGeometry(mesh.geometry)
      } else if (style === 'edges' || style === 'dashed') {
        srcGeo = new THREE.EdgesGeometry(mesh.geometry, 20)
      } else {
        srcGeo = mesh.geometry
      }

      const pos = srcGeo.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(rel)
        pts.push(v.x, v.y, v.z)
      }
      if (style !== 'points') srcGeo.dispose()
    })

    let finalPts = pts
    if (style === 'points' && dotCount < pts.length / 3) {
      const stride = Math.max(1, Math.floor(pts.length / 3 / dotCount))
      finalPts = []
      for (let i = 0; i < pts.length / 3 && finalPts.length / 3 < dotCount; i += stride) {
        finalPts.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])
      }
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(finalPts), 3))
    return g
  }, [scene, style, dotCount])

  const dashedRef = useRef<THREE.LineSegments>(null)
  const pointsMatRef = useRef<THREE.PointsMaterial>(null)
  const flickerTimeRef = useRef(0)

  useEffect(() => { dashedRef.current?.computeLineDistances() }, [geo])
  useEffect(() => () => { geo.dispose() }, [geo])
  useEffect(() => {
    if (!pointsMatRef.current) return
    pointsMatRef.current.size = dotSize
    pointsMatRef.current.color.set(dotColor)
    pointsMatRef.current.needsUpdate = true
  }, [dotSize, dotColor])

  useEffect(() => {
    if (!flicker || transitionKey === 0) return
    flickerTimeRef.current = 1.5
  }, [transitionKey, flicker])

  useFrame((_, delta) => {
    if (flickerTimeRef.current > 0 && pointsMatRef.current) {
      flickerTimeRef.current -= delta
      const elapsed = 1.5 - Math.max(flickerTimeRef.current, 0)
      const amplitude = Math.max(0, 1 - elapsed / 1.5)
      const wave = 0.5 + 0.5 * Math.sin(elapsed * 3 * Math.PI * 2)
      pointsMatRef.current.opacity = 1 - amplitude * 0.85 * wave
      pointsMatRef.current.needsUpdate = true
      if (flickerTimeRef.current <= 0) { pointsMatRef.current.opacity = 1; pointsMatRef.current.needsUpdate = true }
    }
  })

  if (style === 'points') return (
    <points geometry={geo}>
      <pointsMaterial ref={pointsMatRef} color={dotColor} size={dotSize} sizeAttenuation transparent />
    </points>
  )
  if (style === 'dashed') return (
    <lineSegments ref={dashedRef} geometry={geo}>
      <lineDashedMaterial color="#000000" dashSize={0.04} gapSize={0.04} />
    </lineSegments>
  )
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#000000" />
    </lineSegments>
  )
}

// ── FigureRings ───────────────────────────────────────────────────────────────
export function FigureRings({ scene, ringCount = 40, color = '#000000', analyserRef }: { scene: THREE.Object3D; ringCount?: number; color?: string; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  const ringRefs = useRef<(THREE.LineSegments | null)[]>([])
  const dataArrRef = useRef<Uint8Array | null>(null)

  useFrame(() => {
    let data: Uint8Array | null = null
    if (analyserRef?.current) {
      const a = analyserRef.current
      if (!dataArrRef.current || dataArrRef.current.length !== a.frequencyBinCount) {
        dataArrRef.current = new Uint8Array(a.frequencyBinCount)
      }
      a.getByteFrequencyData(dataArrRef.current as Uint8Array<ArrayBuffer>)
      data = dataArrRef.current
    }
    const n = rings.length
    for (let i = 0; i < n; i++) {
      const obj = ringRefs.current[i]
      if (!obj) continue
      let vol = 0
      if (data) {
        const bi = Math.min(data.length - 1, Math.floor((i / n) * data.length * 0.6))
        vol = data[bi] / 255
      }
      const damp = i < 5 ? 0.1 : i < 12 ? 0.1 + ((i - 4) / 8) * 0.9 : 1
      const s = 1 + vol * 0.4 * damp
      obj.scale.set(s, 1, s)
      obj.position.set(rings[i].cx * (1 - s), 0, rings[i].cz * (1 - s))
    }
  })

  const rings = useMemo(() => {
    scene.updateMatrixWorld(true)
    const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()

    const tris: number[] = []
    let minY = Infinity, maxY = -Infinity
    const _v = new THREE.Vector3()
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const rel = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(rootInv)
      const geoAttr = mesh.geometry.getAttribute('position')
      if (!geoAttr) return
      const idx = mesh.geometry.index
      const triCount = idx ? idx.count / 3 : geoAttr.count / 3
      for (let t = 0; t < triCount; t++) {
        for (let c = 0; c < 3; c++) {
          const i = idx ? idx.getX(t * 3 + c) : t * 3 + c
          _v.set(geoAttr.getX(i), geoAttr.getY(i), geoAttr.getZ(i)).applyMatrix4(rel)
          tris.push(_v.x, _v.y, _v.z)
          if (_v.y < minY) minY = _v.y
          if (_v.y > maxY) maxY = _v.y
        }
      }
    })
    if (tris.length === 0) return []

    const out: { geo: THREE.BufferGeometry; cx: number; cz: number }[] = []
    const pad = (maxY - minY) * 0.005
    for (let ri = 0; ri <= ringCount; ri++) {
      const y = minY + pad + ((maxY - minY) - 2 * pad) * (ri / ringCount)
      const ringPts: number[] = []
      for (let t = 0; t < tris.length; t += 9) {
        const ay = tris[t + 1], by = tris[t + 4], cy = tris[t + 7]
        if ((ay > y && by > y && cy > y) || (ay < y && by < y && cy < y)) continue
        let px1 = 0, pz1 = 0, px2 = 0, pz2 = 0, found = 0
        const edges = [[0, 3], [3, 6], [6, 0]] as const
        for (const [e1, e2] of edges) {
          const y1 = tris[t + e1 + 1], y2 = tris[t + e2 + 1]
          if ((y1 > y) === (y2 > y)) continue
          const f = (y - y1) / (y2 - y1)
          const x = tris[t + e1] + (tris[t + e2] - tris[t + e1]) * f
          const z = tris[t + e1 + 2] + (tris[t + e2 + 2] - tris[t + e1 + 2]) * f
          if (found === 0) { px1 = x; pz1 = z; found = 1 }
          else if (found === 1) { px2 = x; pz2 = z; found = 2; break }
        }
        if (found === 2) ringPts.push(px1, y, pz1, px2, y, pz2)
      }
      if (ringPts.length === 0) continue

      let cx = 0, cz = 0
      const ptCount = ringPts.length / 3
      for (let i = 0; i < ringPts.length; i += 3) { cx += ringPts[i]; cz += ringPts[i + 2] }
      cx /= ptCount; cz /= ptCount

      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ringPts), 3))
      out.push({ geo: g, cx, cz })
    }
    return out
  }, [scene, ringCount])

  useEffect(() => () => { rings.forEach(r => r.geo.dispose()) }, [rings])

  return (
    <group>
      {rings.map((r, i) => (
        <lineSegments key={i} ref={(el: THREE.LineSegments | null) => { ringRefs.current[i] = el }} geometry={r.geo}>
          <lineBasicMaterial color={color} />
        </lineSegments>
      ))}
    </group>
  )
}
