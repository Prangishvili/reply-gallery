'use client'

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { WireframeStyle } from './room'

// ── Constants ─────────────────────────────────────────────────────────────────
const IS_MOBILE = typeof window !== 'undefined' &&
  (window.innerWidth < 1000 || /iPhone|iPad|Android/i.test(navigator.userAgent))
const TEX_MAX_DIM = IS_MOBILE ? 256 : 512
// SELF view holds only a handful of textures (one per upload), so it can
// afford higher resolution than the 144-texture circle view
const SELF_TEX_MAX_DIM = IS_MOBILE ? 512 : 1000
const MAX_DPR = IS_MOBILE ? 1.5 : 2
const _Z = new THREE.Vector3(0, 0, 1)

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

// ── Vertex sampling (area-weighted, with normals) ─────────────────────────────
function sampleVerticesWithNormals(root: THREE.Object3D, count: number): { pos: THREE.Vector3; normal: THREE.Vector3 }[] {
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

// ── Wireframe dots ────────────────────────────────────────────────────────────
function FigureWireframe({ scene, style, dotSize, dotColor, dotCount, transitionKey, flicker = false }: { scene: THREE.Object3D; style: WireframeStyle; dotSize: number; dotColor: string; dotCount: number; transitionKey: number; flicker?: boolean }) {
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

// ── Texture helpers ───────────────────────────────────────────────────────────
async function loadImgMeta(url: string): Promise<{ aspect: number; isSvg: boolean; isGif: boolean }> {
  let isSvg = false, isGif = false
  try {
    const r = await fetch(url, { method: 'HEAD' })
    const ct = r.headers.get('content-type') ?? ''
    isSvg = ct.includes('svg')
    isGif = ct.includes('gif')
  } catch {}
  const aspect = await new Promise<number>(resolve => {
    const img = new window.Image()
    img.onload  = () => resolve((img.naturalWidth || 800) / (img.naturalHeight || 800))
    img.onerror = () => resolve(1)
    img.src = url
  })
  return { aspect, isSvg, isGif }
}

function loadVideoMeta(url: string): Promise<number> {
  return new Promise(resolve => {
    const vid = document.createElement('video')
    vid.src = url
    const onMeta = () => resolve((vid.videoWidth / vid.videoHeight) || 4 / 3)
    if (vid.readyState >= 1) { onMeta(); return }
    vid.addEventListener('loadedmetadata', onMeta, { once: true })
    setTimeout(() => resolve(4 / 3), 2000)
  })
}

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
function loadCappedTex(url: string, maxDim = TEX_MAX_DIM): Promise<THREE.Texture> {
  return loadCappedTexMeta(url, maxDim).then(r => r.tex)
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

// ── Self vertex images (camera + uploaded media on the figure) ────────────────
function SelfVertexImages({ scene, stream, count, size, images, facing, analyserRef }: {
  scene: THREE.Object3D; stream: MediaStream | null; count: number; size: number
  images: { url: string; isVideo: boolean }[]; facing: 'camera' | 'surface'
  analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  const data     = useMemo(() => sampleVerticesWithNormals(scene, count), [scene, count])
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])
  const [mats,    setMats   ] = useState<THREE.MeshBasicMaterial[]>([])
  const [aspects, setAspects] = useState<number[]>([])
  const [flips,   setFlips  ] = useState<number[]>([])
  const [ready,   setReady  ] = useState(false)
  const dataArrRef = useRef<Uint8Array | null>(null)

  useFrame(({ camera }) => {
    if (facing === 'camera') {
      meshRefs.current.forEach(m => { if (m) m.lookAt(camera.position) })
    }
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
    const s = 1 + vol * 3
    meshRefs.current.forEach((m, i) => { if (m) m.scale.set(s * (flips[i] ?? 1), s, 1) })
  })

  useEffect(() => {
    if (!stream && images.length === 0) return
    let cancelled = false
    let camVid: HTMLVideoElement | null = null
    if (stream) {
      camVid = document.createElement('video')
      camVid.srcObject = stream
      camVid.autoplay = true; camVid.muted = true; camVid.playsInline = true
      camVid.play().catch(() => {})
    }
    const fileVids: HTMLVideoElement[] = []

    const init = async () => {
      const camAspect = camVid
        ? await new Promise<number>(resolve => {
            if (camVid!.videoWidth) { resolve(camVid!.videoWidth / camVid!.videoHeight); return }
            const onMeta = () => resolve(camVid!.videoWidth / camVid!.videoHeight || 4 / 3)
            camVid!.addEventListener('loadedmetadata', onMeta, { once: true })
            setTimeout(() => resolve(4 / 3), 2000)
          })
        : 4 / 3

      const mediaMeta = await Promise.all(images.map(({ url, isVideo }) =>
        isVideo
          ? loadVideoMeta(url).then(aspect => ({ aspect, isSvg: false, isGif: false, isVideo: true }))
          : loadImgMeta(url).then(m => ({ ...m, isVideo: false }))
      ))

      if (cancelled) return

      const camTex = camVid ? new THREE.VideoTexture(camVid) : null
      if (camTex) camTex.colorSpace = THREE.SRGBColorSpace

      const uploadTex = await Promise.all(images.map(async ({ url }, idx) => {
        const meta = mediaMeta[idx]
        if (meta.isVideo) {
          const vid = document.createElement('video')
          vid.src = url
          vid.loop = true; vid.muted = true; vid.autoplay = true; vid.playsInline = true
          vid.play().catch(() => {})
          fileVids.push(vid)
          const t = new THREE.VideoTexture(vid)
          t.colorSpace = THREE.SRGBColorSpace
          return t
        }
        if (meta.isSvg) return makeSvgTex(url, meta.aspect, false)
        return loadCappedTex(url, SELF_TEX_MAX_DIM)
      }))

      if (cancelled) { camTex?.dispose(); uploadTex.forEach(t => t.dispose()); return }

      const newMats: THREE.MeshBasicMaterial[] = []
      const newAspects: number[] = []
      const newFlips: number[] = []

      for (let i = 0; i < count; i++) {
        const useUploaded = images.length > 0 && (!camTex || Math.random() < 0.5)
        let tex: THREE.Texture
        let aspect: number

        if (useUploaded) {
          const idx = Math.floor(Math.random() * images.length)
          tex = uploadTex[idx]
          aspect = mediaMeta[idx].aspect
        } else {
          tex = camTex!
          aspect = camAspect
        }

        newMats.push(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }))
        newAspects.push(aspect)
        newFlips.push(Math.random() < 0.5 ? -1 : 1)
      }

      meshRefs.current = new Array(count).fill(null)
      setMats(newMats)
      setAspects(newAspects)
      setFlips(newFlips)
      setReady(true)
    }

    init()

    return () => {
      cancelled = true
      if (camVid) { camVid.srcObject = null }
      fileVids.forEach(v => { v.pause(); v.src = '' })
      setMats(prev => { prev.forEach(m => { m.map?.dispose(); m.dispose() }); return [] })
      setReady(false)
    }
  }, [stream, count, images])

  if (!ready || mats.length === 0 || data.length === 0) return null

  return (
    <>
      {data.map((item, i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => { meshRefs.current[i] = el }}
          position={item.pos.toArray() as [number, number, number]}
          material={mats[i]}
          {...(facing === 'surface' ? {
            quaternion: new THREE.Quaternion()
              .setFromUnitVectors(_Z, item.normal.clone().normalize())
              .toArray() as [number, number, number, number]
          } : {})}
        >
          <planeGeometry args={[size * (aspects[i] ?? 1), size]} />
        </mesh>
      ))}
    </>
  )
}

