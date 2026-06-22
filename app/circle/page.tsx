'use client'

import { Suspense } from 'react'
import { GalleryApp } from '@/app/gallery-app'

export default function CirclePage() {
  return (
    <Suspense>
      <GalleryApp initialView="circle" />
    </Suspense>
  )
}
