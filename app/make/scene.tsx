'use client'

import { Suspense, useMemo, useEffect, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera, OrthographicCamera, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// ── Capture ───────────────────────────────────────────────────────────────────
function CaptureSetup({ captureRef }: { captureRef: React.MutableRefObject<(() => string) | null> }) {
  const { gl } = useThree()
  useEffect(() => {
    captureRef.current = () => gl.domElement.toDataURL('image/png')
    return () => { captureRef.current = null }
  }, [gl, captureRef])
  return null
}

// ── Background ────────────────────────────────────────────────────────────────
function BackgroundSetter({ color, image }: { color: string; image: string | null }) {
  const { scene, size } = useThree()
  useEffect(() => {
    if (image) {
      let cancelled = false
      let tex: THREE.CanvasTexture | null = null
      const img = new window.Image()
      img.onload = () => {
        if (cancelled) return
        const cw = size.width, ch = size.height
        const iw = img.naturalWidth, ih = img.naturalHeight
        const scale = Math.max(cw / iw, ch / ih)
        const dw = iw * scale, dh = ih * scale
        const canvas = document.createElement('canvas')
        canvas.width = cw; canvas.height = ch
        canvas.getContext('2d')!.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh)
        tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        scene.background = tex
      }
      img.src = image
      return () => { cancelled = true; tex?.dispose(); scene.background = null }
    }
    // eslint-disable-next-line react-hooks/immutability -- setting scene.background is the standard R3F imperative pattern
    scene.background = new THREE.Color(color)
    return () => { scene.background = null }
  }, [color, image, scene, size.width, size.height])
  return null
}

// ── Vertex sampler (area-weighted, deterministic) ─────────────────────────────
// Split in two: building the triangle list traverses the whole mesh (expensive,
// allocation-heavy) and depends only on the model, so it's memoized on `scene`.
// Sampling N points from that prebuilt list is cheap — so dragging the repeat
// slider only re-samples instead of rebuilding the triangle list every tick.
type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; na: THREE.Vector3; nb: THREE.Vector3; nc: THREE.Vector3; area: number }
type TriangleData = { tris: Tri[]; cum: Float64Array; totalArea: number }

function buildTriangleData(root: THREE.Object3D): TriangleData {
  root.updateMatrixWorld(true)
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert()
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
  const cum = new Float64Array(tris.length)
  let acc = 0
  for (let i = 0; i < tris.length; i++) { acc += tris[i].area; cum[i] = acc }
  return { tris, cum, totalArea }
}

function sampleTriangleData({ tris, cum, totalArea }: TriangleData, count: number): { pos: THREE.Vector3; normal: THREE.Vector3 }[] {
  if (count === 0 || tris.length === 0 || totalArea === 0) return []
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

// ── Texture loader ─────────────────────────────────────────────────────────────
type TexEntry = { tex: THREE.Texture; aspect: number }
const texCache = new Map<string, Promise<TexEntry>>()

// Cache key includes bgColor so transparency is composited correctly per background
function loadTex(url: string, bgColor: string): Promise<TexEntry> {
  const key = `${url}|${bgColor}`
  let p = texCache.get(key)
  if (p) return p
  p = new Promise<TexEntry>(resolve => {
    const img = new window.Image()
    if (!url.startsWith('blob:')) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1
      const maxDim = 1024
      const scale = Math.min(1, maxDim / Math.max(w, h))
      const canvas = document.createElement('canvas')
      canvas.width  = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      resolve({ tex, aspect: w / h })
    }
    img.onerror = () => resolve({ tex: new THREE.Texture(), aspect: 1 })
    img.src = url
  })
  texCache.set(key, p)
  return p
}

