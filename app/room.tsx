'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'

// ── Constants ─────────────────────────────────────────────────────────────────
const W         = 20       // room width  (x: -10 … +10)
const H         = 9        // room height (y:   0 … +9)
const MIN_D     = 30       // minimum depth
const IMG_H     = 2.6      // fixed image height — width varies by aspect ratio
const IMG_GAP   = 0.45     // gap between images
const EYE       = 4.5      // camera eye height
const SIDE_Z_START = 5     // z where side-wall images begin

// ── Layout ────────────────────────────────────────────────────────────────────
type Dims = Record<string, { w: number; h: number }>
type Placement = {
  post: Post
  position: [number, number, number]
  rotation: [number, number, number]
  imgW: number
}

function computeLayout(posts: Post[], dims: Dims): { placements: Placement[]; D: number } {
  const widthOf = (p: Post) => {
    const d = dims[p.id]
    return d && d.h > 0 ? IMG_H * (d.w / d.h) : IMG_H
  }

  // How many fit in one row on the back wall?
  const maxBackW = W - 2
  let backPosts: Post[] = []
  let cumW = 0
  for (const post of posts) {
    const w = widthOf(post)
    const needed = backPosts.length > 0 ? w + IMG_GAP : w
    if (cumW + needed > maxBackW) break
    cumW += needed
    backPosts.push(post)
  }

  // Remaining images split across left / right walls, alternating
  const sidePosts = posts.slice(backPosts.length)
  const leftPosts  = sidePosts.filter((_, i) => i % 2 === 0)
  const rightPosts = sidePosts.filter((_, i) => i % 2 === 1)

  const cumulativeZ = (arr: Post[]) =>
    arr.reduce((acc, p, i) => acc + widthOf(p) + (i > 0 ? IMG_GAP : 0), 0)
  const neededSideZ = Math.max(cumulativeZ(leftPosts), cumulativeZ(rightPosts))
  const D = Math.max(MIN_D, SIDE_Z_START + neededSideZ + IMG_H + 4)

  const placements: Placement[] = []

  // Back wall — centred single row
  let x = -cumW / 2
  for (const post of backPosts) {
    const w = widthOf(post)
    placements.push({ post, imgW: w, position: [x + w / 2, EYE, -(D - 0.12)], rotation: [0, 0, 0] })
    x += w + IMG_GAP
  }

  // Left wall — single row along z
  let lz = SIDE_Z_START
  for (const post of leftPosts) {
    const w = widthOf(post)
    placements.push({ post, imgW: w, position: [-(W / 2 - 0.12), EYE, -(lz + w / 2)], rotation: [0, Math.PI / 2, 0] })
    lz += w + IMG_GAP
  }

  // Right wall — single row along z
  let rz = SIDE_Z_START
  for (const post of rightPosts) {
    const w = widthOf(post)
    placements.push({ post, imgW: w, position: [W / 2 - 0.12, EYE, -(rz + w / 2)], rotation: [0, -Math.PI / 2, 0] })
    rz += w + IMG_GAP
  }

  return { placements, D }
}

// ── First-person controls ─────────────────────────────────────────────────────
function RoomControls({ roomDepth }: { roomDepth: number }) {
  const { camera, gl } = useThree()
  const yaw   = useRef(0)
  const pitch = useRef(0)
  const posZ  = useRef(11)
  const vel   = useRef({ yaw: 0, pitch: 0 })
  const down  = useRef(false)
  const last  = useRef({ x: 0, y: 0 })

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
      pitch.current  = Math.max(-1.1, Math.min(1.1, pitch.current - dy))
      vel.current    = { yaw: -dx, pitch: -dy }
      last.current   = { x: e.clientX, y: e.clientY }
    }
    const onUp   = () => { down.current = false }
    const onWheel = (e: WheelEvent) => {
      posZ.current = Math.max(-(roomDepth - 4), Math.min(11, posZ.current - e.deltaY * 0.06))
    }
    c.addEventListener('pointerdown', onDown)
    c.addEventListener('pointermove', onMove)
    c.addEventListener('pointerup', onUp)
    c.addEventListener('pointercancel', onUp)
    c.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      c.removeEventListener('pointerdown', onDown)
      c.removeEventListener('pointermove', onMove)
      c.removeEventListener('pointerup', onUp)
      c.removeEventListener('pointercancel', onUp)
      c.removeEventListener('wheel', onWheel)
    }
  }, [gl, roomDepth])

  useFrame(() => {
    if (!down.current) {
      yaw.current   += vel.current.yaw
      pitch.current  = Math.max(-1.1, Math.min(1.1, pitch.current + vel.current.pitch))
      vel.current.yaw   *= 0.88
      vel.current.pitch *= 0.88
    }
    camera.position.set(0, EYE, posZ.current)
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
  })

  return null
}

