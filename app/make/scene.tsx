'use client'

import { Suspense, useMemo, useEffect, useState, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls, useGLTF } from '@react-three/drei'
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
    scene.background = new THREE.Color(color)
    return () => { scene.background = null }
  }, [color, image, scene, size.width, size.height])
  return null
}

// ── Vertex sampler (area-weighted, deterministic) ─────────────────────────────
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

// ── Texture loader ─────────────────────────────────────────────────────────────
type TexEntry = { tex: THREE.Texture; aspect: number }
const texCache = new Map<string, Promise<TexEntry>>()

function loadTex(url: string): Promise<TexEntry> {
  let p = texCache.get(url)
  if (p) return p
  p = new Promise<TexEntry>(resolve => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.src = url
    img.decode().then(() => {
      const w = img.naturalWidth || 1, h = img.naturalHeight || 1
      const maxDim = 1024
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
  texCache.set(url, p)
  return p
}

// ── Vertex images ──────────────────────────────────────────────────────────────
function VertexImages({ scene, imageUrls, size, repeat }: {
  scene: THREE.Object3D
  imageUrls: string[]
  size: number
  repeat: number
}) {
  const totalCount = imageUrls.length * repeat
  const vertices = useMemo(() => sampleVerticesWithNormals(scene, totalCount), [scene, totalCount])
  const [textures, setTextures] = useState<Map<string, TexEntry>>(new Map())

  useEffect(() => {
    if (imageUrls.length === 0) return
    imageUrls.forEach(url => {
      loadTex(url).then(entry => {
        setTextures(prev => {
          if (prev.get(url)?.tex === entry.tex) return prev
          return new Map(prev).set(url, entry)
        })
      })
    })
  }, [imageUrls])

  if (vertices.length === 0 || textures.size < imageUrls.length) return null

  return (
    <>
      {vertices.map((v, i) => {
        const url = imageUrls[i % imageUrls.length]
        const entry = textures.get(url)
        if (!entry) return null
        return (
          <sprite
            key={i}
            position={[v.pos.x + v.normal.x * 0.02, v.pos.y + v.normal.y * 0.02, v.pos.z + v.normal.z * 0.02]}
            scale={[size * entry.aspect, size, 1]}
          >
            <spriteMaterial map={entry.tex} sizeAttenuation transparent depthWrite={false} />
          </sprite>
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

// ── Camera vertex images ───────────────────────────────────────────────────────
function CameraVertexImages({ scene, stream, size, repeat }: { scene: THREE.Object3D; stream: MediaStream; size: number; repeat: number }) {
  const vertices = useMemo(() => sampleVerticesWithNormals(scene, repeat), [scene, repeat])
  const texRef = useRef<THREE.VideoTexture | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.play().then(() => {
      const tex = new THREE.VideoTexture(video)
      tex.colorSpace = THREE.SRGBColorSpace
      texRef.current = tex
      setReady(true)
    })
    return () => {
      texRef.current?.dispose()
      texRef.current = null
      video.srcObject = null
      setReady(false)
    }
  }, [stream])

  if (!ready || !texRef.current || vertices.length === 0) return null

  const tex = texRef.current
  const aspect = stream.getVideoTracks()[0]?.getSettings().aspectRatio ?? 16 / 9

  return (
    <>
      {vertices.map((v, i) => (
        <sprite
          key={i}
          position={[v.pos.x + v.normal.x * 0.02, v.pos.y + v.normal.y * 0.02, v.pos.z + v.normal.z * 0.02]}
          scale={[size * aspect, size, 1]}
        >
          <spriteMaterial map={tex} sizeAttenuation transparent depthWrite={false} />
        </sprite>
      ))}
    </>
  )
}

// ── Figure ─────────────────────────────────────────────────────────────────────
function Figure({ imageUrls, size, repeat, cameraStream }: { imageUrls: string[]; size: number; repeat: number; cameraStream: MediaStream | null }) {
  const { scene } = useGLTF('/figure.glb')
  const clone = useMemo(() => scene.clone(true), [scene])
  return (
    <group scale={200} rotation={[0, 0, 0]}>
      <FigureDots scene={clone} />
      {imageUrls.length > 0 && <VertexImages scene={clone} imageUrls={imageUrls} size={size} repeat={repeat} />}
      {cameraStream && <CameraVertexImages scene={clone} stream={cameraStream} size={size} repeat={repeat} />}
    </group>
  )
}

// ── Canvas ─────────────────────────────────────────────────────────────────────
export default function Scene({ imageUrls, size, repeat, bgColor, bgImage, cameraStream, captureRef }: { imageUrls: string[]; size: number; repeat: number; bgColor: string; bgImage: string | null; cameraStream: MediaStream | null; captureRef: React.MutableRefObject<(() => string) | null> }) {
  return (
    <Canvas style={{ width: '100%', height: '100%', cursor: 'default', background: bgColor }} gl={{ preserveDrawingBuffer: true }} onPointerMissed={undefined}>
      <CaptureSetup captureRef={captureRef} />
      <BackgroundSetter color={bgColor} image={bgImage} />
      <PerspectiveCamera makeDefault position={[0, 150, 600]} fov={40} near={0.1} far={5000} />
      <OrbitControls
        target={[0, 260, 0]}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2 - Math.PI / 8}
        maxPolarAngle={Math.PI / 2 + Math.PI / 8}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
      />
      <Suspense fallback={null}>
        <Figure imageUrls={imageUrls} size={size} repeat={repeat} cameraStream={cameraStream} />
      </Suspense>
    </Canvas>
  )
}
