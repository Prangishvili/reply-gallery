'use client'

import { Suspense } from 'react'
import { GalleryApp } from '@/app/gallery-app'

export default function GlobePage() {
  return (
    <Suspense>
      <GalleryApp initialView="globe" showEntry={false} />
    </Suspense>
  )
}
