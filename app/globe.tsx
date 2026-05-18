'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useTexture, Html, Billboard } from '@react-three/drei'
import { Suspense, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'

const RADIUS = 3.2
const INNER_RADIUS = 1.6

const NAMES = [
  'Nodar Gogichaishvili', 'Sesili Gurgenidze', 'Dominika Davshrishovi', 'Nutsa Kavtelishvili',
  'Ketevan Lomiashvili', 'Ana Mamniashvili', 'Sergi Sarajevi', 'Natali Chixelidze',
  'Salome Shalvashvili', 'Bako Shengelaia', 'Mariam Wulaia', 'Mariam Qsovreli',
]

function spherePoint(index: number, total: number, radius = RADIUS): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (index + 0.5)) / total)
  const theta = Math.PI * (1 + Math.sqrt(5)) * index
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).multiplyScalar(radius)
}

function NameTag({ name, index, nameSize }: { name: string; index: number; nameSize: number }) {
  const pos = spherePoint(index, NAMES.length, INNER_RADIUS)
  return (
    <Html center position={pos.toArray() as [number, number, number]} style={{ pointerEvents: 'none' }}>
      <div style={{
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        fontSize: `${nameSize}px`,
        fontWeight: 500,
        letterSpacing: '0.08em',
        color: 'rgba(0,0,0,0.55)',
        whiteSpace: 'nowrap',
        textShadow: '0 0 12px rgba(255,255,255,0.9)',
      }}>
        {name}
      </div>
    </Html>
  )
}

function Caption({ text }: { text: string }) {
  return (
    <Html center position={[0, -0.55, 0.05]} style={{ pointerEvents: 'none' }}>
      <div style={{
        background: 'rgba(0,0,0,0.75)',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '4px 8px',
        borderRadius: '6px',
        maxWidth: '120px',
        whiteSpace: 'normal',
        lineHeight: '1.4',
        textAlign: 'center',
      }}>
        {text}
      </div>
    </Html>
  )
}

function TileBillboard({ post, index, total, tileSize }: { post: Post; index: number; total: number; tileSize: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const texture = useTexture(post.image_url)
  texture.colorSpace = THREE.SRGBColorSpace
  const pos = spherePoint(index, total, RADIUS)

  useFrame(() => {
    if (!mesh.current) return
    const target = hovered ? 1.2 : 1
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12)
  })

  return (
    <Billboard position={pos}>
      <mesh ref={mesh} onPointerOver={e => { e.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
        <planeGeometry args={[tileSize, tileSize]} />
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
        {hovered && <Caption text={post.text} />}
      </mesh>
    </Billboard>
  )
}

function TileOutward({ post, index, total, tileSize }: { post: Post; index: number; total: number; tileSize: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const texture = useTexture(post.image_url)
  texture.colorSpace = THREE.SRGBColorSpace
  const pos = spherePoint(index, total, RADIUS)
  const normal = pos.clone().normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)

  useFrame(() => {
    if (!mesh.current) return
    const target = hovered ? 1.2 : 1
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12)
  })

  return (
    <mesh ref={mesh} position={pos} quaternion={quaternion} onPointerOver={e => { e.stopPropagation(); setHovered(true) }} onPointerOut={() => setHovered(false)}>
      <planeGeometry args={[tileSize, tileSize]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      {hovered && <Caption text={post.text} />}
    </mesh>
  )
}

// Custom controls: rotates the globe group directly (no polar clamping), scroll to zoom, inertia on release
function GlobeControls({ groupRef, rotateSpeed }: { groupRef: React.RefObject<THREE.Group | null>; rotateSpeed: number }) {
  const { gl, camera } = useThree()
  const dragging = useRef(false)
  const lastPointer = useRef({ x: 0, y: 0 })
  const rotation = useRef({ x: 0, y: 0 })
  const velocity = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e: PointerEvent) => {
      dragging.current = true
      velocity.current = { x: 0, y: 0 }
      lastPointer.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current) return
      const dx = (e.clientX - lastPointer.current.x) * 0.006
      const dy = (e.clientY - lastPointer.current.y) * 0.006
      rotation.current.y += dx
      rotation.current.x += dy
      velocity.current = { x: dy, y: dx }
      lastPointer.current = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = () => { dragging.current = false }
    const onWheel = (e: WheelEvent) => {
      camera.position.z = Math.max(4.5, Math.min(12, camera.position.z + e.deltaY * 0.01))
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: true })

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [gl, camera])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (dragging.current) {
      // no auto-rotate while dragging
    } else {
      // apply inertia then decay
      rotation.current.x += velocity.current.x
      rotation.current.y += velocity.current.y
      velocity.current.x *= 0.92
      velocity.current.y *= 0.92
      // auto-rotate when velocity has settled
      if (Math.abs(velocity.current.y) < 0.0005) {
        rotation.current.y += rotateSpeed * delta * 0.3
      }
    }
    groupRef.current.rotation.x = rotation.current.x
    groupRef.current.rotation.y = rotation.current.y
  })

  return null
}

function Scene({ posts, rotateSpeed, scale, tileSize, tileStyle, showNames, nameSize }: {
  posts: Post[]
  rotateSpeed: number
  scale: number
  tileSize: number
  tileStyle: 'billboard' | 'outward'
  showNames: boolean
  nameSize: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const Tile = tileStyle === 'billboard' ? TileBillboard : TileOutward

  return (
    <>
      <GlobeControls groupRef={groupRef} rotateSpeed={rotateSpeed} />
      <group ref={groupRef} scale={scale}>
        {posts.map((post, i) => (
          <Suspense key={post.id} fallback={null}>
            <Tile post={post} index={i} total={posts.length} tileSize={tileSize} />
          </Suspense>
        ))}
        {showNames && NAMES.map((name, i) => (
          <NameTag key={name} name={name} index={i} nameSize={nameSize} />
        ))}
      </group>
    </>
  )
}

export default function GlobeCanvas({ posts, rotateSpeed, scale, tileSize, tileStyle, showNames, nameSize }: {
  posts: Post[]
  rotateSpeed: number
  scale: number
  tileSize: number
  tileStyle: 'billboard' | 'outward'
  showNames: boolean
  nameSize: number
}) {
  return (
    <Canvas camera={{ position: [0, 0, 7.5], fov: 50 }} dpr={[1, 2]} style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <Scene posts={posts} rotateSpeed={rotateSpeed} scale={scale} tileSize={tileSize} tileStyle={tileStyle} showNames={showNames} nameSize={nameSize} />
    </Canvas>
  )
}
