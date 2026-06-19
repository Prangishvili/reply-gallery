'use client'

import { Suspense } from 'react'
import { GalleryApp } from '../gallery-app'

export default function RoomPage() {
  return (
    <Suspense>
      <GalleryApp initialView="room" />
    </Suspense>
  )
}
