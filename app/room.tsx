'use client'

import React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, OrbitControls, Html, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'
import { NoiseGlobe } from './globe'

// ── Constants ─────────────────────────────────────────────────────────────────
const W   = 480   // room width = depth (square)
const H   = 400   // room height
const D   = W     // square floor plan
const EYE = 22.5  // camera eye height

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

// ── Billboard vertex images ────────────────────────────────────────────────────
function sampleVertices(root: THREE.Object3D, count: number): THREE.Vector3[] {
  const all: THREE.Vector3[] = []
  root.updateMatrixWorld(true)
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    if (!pos) return
    for (let i = 0; i < pos.count; i++) {
      all.push(
        new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i))
          .applyMatrix4(mesh.matrixWorld)
          .applyMatrix4(rootInv)
      )
    }
  })
  if (all.length === 0 || count === 0) return []
  const stride = Math.max(1, Math.floor(all.length / count))
  const result: THREE.Vector3[] = []
  for (let i = 0; i < all.length && result.length < count; i += stride) result.push(all[i])
  return result
}

function sampleVerticesWithNormals(root: THREE.Object3D, count: number): { pos: THREE.Vector3; normal: THREE.Vector3 }[] {
  const all: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = []
  root.updateMatrixWorld(true)
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert()
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const posAttr = mesh.geometry.getAttribute('position')
    const norAttr = mesh.geometry.getAttribute('normal')
    if (!posAttr) return
    const transform  = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld)
    const normalMat  = new THREE.Matrix3().getNormalMatrix(transform)
    for (let i = 0; i < posAttr.count; i++) {
      const pos = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(transform)
      const normal = norAttr
        ? new THREE.Vector3(norAttr.getX(i), norAttr.getY(i), norAttr.getZ(i)).applyMatrix3(normalMat).normalize()
        : pos.clone().normalize()
      all.push({ pos, normal })
    }
  })
  if (all.length === 0 || count === 0) return []
  const stride = Math.max(1, Math.floor(all.length / count))
  const result: { pos: THREE.Vector3; normal: THREE.Vector3 }[] = []
  for (let i = 0; i < all.length && result.length < count; i += stride) result.push(all[i])
  return result
}

function FigureVertexImages({ scene, posts, size, repeat, analyserRef }: { scene: THREE.Object3D; posts: Post[]; size: number; repeat: number; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  const repeatedPosts = useMemo(() => {
    const arr: Post[] = []
    for (let i = 0; i < Math.max(1, repeat); i++) arr.push(...posts)
    return arr
  }, [posts, repeat])
  const vertices = useMemo(
    () => repeatedPosts.length > 0 ? sampleVertices(scene, repeatedPosts.length) : [],
    [scene, repeatedPosts.length]
  )

  const spriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const [texData, setTexData] = useState<{ tex: THREE.Texture; aspect: number }[]>([])
  const dataArrRef = useRef<Uint8Array | null>(null)

  useFrame(() => {
    const sprites = spriteRefs.current
    if (!sprites.length || texData.length === 0) return
    let vol = 0
    if (analyserRef?.current) {
      const a = analyserRef.current
      if (!dataArrRef.current || dataArrRef.current.length !== a.frequencyBinCount)
        dataArrRef.current = new Uint8Array(a.frequencyBinCount)
      a.getByteFrequencyData(dataArrRef.current as Uint8Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < dataArrRef.current.length; i++) sum += dataArrRef.current[i]
      vol = Math.min((sum / dataArrRef.current.length / 255) * 5, 1)
    }
    sprites.forEach((sprite, i) => {
      if (!sprite) return
      const aspect = texData[i]?.aspect ?? 1
      const s = size * (1 + vol * 3)
      sprite.scale.set(s * aspect, s, 1)
    })
  })

  useEffect(() => {
    if (vertices.length === 0 || repeatedPosts.length === 0) return
    let cancelled = false

    const init = async () => {
      // Detect SVG via content-type fetch (same as SELF), deduplicated per unique URL
      const uniqueUrls = [...new Set(repeatedPosts.map(p => p.image_url))]
      const metaMap = new Map<string, { aspect: number; isSvg: boolean }>()
      await Promise.all(uniqueUrls.map(async url => { metaMap.set(url, await loadImgMeta(url)) }))
      if (cancelled) return

      const texMap = new Map<string, THREE.Texture>()
      for (const url of uniqueUrls) {
        const meta = metaMap.get(url)!
        let tex: THREE.Texture
        if (meta.isSvg) {
          tex = await makeSvgTex(url, meta.aspect, false)
        } else {
          tex = await new Promise<THREE.Texture>(resolve => {
            new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; resolve(t) })
          })
        }
        if (cancelled) { tex.dispose(); return }
        texMap.set(url, tex)
      }
      if (cancelled) return

      const newTexData: { tex: THREE.Texture; aspect: number }[] = []
      for (let i = 0; i < vertices.length; i++) {
        const url  = repeatedPosts[i % repeatedPosts.length].image_url
        const meta = metaMap.get(url) ?? { aspect: 1, isSvg: false }
        newTexData.push({ tex: texMap.get(url)!, aspect: meta.aspect })
      }
      setTexData(newTexData)
    }

    init()

    return () => {
      cancelled = true
      setTexData(prev => {
        const disposed = new Set<THREE.Texture>()
        prev.forEach(d => { if (!disposed.has(d.tex)) { disposed.add(d.tex); d.tex.dispose() } })
        return []
      })
    }
  }, [vertices, repeatedPosts])

  if (vertices.length === 0 || texData.length === 0) return null

  return (
    <>
      {vertices.map((v, i) => {
        const { tex, aspect } = texData[i % texData.length]
        return (
          <sprite key={i} ref={el => { spriteRefs.current[i] = el }} position={[v.x, v.y, v.z]} scale={[size * aspect, size, 1]}>
            <spriteMaterial map={tex} sizeAttenuation />
          </sprite>
        )
      })}
    </>
  )
}