// ── Self scene + canvas ───────────────────────────────────────────────────────
function SelfScene({ stream, figureScale, figureFacing, imgSize, imgCount, bgColor, bgImage, images, facing, analyserRef }: {
  stream: MediaStream | null; figureScale: number; figureFacing: number; imgSize: number; imgCount: number; bgColor: string; bgImage: string | null; images: { url: string; isVideo: boolean }[]; facing: 'camera' | 'surface'; analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  const { scene: raw } = useGLTF('/figure.glb')
  const cloned = useMemo(() => {
    const c = raw.clone(true)
    c.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
    })
    return c
  }, [raw])

  return (
    <group scale={figureScale} rotation={[0, figureFacing, 0]}>
      <BackgroundSetter color={bgColor} image={bgImage} />
      <primitive object={cloned} />
      <FigureWireframe
        scene={cloned} style="points" dotSize={0.4} dotColor="#888888"
        dotCount={30000} transitionKey={0}
      />
      <SelfVertexImages scene={cloned} stream={stream} count={imgCount} size={imgSize} images={images} facing={facing} analyserRef={analyserRef} />
    </group>
  )
}

export function SelfCanvas({ stream, figureScale = 200, figureFacing = 4.65, imgSize = 0.1, imgCount = 60, bgColor = '#0a0a0a', bgImage = null, images = [], facing = 'camera', analyserRef }: {
  stream: MediaStream | null; figureScale?: number; figureFacing?: number; imgSize?: number; imgCount?: number; bgColor?: string; bgImage?: string | null; images?: { url: string; isVideo: boolean }[]; facing?: 'camera' | 'surface'; analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  return (
    <Canvas
      dpr={[1, MAX_DPR]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: bgColor }}
    >
      <PerspectiveCamera makeDefault position={[0, 150, 600]} fov={55} near={0.1} far={5000} />
      <OrbitControls target={[0, 150, 0]} enableDamping dampingFactor={0.08} />
      <Suspense fallback={null}>
        <SelfScene stream={stream} figureScale={figureScale} figureFacing={figureFacing} imgSize={imgSize} imgCount={imgCount} bgColor={bgColor} bgImage={bgImage} images={images} facing={facing} analyserRef={analyserRef} />
      </Suspense>
    </Canvas>
  )
}

export default SelfCanvas