// ── Mixed vertex images (camera + uploaded) ────────────────────────────────────
// Images and camera are managed by SEPARATE effects so that uploading images never
// tears down a running camera, and toggling the camera never reloads images. This
// makes the two orderings (camera-first vs images-first) behave identically.
function MixedImages({ scene, imageUrls, cameraStream, size, repeat, shuffleSeed, bgColor }: {
  scene: THREE.Object3D
  imageUrls: string[]
  cameraStream: MediaStream | null
  size: number
  repeat: number
  shuffleSeed: number
  bgColor: string
}) {
  const imgSrcCount = imageUrls.length
  const imgCount = imgSrcCount * repeat
  const camCount = cameraStream ? repeat : 0
  const count = imgCount + camCount

  const triData = useMemo(() => buildTriangleData(scene), [scene])
  const vertices = useMemo(() => sampleTriangleData(triData, count), [triData, count])

  // ── Image textures — rebuilt ONLY when imageUrls changes ──────────────────────
  const [imgEntries, setImgEntries] = useState<TexEntry[]>([])
  useEffect(() => {
    let cancelled = false
    // Empty imageUrls → Promise.all([]) resolves to [] and clears entries, without a
    // synchronous setState in the effect body.
    Promise.all(imageUrls.map(url => loadTex(url, bgColor))).then(entries => {
      if (!cancelled) setImgEntries(entries)
    })
    return () => { cancelled = true }
  }, [imageUrls])

  // ── Camera texture — set up ONLY when cameraStream changes ─────────────────────
  const [camTex, setCamTex] = useState<THREE.VideoTexture | null>(null)
  const [camAspect, setCamAspect] = useState(4 / 3)
  useEffect(() => {
    // No stream → nothing to set up. The previous run's cleanup already disposed and
    // nulled camTex, so there's no synchronous setState here.
    if (!cameraStream) return
    let cancelled = false
    let made = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const video = document.createElement('video')
    video.srcObject = cameraStream
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    video.play().catch(() => {})

    // Always create the texture once metadata is known; a timeout fallback guarantees
    // it's created even if 'loadedmetadata' is missed — this is what makes it reliable.
    const make = () => {
      if (cancelled || made) return
      made = true
      if (timer) clearTimeout(timer)
      if (video.videoWidth > 0) setCamAspect(video.videoWidth / video.videoHeight)
      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      setCamTex(tex)
    }

    if (video.readyState >= 1 && video.videoWidth > 0) make()
    else {
      video.addEventListener('loadedmetadata', make, { once: true })
      timer = setTimeout(make, 2000)
    }

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      video.removeEventListener('loadedmetadata', make)
      video.pause()
      video.srcObject = null
      setCamTex(prev => { prev?.dispose(); return null })
    }
  }, [cameraStream])

  // ── Materials — one per source; disposed only when its source changes ─────────
  const imgMats = useMemo(
    () => imgEntries.map(e => new THREE.SpriteMaterial({ map: e.tex, sizeAttenuation: true, transparent: true, depthWrite: false })),
    [imgEntries]
  )
  useEffect(() => () => { imgMats.forEach(m => m.dispose()) }, [imgMats])

  const camMat = useMemo(
    () => camTex ? new THREE.SpriteMaterial({ map: camTex, sizeAttenuation: true, transparent: true, depthWrite: false }) : null,
    [camTex]
  )
  useEffect(() => () => { camMat?.dispose() }, [camMat])

  // Per-vertex source: an image index (>= 0) or -1 for the camera. shuffleSeed === 0
  // keeps the default order (images first, camera after); any other seed deterministically
  // shuffles the pool so images — and the camera — interleave across the whole figure.
  const assignment = useMemo(() => {
    const pool: number[] = []
    for (let i = 0; i < imgCount; i++) pool.push(imgSrcCount > 0 ? i % imgSrcCount : -1)
    for (let i = 0; i < camCount; i++) pool.push(-1)
    if (shuffleSeed !== 0) {
      let a = shuffleSeed >>> 0
      const rand = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp
      }
    }
    return pool
  }, [imgCount, camCount, imgSrcCount, shuffleSeed])

  if (vertices.length === 0 || (imgMats.length === 0 && !camMat)) return null

  return (
    <>
      {vertices.map((v, i) => {
        const src = assignment[i] ?? -1
        let mat: THREE.SpriteMaterial
        let aspect: number
        if (src >= 0 && imgMats.length > 0) {
          const m = imgMats[src], e = imgEntries[src]
          if (!m || !e) return null  // texture still loading
          mat = m; aspect = e.aspect
        } else if (camMat) {
          mat = camMat; aspect = camAspect
        } else {
          return null
        }
        return (
          <sprite
            key={i}
            material={mat}
            position={[v.pos.x + v.normal.x * 0.02, v.pos.y + v.normal.y * 0.02, v.pos.z + v.normal.z * 0.02]}
            scale={[size * aspect, size, 1]}
          />
        )
      })}
    </>
  )
}

