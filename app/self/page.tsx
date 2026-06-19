'use client'

import { Suspense } from 'react'
import { GalleryApp } from '../gallery-app'

export default function SelfPage() {
  return (
    <Suspense>
      <GalleryApp initialView="self" />
    </Suspense>
  )
}