// ── Wireframe styles ──────────────────────────────────────────────────────────
export type WireframeStyle = 'edges' | 'dense' | 'dashed' | 'points'
export type RoomCameraMode = 'freeroam' | 'perspective' | 'orthographic' | 'panoramic'

function FigureWireframe({ scene, style, dotSize, dotColor, dotCount, transitionKey, enableDissolve }: { scene: THREE.Object3D; style: WireframeStyle; dotSize: number; dotColor: string; dotCount: number; transitionKey: number; enableDissolve: boolean }) {
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

  // Dissolve animation
  const baseRef = useRef<Float32Array | null>(null)
  const velRef  = useRef<Float32Array | null>(null)
  const animRef = useRef(0)

  useEffect(() => { dashedRef.current?.computeLineDistances() }, [geo])
  useEffect(() => () => { geo.dispose() }, [geo])
  useEffect(() => {
    if (!pointsMatRef.current) return
    pointsMatRef.current.size = dotSize
    pointsMatRef.current.color.set(dotColor)
    pointsMatRef.current.needsUpdate = true
  }, [dotSize, dotColor])

  // Cache base positions whenever geometry changes
  useEffect(() => {
    const arr = geo.attributes.position?.array
    if (!arr) return
    baseRef.current = new Float32Array(arr)
    animRef.current = 0
  }, [geo])

  // Trigger scatter on student transition
  useEffect(() => {
    if (!enableDissolve || transitionKey === 0) return
    const arr = geo.attributes.position?.array
    if (!arr) return
    const count = arr.length / 3
    const vels = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const spd = 30 + Math.random() * 50
      vels[i * 3]     = Math.sin(phi) * Math.cos(theta) * spd
      vels[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * spd
      vels[i * 3 + 2] = Math.cos(phi) * spd
    }
    velRef.current = vels
    if (baseRef.current) {
      ;(geo.attributes.position.array as Float32Array).set(baseRef.current)
      geo.attributes.position.needsUpdate = true
    }
    animRef.current = 0.001
  }, [transitionKey, enableDissolve, geo])

  useFrame((_, delta) => {
    if (animRef.current <= 0 || !baseRef.current || !velRef.current) return
    const t = animRef.current
    const posAttr = geo.attributes.position
    const pos = posAttr.array as Float32Array
    const base = baseRef.current
    const vel = velRef.current
    if (t < 0.4) {
      for (let i = 0; i < pos.length; i++) pos[i] += vel[i] * delta
    } else if (t < 0.8) {
      for (let i = 0; i < pos.length; i++) pos[i] += (base[i] - pos[i]) * delta * 8
    } else {
      pos.set(base)
      animRef.current = 0
      posAttr.needsUpdate = true
      return
    }
    animRef.current += delta
    posAttr.needsUpdate = true
  })

  if (style === 'points') return (
    <points geometry={geo}>
      <pointsMaterial ref={pointsMatRef} color={dotColor} size={dotSize} sizeAttenuation />
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

// ── Vertical-axis rings ────────────────────────────────────────────────────────
function FigureRings({ scene, ringCount = 40, color = '#000000', analyserRef }: { scene: THREE.Object3D; ringCount?: number; color?: string; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  const groupRef = useRef<THREE.Group>(null)
  const dataArrRef = useRef<Uint8Array | null>(null)

  useFrame(() => {
    let vol = 0
    if (analyserRef?.current) {
      const a = analyserRef.current
      if (!dataArrRef.current || dataArrRef.current.length !== a.frequencyBinCount) {
        dataArrRef.current = new Uint8Array(a.frequencyBinCount)
      }
      a.getByteFrequencyData(dataArrRef.current as Uint8Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < dataArrRef.current.length; i++) sum += dataArrRef.current[i]
      vol = Math.min((sum / dataArrRef.current.length / 255) * 5, 1)
    }
    if (groupRef.current) {
      const s = 1 + vol * 0.3
      groupRef.current.scale.set(s, 1, s)
    }
  })
  const geo = useMemo(() => {
    scene.updateMatrixWorld(true)
    const rootInv = new THREE.Matrix4().copy(scene.matrixWorld).invert()

    const verts: { x: number; y: number; z: number }[] = []
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const rel = new THREE.Matrix4().copy(mesh.matrixWorld).premultiply(rootInv)
      const pos = mesh.geometry.getAttribute('position')
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(rel)
        verts.push({ x: v.x, y: v.y, z: v.z })
      }
    })
    if (verts.length === 0) return new THREE.BufferGeometry()

    let minY = Infinity, maxY = -Infinity
    for (const v of verts) { if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y }

    const sliceH = (maxY - minY) / ringCount
    const bins = 64 // angular sectors per ring
    const ringPts: number[] = []

    for (let ri = 0; ri <= ringCount; ri++) {
      const y = minY + ri * sliceH
      const band = sliceH * 1.0

      // Centroid of slice
      let cx = 0, cz = 0, n = 0
      for (const v of verts) {
        if (Math.abs(v.y - y) < band) { cx += v.x; cz += v.z; n++ }
      }
      if (n < 3) continue
      cx /= n; cz /= n

      // Per-bin: keep the vertex with maximum radius in each angular sector
      const binR = new Float32Array(bins).fill(0)
      const binX = new Float32Array(bins).fill(cx)
      const binZ = new Float32Array(bins).fill(cz)

      for (const v of verts) {
        if (Math.abs(v.y - y) >= band) continue
        const angle = Math.atan2(v.z - cz, v.x - cx) // -π..π
        const bi = Math.floor(((angle + Math.PI) / (Math.PI * 2)) * bins) % bins
        const r = Math.sqrt((v.x - cx) ** 2 + (v.z - cz) ** 2)
        if (r > binR[bi]) { binR[bi] = r; binX[bi] = v.x; binZ[bi] = v.z }
      }

      // Fill empty bins by interpolating from nearest filled neighbours
      for (let bi = 0; bi < bins; bi++) {
        if (binR[bi] > 0) continue
        let lo = -1, hi = -1
        for (let d = 1; d < bins; d++) {
          if (binR[(bi - d + bins) % bins] > 0) { lo = (bi - d + bins) % bins; break }
        }
        for (let d = 1; d < bins; d++) {
          if (binR[(bi + d) % bins] > 0) { hi = (bi + d) % bins; break }
        }
        if (lo >= 0 && hi >= 0) {
          binX[bi] = (binX[lo] + binX[hi]) / 2
          binZ[bi] = (binZ[lo] + binZ[hi]) / 2
        } else if (lo >= 0) {
          binX[bi] = binX[lo]; binZ[bi] = binZ[lo]
        } else if (hi >= 0) {
          binX[bi] = binX[hi]; binZ[bi] = binZ[hi]
        }
      }

      // Connect bins as a closed polyline
      for (let bi = 0; bi < bins; bi++) {
        const ni = (bi + 1) % bins
        ringPts.push(binX[bi], y, binZ[bi], binX[ni], y, binZ[ni])
      }
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ringPts), 3))
    return g
  }, [scene, ringCount])

  useEffect(() => () => { geo.dispose() }, [geo])

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color={color} />
      </lineSegments>
    </group>
  )
}

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