// ── Dot cloud ──────────────────────────────────────────────────────────────────
function FigureDots({ scene }: { scene: THREE.Object3D }) {
  const geo = useMemo(() => {
    const DOT_COUNT = 30000
    scene.updateMatrixWorld(true)
    const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    const all: number[] = []
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const rel = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(rootInv)
      const pos = mesh.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(rel)
        all.push(v.x, v.y, v.z)
      }
    })
    const stride = Math.max(1, Math.floor(all.length / 3 / DOT_COUNT))
    const sub: number[] = []
    for (let i = 0; i < all.length / 3 && sub.length / 3 < DOT_COUNT; i += stride) {
      sub.push(all[i * 3], all[i * 3 + 1], all[i * 3 + 2])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sub), 3))
    return g
  }, [scene])
  useEffect(() => () => { geo.dispose() }, [geo])
  return (
    <points geometry={geo}>
      <pointsMaterial color="#000000" size={0.4} sizeAttenuation />
    </points>
  )
}

// ── Figure ─────────────────────────────────────────────────────────────────────
function Figure({ imageUrls, size, repeat, cameraStream, shuffleSeed, bgColor }: { imageUrls: string[]; size: number; repeat: number; cameraStream: MediaStream | null; shuffleSeed: number; bgColor: string }) {
  const { scene } = useGLTF('/figure.glb')
  const clone = useMemo(() => scene.clone(true), [scene])

  return (
    <group scale={200} rotation={[0, 0, 0]}>
      <FigureDots scene={clone} />
      {(imageUrls.length > 0 || !!cameraStream) && (
        <MixedImages scene={clone} imageUrls={imageUrls} cameraStream={cameraStream} size={size} repeat={repeat} shuffleSeed={shuffleSeed} bgColor={bgColor} />
      )}
    </group>
  )
}

// ── Canvas ─────────────────────────────────────────────────────────────────────
export default function Scene({ imageUrls, size, repeat, shuffleSeed, bgColor, bgImage, cameraStream, captureRef, orthographic }: { imageUrls: string[]; size: number; repeat: number; shuffleSeed: number; bgColor: string; bgImage: string | null; cameraStream: MediaStream | null; captureRef: React.MutableRefObject<(() => string) | null>; orthographic: boolean }) {
  return (
    <Canvas style={{ width: '100%', height: '100%', cursor: 'default', background: bgColor }} gl={{ preserveDrawingBuffer: true }} onPointerMissed={undefined}>
      <CaptureSetup captureRef={captureRef} />
      <BackgroundSetter color={bgColor} image={bgImage} />
      {orthographic
        ? <OrthographicCamera makeDefault position={[0, 150, 600]} zoom={2} near={0.1} far={5000} />
        : <PerspectiveCamera makeDefault position={[0, 150, 600]} fov={40} near={0.1} far={5000} />
      }
      <OrbitControls
        target={[0, 260, 0]}
        enableZoom={true}
        enablePan={false}
        minPolarAngle={Math.PI / 2 - Math.PI / 8}
        maxPolarAngle={Math.PI / 2 + Math.PI / 8}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
      />
      <Suspense fallback={null}>
        <Figure imageUrls={imageUrls} size={size} repeat={repeat} cameraStream={cameraStream} shuffleSeed={shuffleSeed} bgColor={bgColor} />
      </Suspense>
    </Canvas>
  )
}
