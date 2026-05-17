'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useTexture, Html } from '@react-three/drei'
import { Suspense, useRef, useState } from 'react'
import * as THREE from 'three'
import { Post } from '@/lib/supabase'

const RADIUS = 3.2

function spherePoint(index: number, total: number): THREE.Vector3 {
  const phi = Math.acos(1 - (2 * (index + 0.5)) / total)
  const theta = Math.PI * (1 + Math.sqrt(5)) * index
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta)
  ).multiplyScalar(RADIUS)
}

function Tile({ post, index, total }: { post: Post; index: number; total: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const texture = useTexture(post.image_url)
  texture.colorSpace = THREE.SRGBColorSpace

  const pos = spherePoint(index, total)
  const normal = pos.clone().normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  )

  useFrame(() => {
    if (!mesh.current) return
    const target = hovered ? 1.2 : 1
    mesh.current.scale.lerp(new THREE.Vector3(target, target, target), 0.12)
  })

  return (
    <mesh
      ref={mesh}
      position={pos}
      quaternion={quaternion}
      onPointerOver={e => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <planeGeometry args={[0.85, 0.85]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      {hovered && (
        <Html
          center
          position={[0, -0.55, 0.05]}
          style={{ pointerEvents: 'none' }}
        >
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
            {post.text}
          </div>
        </Html>
      )}
    </mesh>
  )
}

function Scene({ posts, rotateSpeed, scale }: { posts: Post[]; rotateSpeed: number; scale: number }) {
  return (
    <>
      <OrbitControls
        autoRotate
        autoRotateSpeed={rotateSpeed}
        enableZoom
        enablePan={false}
        minDistance={4.5}
        maxDistance={12}
      />
      <group scale={scale}>
        {posts.map((post, i) => (
          <Suspense key={post.id} fallback={null}>
            <Tile post={post} index={i} total={posts.length} />
          </Suspense>
        ))}
      </group>
    </>
  )
}

export default function GlobeCanvas({ posts, rotateSpeed, scale }: { posts: Post[]; rotateSpeed: number; scale: number }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 7.5], fov: 50 }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene posts={posts} rotateSpeed={rotateSpeed} scale={scale} />
    </Canvas>
  )
}
