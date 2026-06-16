'use client'

import { Suspense, useMemo, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerspectiveCamera, OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

function FigureDots() {
  const { scene } = useGLTF('/figure.glb')

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
    <group scale={200} rotation={[0, 0, 0]}>
      <points geometry={geo}>
        <pointsMaterial color="#000000" size={0.4} sizeAttenuation />
      </points>
    </group>
  )
}

export default function Scene() {
  return (
    <Canvas style={{ width: '100%', height: '100%', cursor: 'default' }} onPointerMissed={undefined}>
      <PerspectiveCamera makeDefault position={[0, 150, 600]} fov={40} near={0.1} far={5000} />
      <OrbitControls
        target={[0, 260, 0]}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2}
        maxPolarAngle={Math.PI / 2}
        minAzimuthAngle={-Math.PI / 4}
        maxAzimuthAngle={Math.PI / 4}
      />
      <Suspense fallback={null}>
        <FigureDots />
      </Suspense>
    </Canvas>
  )
}