// ── Self (webcam) figure ──────────────────────────────────────────────────────
const _Z = new THREE.Vector3(0, 0, 1)

async function loadImgMeta(url: string): Promise<{ aspect: number; isSvg: boolean }> {
  let isSvg = false
  try {
    const r = await fetch(url)
    isSvg = (r.headers.get('content-type') ?? '').includes('svg')
  } catch {}
  const aspect = await new Promise<number>(resolve => {
    const img = new window.Image()
    img.onload  = () => resolve((img.naturalWidth || 800) / (img.naturalHeight || 800))
    img.onerror = () => resolve(1)
    img.src = url
  })
  return { aspect, isSvg }
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

function makeSvgTex(url: string, aspect: number, flip: boolean): Promise<THREE.CanvasTexture> {
  return new Promise(resolve => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tW = 2048, tH = Math.round(tW / aspect)
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

function SelfVertexImages({ scene, stream, count, size, images, facing }: {
  scene: THREE.Object3D; stream: MediaStream; count: number; size: number
  images: { url: string; isVideo: boolean }[]; facing: 'camera' | 'surface'
}) {
  const data     = useMemo(() => sampleVerticesWithNormals(scene, count), [scene, count])
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])
  const [mats,    setMats   ] = useState<THREE.MeshBasicMaterial[]>([])
  const [aspects, setAspects] = useState<number[]>([])
  const [ready,   setReady  ] = useState(false)

  useFrame(({ camera }) => {
    if (facing !== 'camera') return
    meshRefs.current.forEach(m => { if (m) m.lookAt(camera.position) })
  })

  useEffect(() => {
    let cancelled = false
    const camVid = document.createElement('video')
    camVid.srcObject = stream
    camVid.autoplay = true; camVid.muted = true; camVid.playsInline = true
    camVid.play().catch(() => {})
    const fileVids: HTMLVideoElement[] = []

    const init = async () => {
      const camAspect = await new Promise<number>(resolve => {
        if (camVid.videoWidth) { resolve(camVid.videoWidth / camVid.videoHeight); return }
        const onMeta = () => resolve(camVid.videoWidth / camVid.videoHeight || 4 / 3)
        camVid.addEventListener('loadedmetadata', onMeta, { once: true })
        setTimeout(() => resolve(4 / 3), 2000)
      })

      const mediaMeta = await Promise.all(images.map(({ url, isVideo }) =>
        isVideo
          ? loadVideoMeta(url).then(aspect => ({ aspect, isSvg: false, isVideo: true }))
          : loadImgMeta(url).then(m => ({ ...m, isVideo: false }))
      ))

      if (cancelled) return

      const newMats: THREE.MeshBasicMaterial[] = []
      const newAspects: number[] = []

      for (let i = 0; i < count; i++) {
        const useUploaded = images.length > 0 && Math.random() < 0.5
        let tex: THREE.Texture
        let aspect: number

        if (useUploaded) {
          const idx  = Math.floor(Math.random() * images.length)
          const flip = Math.random() < 0.5
          const meta = mediaMeta[idx]
          aspect = meta.aspect

          if (meta.isVideo) {
            const vid = document.createElement('video')
            vid.src = images[idx].url
            vid.loop = true; vid.muted = true; vid.autoplay = true; vid.playsInline = true
            vid.play().catch(() => {})
            fileVids.push(vid)
            tex = new THREE.VideoTexture(vid)
            tex.colorSpace = THREE.SRGBColorSpace
            if (flip) { tex.repeat.x = -1; tex.offset.x = 1 }
          } else if (meta.isSvg) {
            tex = await makeSvgTex(images[idx].url, aspect, flip)
          } else {
            tex = new THREE.TextureLoader().load(images[idx].url, t => {
              t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true
            })
            if (flip) { tex.repeat.x = -1; tex.offset.x = 1 }
          }
        } else {
          const flip = Math.random() < 0.5
          tex = new THREE.VideoTexture(camVid)
          tex.colorSpace = THREE.SRGBColorSpace
          if (flip) { tex.repeat.x = -1; tex.offset.x = 1 }
          aspect = camAspect
        }

        newMats.push(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }))
        newAspects.push(aspect)
      }

      meshRefs.current = new Array(count).fill(null)
      setMats(newMats)
      setAspects(newAspects)
      setReady(true)
    }

    init()

    return () => {
      cancelled = true
      camVid.srcObject = null
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

function SelfScene({ stream, figureScale, figureFacing, imgSize, imgCount, bgColor, bgImage, images, facing }: {
  stream: MediaStream; figureScale: number; figureFacing: number; imgSize: number; imgCount: number; bgColor: string; bgImage: string | null; images: { url: string; isVideo: boolean }[]; facing: 'camera' | 'surface'
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
        dotCount={30000} transitionKey={0} enableDissolve={false}
      />
      <SelfVertexImages scene={cloned} stream={stream} count={imgCount} size={imgSize} images={images} facing={facing} />
    </group>
  )
}

export function SelfCanvas({ stream, figureScale = 200, figureFacing = 4.65, imgSize = 0.1, imgCount = 60, bgColor = '#0a0a0a', bgImage = null, images = [], facing = 'camera' }: {
  stream: MediaStream; figureScale?: number; figureFacing?: number; imgSize?: number; imgCount?: number; bgColor?: string; bgImage?: string | null; images?: { url: string; isVideo: boolean }[]; facing?: 'camera' | 'surface'
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: bgColor }}
    >
      <PerspectiveCamera makeDefault position={[0, 150, 600]} fov={55} near={0.1} far={5000} />
      <OrbitControls target={[0, 150, 0]} enableDamping dampingFactor={0.08} />
      <Suspense fallback={null}>
        <SelfScene stream={stream} figureScale={figureScale} figureFacing={figureFacing} imgSize={imgSize} imgCount={imgCount} bgColor={bgColor} bgImage={bgImage} images={images} facing={facing} />
      </Suspense>
    </Canvas>
  )
}

// ── Orbiting figure pair (original + mirror) ──────────────────────────────────
type FigurePairProps = {
  roomDepth: number; radius: number; speed: number
  x: number; y: number; z: number
  figureScale: number; figureFacing: number; figureWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  posts: Post[]; mirrorPosts: Post[]; showVertexImages: boolean; vertexImgSize: number; vertexRepeat: number
  orbiting: boolean
  meshTexture: string | null
  texScale: number; texOffsetX: number; texOffsetY: number; texRotation: number
  transitionKey: number; enableDissolve: boolean
  figureRingsOrig: boolean; figureRingsMirror: boolean
  soloReact: boolean
  graffitiOrig: boolean; graffitiMirror: boolean
  graffitiMode: boolean; graffitiColor: string; graffitiBrushSize: number; graffitiClearKey: number
  analyserRef?: React.RefObject<AnalyserNode | null>
}
function FigurePair({ roomDepth, radius, speed, x, y, z, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, posts, mirrorPosts, showVertexImages, vertexImgSize, vertexRepeat, orbiting, meshTexture, texScale, texOffsetX, texOffsetY, texRotation, transitionKey, enableDissolve, figureRingsOrig, figureRingsMirror, soloReact, graffitiOrig, graffitiMirror, graffitiMode, graffitiColor, graffitiBrushSize, graffitiClearKey, analyserRef }: FigurePairProps) {
  const { scene } = useGLTF('/figure.glb')

  const cloneWithMats = (s: THREE.Object3D) => {
    const c = s.clone(true)
    c.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.material = Array.isArray(m.material) ? m.material.map(mt => mt.clone()) : (m.material as THREE.Material).clone()
    })
    return c
  }

  const orig   = useMemo(() => cloneWithMats(scene), [scene])
  const mirror = useMemo(() => cloneWithMats(scene), [scene])

  const [activeReact, setActiveReact] = useState(0)
  const soloTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (soloTimerRef.current) clearTimeout(soloTimerRef.current)
    if (!soloReact) return
    const schedule = () => {
      const delay = (1 + Math.random() * 3) * 1000
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
      ;[orig, mirror].forEach((root, ri) => {
        getMeshes(root).forEach(m => {
          if ((m.material as THREE.Material).type === 'MeshBasicMaterial') {
            ;(m.material as THREE.MeshBasicMaterial).map?.dispose()
            ;(m.material as THREE.Material).dispose()
            // Re-clone from scene
            const srcMeshes = getMeshes(ri === 0 ? scene : scene)
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
  }, [meshTexture, orig, mirror, scene])

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
            {figureWireframe && !figureRingsOrig && <FigureWireframe scene={orig} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={transitionKey} enableDissolve={enableDissolve} />}
            {figureRingsOrig && <FigureRings scene={orig} analyserRef={origAnalyser} />}
            {showVertexImages && posts.length > 0 && (
              <Suspense fallback={null}>
                <FigureVertexImages scene={orig} posts={posts} size={vertexImgSize} repeat={vertexRepeat} analyserRef={origAnalyser} />
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
              {figureWireframe && !figureRingsMirror && <FigureWireframe scene={mirror} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={transitionKey} enableDissolve={enableDissolve} />}
              {figureRingsMirror && <FigureRings scene={mirror} analyserRef={mirrorAnalyser} />}
              {showVertexImages && mirrorPosts.length > 0 && (
                <Suspense fallback={null}>
                  <FigureVertexImages scene={mirror} posts={mirrorPosts} size={vertexImgSize} repeat={vertexRepeat} analyserRef={mirrorAnalyser} />
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
  showVertexImages: boolean; vertexImgSize: number; vertexRepeat: number
  figureStudent: string | null; figureStudent2: string | null
  figureOrbiting: boolean
  camX: number; camY: number; camZ: number
  roomCameraMode: RoomCameraMode; roomCamFov: number; roomCamZoom: number; roomCamXLoop: boolean; roomCamXLoopSpeed: number
  showWalls: boolean
  meshTexture: string | null
  texScale: number; texOffsetX: number; texOffsetY: number; texRotation: number
  transitionKey: number; enableDissolve: boolean
  figureRings: boolean; soloReact: boolean
  graffitiMode: boolean; graffitiColor: string; graffitiBrushSize: number; graffitiClearKey: number
  bgColor: string; bgImage: string | null
  analyserRef?: React.RefObject<AnalyserNode | null>
}
function RoomScene({ posts, showDoggo, doggoScale, doggoX, doggoY, doggoZ, showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, showVertexImages, vertexImgSize, vertexRepeat, figureStudent, figureStudent2, figureOrbiting, camX, camY, camZ, roomCameraMode, roomCamFov, roomCamZoom, roomCamXLoop, roomCamXLoopSpeed, showWalls, meshTexture, texScale, texOffsetX, texOffsetY, texRotation, transitionKey, enableDissolve, figureRings, soloReact, graffitiMode, graffitiColor, graffitiBrushSize, graffitiClearKey, bgColor, bgImage, analyserRef }: RoomSceneProps) {
  const match = (a: string | null | undefined, b: string | null) =>
    a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const figurePosts  = figureStudent  ? posts.filter(p => match(p.student_name, figureStudent))  : posts
  const mirrorPosts  = figureStudent2 ? posts.filter(p => match(p.student_name, figureStudent2)) : posts
  const isSergi  = (s: string | null) => !!s?.trim().toLowerCase().includes('sergi')
  const isSesili = (s: string | null) => !!s?.trim().toLowerCase().includes('sesili')
  const figureRingsOrig   = figureRings && isSergi(figureStudent)
  const figureRingsMirror = figureRings && isSergi(figureStudent2)
  const graffitiOrig   = isSesili(figureStudent)
  const graffitiMirror = isSesili(figureStudent2)

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
      {showWalls && (<>
        {/* Back wall */}
        <mesh position={[0, H / 2, -D]}>
          <planeGeometry args={[W, H]} /><meshBasicMaterial color="#dddddd" />
        </mesh>
        {/* Left wall */}
        <mesh position={[-W / 2, H / 2, -D / 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[D, H]} /><meshBasicMaterial color="#d2d2d2" />
        </mesh>
        {/* Right wall */}
        <mesh position={[W / 2, H / 2, -D / 2]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[D, H]} /><meshBasicMaterial color="#d2d2d2" />
        </mesh>
        {/* Floor */}
        <mesh position={[0, 0, -D / 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, D]} /><meshBasicMaterial color="#ffffff" />
        </mesh>
        {/* Ceiling */}
        <mesh position={[0, H, -D / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, D]} /><meshBasicMaterial color="#f1f1f1" />
        </mesh>
      </>)}

      {showDoggo && (
        <Suspense fallback={null}>
          <Doggo roomDepth={D} scale={doggoScale} x={doggoX} y={doggoY} z={doggoZ} />
        </Suspense>
      )}

      {showFigure && (
        <Suspense fallback={null}>
          <FigurePair roomDepth={D} radius={figureRadius} speed={figureSpeed} x={figureX} y={figureY} z={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} posts={figurePosts} mirrorPosts={mirrorPosts} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat} orbiting={figureOrbiting} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} enableDissolve={enableDissolve} figureRingsOrig={figureRingsOrig} figureRingsMirror={figureRingsMirror} soloReact={soloReact} graffitiOrig={graffitiOrig} graffitiMirror={graffitiMirror} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} analyserRef={analyserRef} />
        </Suspense>
      )}

    </>
  )
}

// ── Entry point — pre-loads image dimensions before mounting scene ─────────────
export default function RoomCanvas({ posts, showDoggo = true, doggoScale = 1, doggoX = 0, doggoY = 0, doggoZ = 0, showFigure = true, figureRadius = 5, figureSpeed = 0.5, figureX = 0, figureY = 0, figureZ = 0, figureScale = 1, figureFacing = 0, figureWireframe = true, wireframeStyle = 'edges', dotSize = 0.200, dotColor = '#000000', dotCount = 30000, showVertexImages = false, vertexImgSize = 0.05, vertexRepeat = 1, figureStudent = null, figureStudent2 = null, figureOrbiting = true, camX = 0, camY = EYE, camZ = 55, roomCameraMode = 'freeroam' as RoomCameraMode, roomCamFov = 72, roomCamZoom = 1, roomCamXLoop = false, roomCamXLoopSpeed = 1, showWalls = false, meshTexture = null, texScale = 1, texOffsetX = 0, texOffsetY = 0, texRotation = 0, transitionKey = 0, enableDissolve = false, figureRings = false, soloReact = false, graffitiMode = false, graffitiColor = '#ff2222', graffitiBrushSize = 8, graffitiClearKey = 0, enableBloom = false, bloomIntensity = 1.5, enableDOF = false, dofFocus = 0.01, dofBokeh = 3, bgColor = '#ffffff', bgImage = null, analyserRef }: { posts: Post[]; showDoggo?: boolean; doggoScale?: number; doggoX?: number; doggoY?: number; doggoZ?: number; showFigure?: boolean; figureRadius?: number; figureSpeed?: number; figureX?: number; figureY?: number; figureZ?: number; figureScale?: number; figureFacing?: number; figureWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number; showVertexImages?: boolean; vertexImgSize?: number; vertexRepeat?: number; figureStudent?: string | null; figureStudent2?: string | null; figureOrbiting?: boolean; camX?: number; camY?: number; camZ?: number; roomCameraMode?: RoomCameraMode; roomCamFov?: number; roomCamZoom?: number; roomCamXLoop?: boolean; roomCamXLoopSpeed?: number; showWalls?: boolean; meshTexture?: string | null; texScale?: number; texOffsetX?: number; texOffsetY?: number; texRotation?: number; transitionKey?: number; enableDissolve?: boolean; figureRings?: boolean; soloReact?: boolean; graffitiMode?: boolean; graffitiColor?: string; graffitiBrushSize?: number; graffitiClearKey?: number; enableBloom?: boolean; bloomIntensity?: number; enableDOF?: boolean; dofFocus?: number; dofBokeh?: number; bgColor?: string; bgImage?: string | null; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  return (
    <Canvas
      camera={{ position: [camX, camY, camZ], fov: 72 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: bgColor }}
    >
      <RoomScene posts={posts} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} roomCameraMode={roomCameraMode} roomCamFov={roomCamFov} roomCamZoom={roomCamZoom} roomCamXLoop={roomCamXLoop} roomCamXLoopSpeed={roomCamXLoopSpeed} showWalls={showWalls} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} enableDissolve={enableDissolve} figureRings={figureRings} soloReact={soloReact} graffitiMode={graffitiMode} graffitiColor={graffitiColor} graffitiBrushSize={graffitiBrushSize} graffitiClearKey={graffitiClearKey} bgColor={bgColor} bgImage={bgImage} analyserRef={analyserRef} />
      {(enableBloom || enableDOF) && (
        <EffectComposer>
          {enableBloom ? <Bloom intensity={bloomIntensity} luminanceThreshold={0.2} luminanceSmoothing={0.9} /> : <></>}
          {enableDOF   ? <DepthOfField focusDistance={dofFocus} focalLength={0.02} bokehScale={dofBokeh} /> : <></>}
        </EffectComposer>
      )}
    </Canvas>
  )
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

function CircleFigure({ angle, radius, figureScale, figureY, posts, showVertexImages, vertexImgSize, vertexRepeat, showWireframe, wireframeStyle, dotSize, dotColor, dotCount, meshTexture, texScale, texRepeat, texOffsetX, texOffsetY, texRotation, student, onTextureUpload, analyserRef }: {
  angle: number; radius: number; figureScale: number; figureY: number
  posts: Post[]; showVertexImages: boolean; vertexImgSize: number; vertexRepeat: number
  showWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  meshTexture: string | null
  texScale: number; texRepeat: number; texOffsetX: number; texOffsetY: number; texRotation: number
  student: string; onTextureUpload: (student: string, url: string | null) => void
  analyserRef?: React.RefObject<AnalyserNode | null>
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

  const rotY = 4.65 + angle + Math.PI

  return (
    <group position={[radius * Math.sin(angle), figureY, radius * Math.cos(angle)]} scale={figureScale} rotation={[0, rotY, 0]} frustumCulled={false}>
      <primitive object={cloned} frustumCulled={false} />
      {showWireframe && (
        <FigureWireframe scene={cloned} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={0} enableDissolve={false} />
      )}
      {showVertexImages && posts.length > 0 && (
        <Suspense fallback={null}>
          <FigureVertexImages scene={cloned} posts={posts} size={vertexImgSize} repeat={vertexRepeat} analyserRef={analyserRef} />
        </Suspense>
      )}
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
    </group>
  )
}

type CircleCameraMode = 'perspective' | 'orthographic' | 'panoramic'

type TextureMapping = { scale: number; repeat: number; offsetX: number; offsetY: number; rotation: number }
const DEFAULT_MAPPING: TextureMapping = { scale: 1, repeat: 1, offsetX: 0, offsetY: 0, rotation: 0 }

function CircleScene({ posts, students, circleRadius, figureScale, figureY, showVertexImages, vertexImgSize, vertexRepeat, showWireframe, wireframeStyle, dotSize, dotColor, dotCount, studentTextures, studentTextureMappings, onTextureUpload, showNoiseGlobe, noiseColor1, noiseColor2, noiseSpeed, noiseScale, audioVolume, cameraMode, camX, camY, camZ, camFov, camZoom, camXLoop, camXLoopSpeed, bgColor, bgImage, analyserRef }: {
  posts: Post[]; students: string[]; circleRadius: number; figureScale: number; figureY: number
  showVertexImages: boolean; vertexImgSize: number; vertexRepeat: number
  showWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  studentTextures: Record<string, string | null>
  studentTextureMappings: Record<string, TextureMapping>
  onTextureUpload: (student: string, url: string | null) => void
  showNoiseGlobe: boolean; noiseColor1: string; noiseColor2: string; noiseSpeed: number; noiseScale: number; audioVolume: number
  cameraMode: CircleCameraMode; camX: number; camY: number; camZ: number; camFov: number; camZoom: number
  camXLoop: boolean; camXLoopSpeed: number
  bgColor: string; bgImage: string | null
  analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  return (
    <>
      <BackgroundSetter color={bgColor} image={bgImage} />
      {cameraMode === 'orthographic'
        ? <OrthographicCamera makeDefault position={[camX, camY, camZ]} zoom={camZoom} near={-10000} far={10000} />
        : <PerspectiveCamera makeDefault position={[camX, camY, camZ]} fov={camFov} near={0.1} far={10000} />
      }
      <OrbitControls target={[0, 150, 0]} enableDamping dampingFactor={0.08} autoRotate={camXLoop} autoRotateSpeed={camXLoopSpeed} />
      {showNoiseGlobe && analyserRef && (
        <group scale={circleRadius * 0.6}>
          <NoiseGlobe audioVolume={audioVolume} analyserRef={analyserRef} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} />
        </group>
      )}
      {students.map((student, i) => {
        const angle = (i / students.length) * Math.PI * 2
        const studentPosts = posts.filter(p => p.student_name?.trim().toLowerCase() === student.trim().toLowerCase())
        return (
          <CircleFigure
            key={student}
            angle={angle}
            radius={circleRadius}
            figureScale={figureScale}
            figureY={figureY}
            posts={studentPosts}
            showVertexImages={showVertexImages}
            vertexImgSize={vertexImgSize}
            vertexRepeat={vertexRepeat}
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
            analyserRef={analyserRef}
          />
        )
      })}
    </>
  )
}

export type { CircleCameraMode, TextureMapping }

export function CircleCanvas({ posts, students, circleRadius = 300, figureScale = 200, figureY = -10, showVertexImages = true, vertexImgSize = 0.025, vertexRepeat = 1, showWireframe = true, wireframeStyle = 'points' as WireframeStyle, dotSize = 0.800, dotColor = '#000000', dotCount = 30000, studentTextures = {}, studentTextureMappings = {}, onTextureUpload = () => {}, showNoiseGlobe = false, noiseColor1 = '#08003a', noiseColor2 = '#8c1aff', noiseSpeed = 0.5, noiseScale = 1.0, audioVolume = 0, cameraMode = 'orthographic' as CircleCameraMode, camX = 150, camY = 930, camZ = -1350, camFov = 60, camZoom = 1.8, camXLoop = false, camXLoopSpeed = 1.0, bgColor = '#ffffff', bgImage = null, analyserRef }: {
  posts: Post[]; students: string[]
  circleRadius?: number; figureScale?: number; figureY?: number
  showVertexImages?: boolean; vertexImgSize?: number; vertexRepeat?: number
  showWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number
  studentTextures?: Record<string, string | null>
  studentTextureMappings?: Record<string, TextureMapping>
  onTextureUpload?: (student: string, url: string | null) => void
  showNoiseGlobe?: boolean; noiseColor1?: string; noiseColor2?: string; noiseSpeed?: number; noiseScale?: number; audioVolume?: number
  cameraMode?: CircleCameraMode; camX?: number; camY?: number; camZ?: number; camFov?: number; camZoom?: number
  camXLoop?: boolean; camXLoopSpeed?: number
  bgColor?: string; bgImage?: string | null
  analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: bgColor }}
    >
      <CircleScene
        posts={posts} students={students} circleRadius={circleRadius} figureScale={figureScale} figureY={figureY}
        showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat}
        showWireframe={showWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount}
        studentTextures={studentTextures}
        studentTextureMappings={studentTextureMappings}
        onTextureUpload={onTextureUpload}
        showNoiseGlobe={showNoiseGlobe} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} audioVolume={audioVolume}
        cameraMode={cameraMode} camX={camX} camY={camY} camZ={camZ} camFov={camFov} camZoom={camZoom}
        camXLoop={camXLoop} camXLoopSpeed={camXLoopSpeed}
        bgColor={bgColor} bgImage={bgImage}
        analyserRef={analyserRef}
      />
    </Canvas>
  )
}
