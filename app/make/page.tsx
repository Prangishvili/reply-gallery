'use client'

import dynamic from 'next/dynamic'

const Scene = dynamic(() => import('./scene'), { ssr: false })

export default function MakePage() {
  return (
    <>
      <style>{`canvas { cursor: default !important; }`}</style>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
        <Scene />
      </div>
    </>
  )
}