// ── Image tile ────────────────────────────────────────────────────────────────
function Tile({ post, position, rotation, imgW }: Placement) {
  const texture = useTexture(post.image_url)
  texture.colorSpace = THREE.SRGBColorSpace
  const [hovered, setHovered] = useState(false)
  const mesh = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (!mesh.current) return
    const t = hovered ? 1.05 : 1
    mesh.current.scale.lerp(new THREE.Vector3(t, t, t), 0.1)
  })

  return (
    <group position={position} rotation={rotation}>
      {/* white frame */}
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[imgW + 0.2, IMG_H + 0.2]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* image */}
      <mesh ref={mesh}
        onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[imgW, IMG_H]} />
        <meshBasicMaterial map={texture} side={THREE.FrontSide} />
        {hovered && (
          <Html center position={[0, -IMG_H / 2 - 0.38, 0.05]} style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(0,0,0,0.78)', color: '#fff', fontFamily: 'monospace',
              fontSize: '10px', padding: '4px 9px', borderRadius: '5px',
              maxWidth: '140px', whiteSpace: 'normal', lineHeight: 1.45, textAlign: 'center',
            }}>{post.text}</div>
          </Html>
        )}
      </mesh>
    </group>
  )
}

// ── Room geometry ─────────────────────────────────────────────────────────────
function RoomScene({ posts, dims }: { posts: Post[]; dims: Dims }) {
  const { placements, D } = computeLayout(posts, dims)

  return (
    <>
      <RoomControls roomDepth={D} />
      <ambientLight intensity={2.4} />
      <pointLight position={[0, H - 0.5, -D * 0.5]} intensity={80} distance={D * 1.5} />
      <pointLight position={[0, H - 0.5, -4]}        intensity={30} distance={20} />

      {/* Back wall */}
      <mesh position={[0, H / 2, -D]}>
        <planeGeometry args={[W, H]} /><meshStandardMaterial color="#f7f6f1" />
      </mesh>
      {/* Left wall */}
      <mesh position={[-W / 2, H / 2, -D / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} /><meshStandardMaterial color="#f3f2ed" />
      </mesh>
      {/* Right wall */}
      <mesh position={[W / 2, H / 2, -D / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} /><meshStandardMaterial color="#f3f2ed" />
      </mesh>
      {/* Floor */}
      <mesh position={[0, 0, -D / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} /><meshStandardMaterial color="#e2ddd6" />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, H, -D / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} /><meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Ceiling light strip */}
      <mesh position={[0, H - 0.02, -D / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, D * 0.85]} />
        <meshBasicMaterial color="#fffde8" transparent opacity={0.55} />
      </mesh>

      {placements.map(p => (
        <Suspense key={p.post.id} fallback={null}>
          <Tile {...p} />
        </Suspense>
      ))}
    </>
  )
}

// ── Entry point — pre-loads image dimensions before mounting scene ─────────────
export default function RoomCanvas({ posts }: { posts: Post[] }) {
  const [dims, setDims] = useState<Dims | null>(null)

  useEffect(() => {
    setDims(null)
    if (posts.length === 0) { setDims({}); return }
    const result: Dims = {}
    let count = 0
    let cancelled = false
    posts.forEach(post => {
      const img = new window.Image()
      const done = () => {
        if (cancelled) return
        result[post.id] = img.naturalWidth && img.naturalHeight
          ? { w: img.naturalWidth, h: img.naturalHeight }
          : { w: 1, h: 1 }
        if (++count === posts.length) setDims({ ...result })
      }
      img.onload = done; img.onerror = done
      img.src = post.image_url
    })
    return () => { cancelled = true }
  }, [posts])

  if (!dims) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
      <span style={{ fontFamily: 'monospace', color: '#555', fontSize: 13 }}>loading room…</span>
    </div>
  )

  return (
    <Canvas
      camera={{ position: [0, EYE, 11], fov: 72 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', touchAction: 'none', background: '#0a0a0a' }}
    >
      <RoomScene posts={posts} dims={dims} />
    </Canvas>
  )
}
