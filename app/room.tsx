'use client'

import React from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, useGLTF, OrbitControls, Html, PerspectiveCamera, OrthographicCamera } from '@react-three/drei'
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'
import { NoiseGlobe } from './globe'

// ── Constants ─────────────────────────────────────────────────────────────────
const W   = 480   // room width = depth (square)
const H   = 400   // room height
const D   = W     // square floor plan
const EYE = 22.5  // camera eye height

// ── Free-roam controls ────────────────────────────────────────────────────────
function RoomControls({ camX, camY, camZ }: { camX: number; camY: number; camZ: number }) {
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
      down.current = true; vel.current = { yaw: 0, pitch: 0 }
      last.current = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!down.current) return
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
  }, [gl])

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

function FigureVertexImages({ scene, posts, size, repeat, analyserRef }: { scene: THREE.Object3D; posts: Post[]; size: number; repeat: number; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  const repeatedPosts = useMemo(() => {
    const arr: Post[] = []
    for (let i = 0; i < Math.max(1, repeat); i++) arr.push(...posts)
    return arr
  }, [posts, repeat])
  const vertices = useMemo(() => repeatedPosts.length > 0 ? sampleVertices(scene, repeatedPosts.length) : [], [scene, repeatedPosts.length])
  const urls = useMemo(
    () => vertices.length > 0
      ? vertices.map((_, i) => repeatedPosts[i % repeatedPosts.length].image_url)
      : [posts[0].image_url],
    [vertices, repeatedPosts, posts]
  )
  const textures = useTexture(urls)
  const texArr = Array.isArray(textures) ? textures : [textures]
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const dataArrRef = useRef<Uint8Array | null>(null)

  useFrame(() => {
    const sprites = spriteRefs.current
    if (!sprites.length) return
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
    sprites.forEach((sprite, i) => {
      if (!sprite) return
      const tex = texArr[i % texArr.length]
      const img = tex.image as { width?: number; height?: number } | null
      const aspect = img?.width && img?.height ? img.width / img.height : 1
      const s = size * (1 + vol * 3)
      sprite.scale.set(s * aspect, s, 1)
    })
  })

  return vertices.length === 0 ? null : (
    <>
      {vertices.map((v, i) => {
        const tex = texArr[i % texArr.length]
        const img2 = tex.image as { width?: number; height?: number } | null
        const aspect = img2?.width && img2?.height ? img2.width / img2.height : 1
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
  analyserRef?: React.RefObject<AnalyserNode | null>
}
function FigurePair({ roomDepth, radius, speed, x, y, z, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, posts, mirrorPosts, showVertexImages, vertexImgSize, vertexRepeat, orbiting, meshTexture, texScale, texOffsetX, texOffsetY, texRotation, transitionKey, enableDissolve, analyserRef }: FigurePairProps) {
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
  const groupRef = useRef<THREE.Group>(null)
  const loadedTexRef = useRef<THREE.Texture | null>(null)

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
          m.material = new THREE.MeshBasicMaterial({ map: tex })
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
        <primitive object={orig} />
        {figureWireframe && <FigureWireframe scene={orig} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={transitionKey} enableDissolve={enableDissolve} />}
        {showVertexImages && posts.length > 0 && (
          <Suspense fallback={null}>
            <FigureVertexImages scene={orig} posts={posts} size={vertexImgSize} repeat={vertexRepeat} analyserRef={analyserRef} />
          </Suspense>
        )}
      </group>
      {orbiting && (
        <group position={[-radius, 0, 0]} scale={[-figureScale, figureScale, figureScale]} rotation={[0, -figureFacing, 0]}>
          <primitive object={mirror} />
          {figureWireframe && <FigureWireframe scene={mirror} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} transitionKey={transitionKey} enableDissolve={enableDissolve} />}
          {showVertexImages && mirrorPosts.length > 0 && (
            <Suspense fallback={null}>
              <FigureVertexImages scene={mirror} posts={mirrorPosts} size={vertexImgSize} repeat={vertexRepeat} analyserRef={analyserRef} />
            </Suspense>
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
  showWalls: boolean
  meshTexture: string | null
  texScale: number; texOffsetX: number; texOffsetY: number; texRotation: number
  transitionKey: number; enableDissolve: boolean
  analyserRef?: React.RefObject<AnalyserNode | null>
}
function RoomScene({ posts, showDoggo, doggoScale, doggoX, doggoY, doggoZ, showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, showVertexImages, vertexImgSize, vertexRepeat, figureStudent, figureStudent2, figureOrbiting, camX, camY, camZ, showWalls, meshTexture, texScale, texOffsetX, texOffsetY, texRotation, transitionKey, enableDissolve, analyserRef }: RoomSceneProps) {
  const match = (a: string | null | undefined, b: string | null) =>
    a != null && b != null && a.trim().toLowerCase() === b.trim().toLowerCase()
  const figurePosts  = figureStudent  ? posts.filter(p => match(p.student_name, figureStudent))  : posts
  const mirrorPosts  = figureStudent2 ? posts.filter(p => match(p.student_name, figureStudent2)) : posts

  return (
    <>
      <RoomControls camX={camX} camY={camY} camZ={camZ} />
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
          <FigurePair roomDepth={D} radius={figureRadius} speed={figureSpeed} x={figureX} y={figureY} z={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} posts={figurePosts} mirrorPosts={mirrorPosts} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat} orbiting={figureOrbiting} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} enableDissolve={enableDissolve} analyserRef={analyserRef} />
        </Suspense>
      )}

    </>
  )
}

// ── Entry point — pre-loads image dimensions before mounting scene ─────────────
export default function RoomCanvas({ posts, showDoggo = true, doggoScale = 1, doggoX = 0, doggoY = 0, doggoZ = 0, showFigure = true, figureRadius = 5, figureSpeed = 0.5, figureX = 0, figureY = 0, figureZ = 0, figureScale = 1, figureFacing = 0, figureWireframe = true, wireframeStyle = 'edges', dotSize = 0.200, dotColor = '#000000', dotCount = 30000, showVertexImages = false, vertexImgSize = 0.05, vertexRepeat = 1, figureStudent = null, figureStudent2 = null, figureOrbiting = true, camX = 0, camY = EYE, camZ = 55, showWalls = false, meshTexture = null, texScale = 1, texOffsetX = 0, texOffsetY = 0, texRotation = 0, transitionKey = 0, enableDissolve = false, enableBloom = false, bloomIntensity = 1.5, enableDOF = false, dofFocus = 0.01, dofBokeh = 3, analyserRef }: { posts: Post[]; showDoggo?: boolean; doggoScale?: number; doggoX?: number; doggoY?: number; doggoZ?: number; showFigure?: boolean; figureRadius?: number; figureSpeed?: number; figureX?: number; figureY?: number; figureZ?: number; figureScale?: number; figureFacing?: number; figureWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number; showVertexImages?: boolean; vertexImgSize?: number; vertexRepeat?: number; figureStudent?: string | null; figureStudent2?: string | null; figureOrbiting?: boolean; camX?: number; camY?: number; camZ?: number; showWalls?: boolean; meshTexture?: string | null; texScale?: number; texOffsetX?: number; texOffsetY?: number; texRotation?: number; transitionKey?: number; enableDissolve?: boolean; enableBloom?: boolean; bloomIntensity?: number; enableDOF?: boolean; dofFocus?: number; dofBokeh?: number; analyserRef?: React.RefObject<AnalyserNode | null> }) {
  return (
    <Canvas
      camera={{ position: [camX, camY, camZ], fov: 72 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: '#ffffff' }}
    >
      <RoomScene posts={posts} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} showWalls={showWalls} meshTexture={meshTexture} texScale={texScale} texOffsetX={texOffsetX} texOffsetY={texOffsetY} texRotation={texRotation} transitionKey={transitionKey} enableDissolve={enableDissolve} analyserRef={analyserRef} />
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

function CircleFigure({ angle, radius, figureScale, figureY, posts, showVertexImages, vertexImgSize, vertexRepeat, showWireframe, wireframeStyle, dotSize, dotColor, dotCount, meshTexture, student, onTextureUpload, analyserRef }: {
  angle: number; radius: number; figureScale: number; figureY: number
  posts: Post[]; showVertexImages: boolean; vertexImgSize: number; vertexRepeat: number
  showWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  meshTexture: string | null
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
        m.material = new THREE.MeshBasicMaterial({ map: tex })
      })
    })
    return () => { cancelled = true }
  }, [meshTexture, cloned, raw])

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

function CircleScene({ posts, students, circleRadius, figureScale, figureY, showVertexImages, vertexImgSize, vertexRepeat, showWireframe, wireframeStyle, dotSize, dotColor, dotCount, studentTextures, onTextureUpload, showNoiseGlobe, noiseColor1, noiseColor2, noiseSpeed, noiseScale, audioVolume, cameraMode, camX, camY, camZ, camFov, camZoom, camXLoop, camXLoopSpeed, analyserRef }: {
  posts: Post[]; students: string[]; circleRadius: number; figureScale: number; figureY: number
  showVertexImages: boolean; vertexImgSize: number; vertexRepeat: number
  showWireframe: boolean; wireframeStyle: WireframeStyle; dotSize: number; dotColor: string; dotCount: number
  studentTextures: Record<string, string | null>
  onTextureUpload: (student: string, url: string | null) => void
  showNoiseGlobe: boolean; noiseColor1: string; noiseColor2: string; noiseSpeed: number; noiseScale: number; audioVolume: number
  cameraMode: CircleCameraMode; camX: number; camY: number; camZ: number; camFov: number; camZoom: number
  camXLoop: boolean; camXLoopSpeed: number
  analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  return (
    <>
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
            student={student}
            onTextureUpload={onTextureUpload}
            analyserRef={analyserRef}
          />
        )
      })}
    </>
  )
}

