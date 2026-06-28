'use client'

import { Suspense } from 'react'
import { GalleryApp } from '@/app/gallery-app'

export default function DuoPage() {
  return (
    <Suspense>
      <GalleryApp
        initialView="circle"
        circleStudents={['Mariam Qsovreli', 'Sergi Sarajevi']}
        adminOverrides={{ circleRadius: 150, circleCameraMode: 'orthographic' }}
      />
    </Suspense>
  )
}
