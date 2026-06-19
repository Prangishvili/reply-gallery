'use client'

import { Suspense } from 'react'
import { GalleryApp } from './gallery-app'

export default function Home() {
  return (
    <Suspense>
      <GalleryApp initialView="circle" showEntry />
    </Suspense>
  )
}
