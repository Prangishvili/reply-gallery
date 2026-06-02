'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'

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

function FigureVertexImages({ scene, posts, size }: { scene: THREE.Object3D; posts: Post[]; size: number }) {
  const vertices = useMemo(() => posts.length > 0 ? sampleVertices(scene, posts.length) : [], [scene, posts.length])
  const urls = useMemo(
    () => vertices.length > 0
      ? vertices.map((_, i) => posts[i % posts.length].image_url)
      : [posts[0].image_url],
    [vertices, posts]
  )
  const textures = useTexture(urls)
  const texArr = Array.isArray(textures) ? textures : [textures]

  return vertices.length === 0 ? null : (
    <>
      {vertices.map((v, i) => (
        <sprite key={i} position={[v.x, v.y, v.z]} scale={size}>
          <spriteMaterial map={texArr[i]} sizeAttenuation />
        </sprite>
      ))}
    </>
  )
}

// ── Wireframe styles ──────────────────────────────────────────────────────────
export type WireframeStyle = 'edges' | 'dense' | 'dashed' | 'points'

function FigureWireframe({ scene, style, dotSize, dotColor, dotCount }: { scene: THREE.Object3D; style: WireframeStyle; dotSize: number; dotColor: string; dotCount: number }) {
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
  useEffect(() => { dashedRef.current?.computeLineDistances() }, [geo])
  useEffect(() => () => { geo.dispose() }, [geo])
  useEffect(() => {
    if (!pointsMatRef.current) return
    pointsMatRef.current.size = dotSize
    pointsMatRef.current.color.set(dotColor)
    pointsMatRef.current.needsUpdate = true
  }, [dotSize, dotColor])

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
  posts: Post[]; mirrorPosts: Post[]; showVertexImages: boolean; vertexImgSize: number
  orbiting: boolean
}
function FigurePair({ roomDepth, radius, speed, x, y, z, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, posts, mirrorPosts, showVertexImages, vertexImgSize, orbiting }: FigurePairProps) {
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

  useEffect(() => {
    ;[orig, mirror].forEach(s => s.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material as THREE.Material]
      mats.forEach((mt: THREE.Material) => { mt.visible = !figureWireframe })
    }))
  }, [orig, mirror, figureWireframe])

  useFrame((_, delta) => {
    if (groupRef.current && orbiting) groupRef.current.rotation.y += speed * delta
  })

  return (
    <group ref={groupRef} position={[x, y, -(roomDepth / 2) + z]}>
      <group position={orbiting ? [radius, 0, 0] : [0, 0, 0]} scale={figureScale} rotation={[0, figureFacing, 0]}>
        <primitive object={orig} />
        {figureWireframe && <FigureWireframe scene={orig} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} />}
        {showVertexImages && posts.length > 0 && (
          <Suspense fallback={null}>
            <FigureVertexImages scene={orig} posts={posts} size={vertexImgSize} />
          </Suspense>
        )}
      </group>
      {orbiting && (
        <group position={[-radius, 0, 0]} scale={[-figureScale, figureScale, figureScale]} rotation={[0, -figureFacing, 0]}>
          <primitive object={mirror} />
          {figureWireframe && <FigureWireframe scene={mirror} style={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} />}
          {showVertexImages && mirrorPosts.length > 0 && (
            <Suspense fallback={null}>
              <FigureVertexImages scene={mirror} posts={mirrorPosts} size={vertexImgSize} />
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
  showVertexImages: boolean; vertexImgSize: number
  figureStudent: string | null; figureStudent2: string | null
  figureOrbiting: boolean
  camX: number; camY: number; camZ: number
  showWalls: boolean
}
function RoomScene({ posts, showDoggo, doggoScale, doggoX, doggoY, doggoZ, showFigure, figureRadius, figureSpeed, figureX, figureY, figureZ, figureScale, figureFacing, figureWireframe, wireframeStyle, dotSize, dotColor, dotCount, showVertexImages, vertexImgSize, figureStudent, figureStudent2, figureOrbiting, camX, camY, camZ, showWalls }: RoomSceneProps) {
  const figurePosts  = figureStudent  ? posts.filter(p => p.student_name === figureStudent)  : posts
  const mirrorPosts  = figureStudent2 ? posts.filter(p => p.student_name === figureStudent2) : posts

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
          <FigurePair roomDepth={D} radius={figureRadius} speed={figureSpeed} x={figureX} y={figureY} z={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} posts={figurePosts} mirrorPosts={mirrorPosts} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} orbiting={figureOrbiting} />
        </Suspense>
      )}

    </>
  )
}

// ── Entry point — pre-loads image dimensions before mounting scene ─────────────
export default function RoomCanvas({ posts, showDoggo = true, doggoScale = 1, doggoX = 0, doggoY = 0, doggoZ = 0, showFigure = true, figureRadius = 5, figureSpeed = 0.5, figureX = 0, figureY = 0, figureZ = 0, figureScale = 1, figureFacing = 0, figureWireframe = false, wireframeStyle = 'edges', dotSize = 0.100, dotColor = '#000000', dotCount = 30000, showVertexImages = false, vertexImgSize = 0.05, figureStudent = null, figureStudent2 = null, figureOrbiting = true, camX = 0, camY = EYE, camZ = 55, showWalls = false }: { posts: Post[]; showDoggo?: boolean; doggoScale?: number; doggoX?: number; doggoY?: number; doggoZ?: number; showFigure?: boolean; figureRadius?: number; figureSpeed?: number; figureX?: number; figureY?: number; figureZ?: number; figureScale?: number; figureFacing?: number; figureWireframe?: boolean; wireframeStyle?: WireframeStyle; dotSize?: number; dotColor?: string; dotCount?: number; showVertexImages?: boolean; vertexImgSize?: number; figureStudent?: string | null; figureStudent2?: string | null; figureOrbiting?: boolean; camX?: number; camY?: number; camZ?: number; showWalls?: boolean }) {
  return (
    <Canvas
      camera={{ position: [camX, camY, camZ], fov: 72 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: '#ffffff' }}
    >
      <RoomScene posts={posts} showDoggo={showDoggo} doggoScale={doggoScale} doggoX={doggoX} doggoY={doggoY} doggoZ={doggoZ} showFigure={showFigure} figureRadius={figureRadius} figureSpeed={figureSpeed} figureX={figureX} figureY={figureY} figureZ={figureZ} figureScale={figureScale} figureFacing={figureFacing} figureWireframe={figureWireframe} wireframeStyle={wireframeStyle} dotSize={dotSize} dotColor={dotColor} dotCount={dotCount} showVertexImages={showVertexImages} vertexImgSize={vertexImgSize} figureStudent={figureStudent} figureStudent2={figureStudent2} figureOrbiting={figureOrbiting} camX={camX} camY={camY} camZ={camZ} showWalls={showWalls} />
    </Canvas>
  )
}
