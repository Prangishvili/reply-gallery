'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GalleryApp } from './gallery-app'
import { hasPassedAudioGate } from './lib/audio-gate'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (!hasPassedAudioGate()) {
      router.replace('/intro')
    }
  }, [router])

  return (
    <Suspense>
      <GalleryApp initialView="circle" />
    </Suspense>
  )
}