export type { CircleCameraMode }

export function CircleCanvas({ posts, students, circleRadius = 300, figureScale = 200, figureY = -10, showVertexImages = true, vertexImgSize = 0.025, vertexRepeat = 1, showWireframe = true, wireframeStyle = 'points' as WireframeStyle, dotSize = 0.800, dotColor = '#000000', dotCount = 30000, studentTextures = {}, onTextureUpload = () => {}, showNoiseGlobe = false, noiseColor1 = '#08003a', noiseColor2 = '#8c1aff', noiseSpeed = 0.5, noiseScale = 1.0, audioVolume = 0, cameraMode = 'orthographic' as CircleCameraMode, camX = 150, camY = 930, camZ = -1350, camFov = 60, camZoom = 1.8, camXLoop = false, camXLoopSpeed = 1.0, analyserRef }: {
  posts: Post[]; students: string[]
  circleRadius?: number; figureScale?: number; figureY?: number
  showVertexImages?: boolean; vertexImgSize?: number; vertexRepeat?: number
  showWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number
  studentTextures?: Record<string, string | null>
  onTextureUpload?: (student: string, url: string | null) => void
  showNoiseGlobe?: boolean; noiseColor1?: string; noiseColor2?: string; noiseSpeed?: number; noiseScale?: number; audioVolume?: number
  cameraMode?: CircleCameraMode; camX?: number; camY?: number; camZ?: number; camFov?: number; camZoom?: number
  camXLoop?: boolean; camXLoopSpeed?: number
  analyserRef?: React.RefObject<AnalyserNode | null>
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: '#ffffff' }}
    >
      <CircleScene
        posts={posts} students={students} circleRadius={circleRadius} figureScale={figureScale} figureY={figureY}
        showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} vertexRepeat={vertexRepeat}
        showWireframe={showWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount}
        studentTextures={studentTextures}
        onTextureUpload={onTextureUpload}
        showNoiseGlobe={showNoiseGlobe} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} audioVolume={audioVolume}
        cameraMode={cameraMode} camX={camX} camY={camY} camZ={camZ} camFov={camFov} camZoom={camZoom}
        camXLoop={camXLoop} camXLoopSpeed={camXLoopSpeed}
        analyserRef={analyserRef}
      />
    </Canvas>
  )
}
