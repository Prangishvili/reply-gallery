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

function NameTag({ name, index, nameSize, blur, onClick, clickable }: { name: string; index: number; nameSize: number; blur: boolean; onClick: (name: string) => void; clickable: boolean }) {
  const pos = spherePoint(index, NAMES.length, INNER_RADIUS)
  const [hovered, setHovered] = useState(false)
  return (
    <Html center position={pos.toArray() as [number, number, number]} style={{ pointerEvents: clickable ? 'auto' : 'none' }}>
      <div
        onClick={clickable ? () => onClick(name) : undefined}
        onMouseEnter={clickable ? () => setHovered(true) : undefined}
        onMouseLeave={clickable ? () => setHovered(false) : undefined}
        style={{
          fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
          fontSize: `${nameSize}px`,
          fontWeight: 500,
          letterSpacing: '0.08em',
          color: hovered ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.55)',
          whiteSpace: 'nowrap',
          textShadow: '0 0 12px rgba(255,255,255,0.9)',
          filter: blur ? 'blur(6px)' : undefined,
          transition: 'filter 0.3s, color 0.15s',
          cursor: clickable ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
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

const noiseGlob = /* glsl */`
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.1 + vec3(31.41); a *= 0.5; }
    return v;
  }
`

const noiseVert = `
  uniform float time;
  uniform float volume;
  uniform float noiseScale;
  varying vec3 vNorm;
  ${noiseGlob}
  void main() {
    vNorm = normal;
    float n = fbm(normal * 2.0 * noiseScale + time * 0.3);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * n * volume * 0.6, 1.0);
  }
`

const noiseFrag = `
  uniform float time;
  uniform float volume;
  uniform float noiseScale;
  uniform vec3 color1;
  uniform vec3 color2;
  varying vec3 vNorm;
  ${noiseGlob}
  void main() {
    float n = fbm(vNorm * 3.5 * noiseScale + time * 0.2);
    vec3 col = mix(color1, color2, n);
    col = mix(col, vec3(1.0, 0.95, 1.0), n * n * volume * 1.4);
    float alpha = (0.35 + n * 0.5) * (0.15 + volume * 0.85);
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`

export function NoiseGlobe({ audioVolume, analyserRef, noiseColor1, noiseColor2, noiseSpeed, noiseScale }: {
  audioVolume: number
  analyserRef: { current: AnalyserNode | null }
  noiseColor1: string
  noiseColor2: string
  noiseSpeed: number
  noiseScale: number
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const dataArrRef = useRef<Uint8Array | null>(null)

  useFrame((_, delta) => {
    if (!matRef.current) return
    matRef.current.uniforms.time.value += delta * noiseSpeed
    matRef.current.uniforms.noiseScale.value = noiseScale
    matRef.current.uniforms.color1.value.set(noiseColor1)
    matRef.current.uniforms.color2.value.set(noiseColor2)

    let vol = audioVolume
    if (analyserRef.current) {
      const analyser = analyserRef.current
      if (!dataArrRef.current || dataArrRef.current.length !== analyser.frequencyBinCount) {
        dataArrRef.current = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(dataArrRef.current as Uint8Array<ArrayBuffer>)
      let sum = 0
      for (let i = 0; i < dataArrRef.current.length; i++) sum += dataArrRef.current[i]
      vol = Math.min((sum / dataArrRef.current.length / 255) * 5, 1)
    }
    matRef.current.uniforms.volume.value = vol
  })

  return (
    <mesh>
      <sphereGeometry args={[1.3, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={{
          time: { value: 0 },
          volume: { value: audioVolume },
          noiseScale: { value: noiseScale },
          color1: { value: new THREE.Color(noiseColor1) },
          color2: { value: new THREE.Color(noiseColor2) },
        }}
        vertexShader={noiseVert}
        fragmentShader={noiseFrag}
        transparent
        depthWrite={false}
      />
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

function Scene({ posts, rotateSpeed, scale, scaleX, scaleY, tileSize, tileStyle, showNames, nameSize, showWireframe, wireframeSegments, wireframeOpacity, wireframeColor, showNoiseGlobe, audioVolume, analyserRef, noiseColor1, noiseColor2, noiseSpeed, noiseScale, blurNames, onNameClick, namesClickable }: {
  posts: Post[]
  rotateSpeed: number
  scale: number
  scaleX: number
  scaleY: number
  tileSize: number
  tileStyle: 'billboard' | 'outward'
  showNames: boolean
  nameSize: number
  showWireframe: boolean
  wireframeSegments: number
  wireframeOpacity: number
  wireframeColor: string
  showNoiseGlobe: boolean
  audioVolume: number
  analyserRef: { current: AnalyserNode | null }
  noiseColor1: string
  noiseColor2: string
  noiseSpeed: number
  noiseScale: number
  blurNames: boolean
  onNameClick: (name: string) => void
  namesClickable: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const Tile = tileStyle === 'billboard' ? TileBillboard : TileOutward

  return (
    <>
      <GlobeControls groupRef={groupRef} rotateSpeed={rotateSpeed} />
      <group ref={groupRef} scale={[scale * scaleX, scale * scaleY, scale]}>
        {showNoiseGlobe && <NoiseGlobe audioVolume={audioVolume} analyserRef={analyserRef} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} />}
        {showWireframe && (
          <mesh>
            <sphereGeometry args={[RADIUS, wireframeSegments, wireframeSegments]} />
            <meshBasicMaterial wireframe color={wireframeColor} opacity={wireframeOpacity} transparent />
          </mesh>
        )}
        {posts.map((post, i) => (
          <Suspense key={post.id} fallback={null}>
            <Tile post={post} index={i} total={posts.length} tileSize={tileSize} />
          </Suspense>
        ))}
        {showNames && NAMES.map((name, i) => (
          <NameTag key={name} name={name} index={i} nameSize={nameSize} blur={blurNames} onClick={onNameClick} clickable={namesClickable} />
        ))}
      </group>
    </>
  )
}

export default function GlobeCanvas({ posts, rotateSpeed, scale, scaleX, scaleY, tileSize, tileStyle, showNames, nameSize, showWireframe, wireframeSegments, wireframeOpacity, wireframeColor, showNoiseGlobe, audioVolume, analyserRef, noiseColor1, noiseColor2, noiseSpeed, noiseScale, blurNames, onNameClick, namesClickable }: {
  posts: Post[]
  rotateSpeed: number
  scale: number
  scaleX: number
  scaleY: number
  tileSize: number
  tileStyle: 'billboard' | 'outward'
  showNames: boolean
  nameSize: number
  showWireframe: boolean
  wireframeSegments: number
  wireframeOpacity: number
  wireframeColor: string
  showNoiseGlobe: boolean
  audioVolume: number
  analyserRef: { current: AnalyserNode | null }
  noiseColor1: string
  noiseColor2: string
  noiseSpeed: number
  noiseScale: number
  blurNames: boolean
  onNameClick: (name: string) => void
  namesClickable: boolean
}) {
  return (
    <Canvas camera={{ position: [0, 0, 7.5], fov: 50 }} dpr={[1, 2]} style={{ width: '100%', height: '100%', touchAction: 'none' }}>
      <Scene posts={posts} rotateSpeed={rotateSpeed} scale={scale} scaleX={scaleX} scaleY={scaleY} tileSize={tileSize} tileStyle={tileStyle} showNames={showNames} nameSize={nameSize} showWireframe={showWireframe} wireframeSegments={wireframeSegments} wireframeOpacity={wireframeOpacity} wireframeColor={wireframeColor} showNoiseGlobe={showNoiseGlobe} audioVolume={audioVolume} analyserRef={analyserRef} noiseColor1={noiseColor1} noiseColor2={noiseColor2} noiseSpeed={noiseSpeed} noiseScale={noiseScale} blurNames={blurNames} onNameClick={onNameClick} namesClickable={namesClickable} />
    </Canvas>
  )
}
